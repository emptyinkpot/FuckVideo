import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useReducer } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { cameraPose, sunDirection, type GeoCamera } from "../core/camera";
import { EARTH_RADIUS_KM, MAX_MERCATOR_LAT } from "../core/geo";
import type { EarthLayer, LayerContext, RenderPass } from "../layers/types";
import { buildingMaterial, createBlockGeometry, createHouseGeometry } from "./buildings/buildingMaterial";
import { citiesNear, getCityBuildings, type CityBuildings } from "./buildings/cityBuildings";
import { createDecalMaterial, createDecalUniforms, type DecalUniforms } from "./materials/decalMaterial";
import { earthUniforms } from "./materials/earthUniforms";
import { riverMaterial } from "./materials/riverMaterial";
import { atmosphereMaterial, createStars, skyMaterial } from "./materials/skyMaterials";
import { createTerrainMaterial } from "./materials/terrainMaterial";
import { waterMaterial } from "./materials/waterMaterial";
import { beginChunkFrame, getChunk } from "./terrain/chunkMesh";
import { selectTiles } from "./terrain/selectTiles";
import { applyStyleUniforms, resolveStyle, type EarthStyle, type EarthStyleId } from "../styles";
import { ensureTiles, getTile, loadedTileCount, releaseLoadedTiles, subscribeTiles } from "./terrain/tileStore";
import { RIVER_ORIGIN, buildRiverGeometry, getRivers, loadRivers } from "./water/rivers";

export type SunSetting = {
  /** 太阳方位角（度），从正北顺时针 */
  azimuthDeg: number;
  /** 太阳高度角（度） */
  elevationDeg: number;
};

/**
 * 自动太阳（由风格决定）：近距离时较低，山体投影和坡面明暗都明显；远距离时升高，
 * 避免整个地球有一大片昏暗的晨昏区。
 */
const autoSun = (rangeKm: number, style: EarthStyle): SunSetting => {
  const t = Math.min(1, Math.max(0, (Math.log(rangeKm) - Math.log(300)) / (Math.log(6000) - Math.log(300))));
  const { azimuthDeg, elevationNearDeg, elevationFarDeg } = style.sun;
  return { azimuthDeg, elevationDeg: elevationNearDeg + (elevationFarDeg - elevationNearDeg) * t };
};

export type GlobeSceneProps = {
  view: GeoCamera;
  /** 画面风格（styles/）：风格名或完整的风格对象，默认 "default" */
  style?: EarthStyleId | EarthStyle;
  /** 太阳方位角、高度角；不填时按风格和镜头距离自动设置 */
  sun?: SunSetting;
  /** 地形高度放大倍数，1 为真实比例；不填时用风格的设置 */
  exaggeration?: number;
  /** 河流（属于基础地球） */
  showRivers?: boolean;
  /** 城市建筑（属于基础地球） */
  showBuildings?: boolean;
  /** 地形精度：屏幕误差容许的像素数，越小越精细 */
  pixelError?: number;
  /** 海平面处每公里消光系数，越大越朦胧；不填时用风格的设置 */
  hazeDensity?: number;
  /** 叠加在基础地球上的图层，按 order 从下到上绘制 */
  layers?: EarthLayer[];
  /** 渲染哪一部分（分层导出）；labels 通道不经过这里 */
  pass?: RenderPass;
};

/** 相机离城区这么近（公里）以内才生成三维建筑；更远处由地表着色器画城区纹理。 */
const BUILDING_RANGE_KM = 7;
/** 相机高度在这个区间内，建筑从地面升到完整高度。 */
const BUILDING_GROW_KM: [number, number] = [6.5, 3.5];

const skyGeometry = new THREE.SphereGeometry(100000, 48, 24);
const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS_KM + 70, 192, 96);
const houseGeometry = createHouseGeometry();
const blockGeometry = createBlockGeometry();

// 墨卡托瓦片覆盖不到的两极：北极是海冰/海面，南极是约 2800 米高的冰盖
const capAngle = ((90 - MAX_MERCATOR_LAT) * Math.PI) / 180 + 0.002;
const northCapGeometry = (() => {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS_KM, 128, 6, 0, Math.PI * 2, 0, capAngle);
  geometry.setAttribute("aDepth", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count).fill(3000), 1));
  return geometry;
})();
const southCapGeometry = (() => {
  const geometry = new THREE.SphereGeometry(EARTH_RADIUS_KM + 2.8, 128, 6, 0, Math.PI * 2, Math.PI - capAngle, capAngle);
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count).fill(2800), 1));
  return geometry;
})();
const southCapMaterial = (() => {
  const snow = new THREE.DataTexture(new Uint8Array(256 * 256).fill(7), 256, 256, THREE.RedFormat, THREE.UnsignedByteType);
  snow.needsUpdate = true;
  return createTerrainMaterial(snow, 2);
})();

/** 每个贴地图层的参数，按图层 id 全局共享：分块缓存是全局的，分块上的图层材质引用的是这里的对象。 */
const decalUniforms = new Map<string, DecalUniforms>();

const instanced = (
  geometry: THREE.BufferGeometry,
  set: { matrices: Float32Array; colors: Float32Array; count: number },
) => {
  if (set.count === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, buildingMaterial, set.count);
  mesh.instanceMatrix = new THREE.InstancedBufferAttribute(set.matrices, 16);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(set.colors, 3);
  mesh.frustumCulled = false;
  return mesh;
};

const CityMeshes = ({ data }: { data: CityBuildings }) => {
  const houses = useMemo(() => instanced(houseGeometry, data.houses), [data]);
  const blocks = useMemo(() => instanced(blockGeometry, data.blocks), [data]);
  // 城市离开画面时释放显卡里的实例数据
  useEffect(
    () => () => {
      houses?.dispose();
      blocks?.dispose();
    },
    [houses, blocks],
  );
  return (
    <group position={data.origin}>
      {houses ? <primitive object={houses} /> : null}
      {blocks ? <primitive object={blocks} /> : null}
    </group>
  );
};

/**
 * 基础地球 + 图层。基础地球包括地形、海洋湖泊、河流、建筑、天空和大气；
 * 国界、控制区、战线、箭头等都是图层，由 layers 传入，基础地球本身不认识它们。
 */
export const GlobeScene = ({
  view,
  style: styleInput,
  sun,
  exaggeration: exaggerationInput,
  showRivers = true,
  showBuildings = true,
  pixelError = 1.5,
  hazeDensity: hazeInput,
  layers = [],
  pass = "full",
}: GlobeSceneProps) => {
  const style = resolveStyle(styleInput);
  const exaggeration = exaggerationInput ?? style.exaggeration;
  const hazeDensity = hazeInput ?? style.haze.density;
  const { camera, size, advance } = useThree();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [version, bump] = useReducer((value: number) => value + 1, 0);
  useEffect(() => subscribeTiles(bump), []);
  const stars = useMemo(() => createStars(), []);

  // 1. 按镜头参数摆放相机（直接在渲染阶段设置，保证本帧选块和绘制用的是同一个相机）
  const pose = cameraPose(view);
  const perspective = camera as THREE.PerspectiveCamera;
  perspective.fov = pose.fovDeg;
  perspective.near = 0.0005;
  perspective.far = 400000;
  perspective.position.copy(pose.position);
  perspective.up.copy(pose.up);
  perspective.lookAt(pose.target);
  perspective.updateProjectionMatrix();
  perspective.updateMatrixWorld(true);

  // 2. 选块并确保已加载
  const pixelsPerUnit = size.height / (2 * Math.tan((pose.fovDeg * Math.PI) / 360));
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(perspective.projectionMatrix, perspective.matrixWorldInverse),
  );
  const tiles = selectTiles({ position: pose.position, frustum, pixelsPerUnit }, pixelError);
  ensureTiles(tiles.map((tile) => tile.key));
  const drawGlobeColor = pass !== "overlay";
  const drawLayers = pass !== "globe";
  const rivers = getRivers();
  if (showRivers && drawGlobeColor && !rivers) loadRivers();

  // 3. 共享 uniform
  earthUniforms.uCameraPos.value.copy(pose.position);
  applyStyleUniforms(style);
  const sunSetting = sun ?? autoSun(view.rangeKm, style);
  earthUniforms.uSunDir.value.copy(sunDirection(view.lon, view.lat, sunSetting.azimuthDeg, sunSetting.elevationDeg));
  earthUniforms.uHazeDensity.value = hazeDensity;
  earthUniforms.uTime.value = frame / fps;
  earthUniforms.uPixelAngle.value = 1 / pixelsPerUnit;
  const altitude = pose.position.length() - EARTH_RADIUS_KM;
  const [growStart, growEnd] = BUILDING_GROW_KM;
  buildingMaterial.uniforms.uGrow.value = Math.min(1, Math.max(0, (growStart - altitude) / (growStart - growEnd)));
  (stars.material as THREE.PointsMaterial).opacity = Math.min(1, Math.max(0, (altitude - 60) / 400));

  // 只画图层时，地形、水面、建筑只写深度（不出颜色），用来遮挡山后的线条和贴地内容
  waterMaterial.colorWrite = drawGlobeColor;
  southCapMaterial.colorWrite = drawGlobeColor;
  buildingMaterial.colorWrite = drawGlobeColor;

  // 4. 附近城市的建筑（需要城市附近的分块已加载，才能贴准地面）
  const nearbyCities = showBuildings ? citiesNear(pose.position, BUILDING_RANGE_KM) : [];
  const cityTilesReady = nearbyCities.length === 0 || ensureTiles(tiles.map((tile) => tile.key));
  const buildings = cityTilesReady ? nearbyCities.map((city) => getCityBuildings(city, rivers)) : [];

  // 5. 图层
  const context: LayerContext = { style, exaggeration, loadedTiles: loadedTileCount() };
  const activeLayers = drawLayers ? [...layers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  const decals = activeLayers.flatMap((layer, index) => {
    const source = layer.decal?.(context);
    if (!source) return [];
    let uniforms = decalUniforms.get(layer.id);
    if (!uniforms) {
      uniforms = createDecalUniforms();
      decalUniforms.set(layer.id, uniforms);
    }
    const { global, detail } = source.provinces;
    uniforms.uProvGlobal.value = global.texture;
    uniforms.uProvGlobalBounds.value.set(...global.bounds);
    uniforms.uProvGlobalSize.value.set(...global.size);
    uniforms.uProvDetail.value = detail.texture;
    uniforms.uProvDetailBounds.value.set(...detail.bounds);
    uniforms.uProvDetailSize.value.set(...detail.size);
    uniforms.uLookupA.value = source.lookupA;
    uniforms.uLookupB.value = source.lookupB ?? source.lookupA;
    uniforms.uMix.value = source.lookupB ? (source.mix ?? 0) : 0;
    uniforms.uLookupWidth.value = source.lookupWidth;
    uniforms.uPalette.value = source.palette;
    uniforms.uOpacity.value = layer.opacity ?? 1;
    uniforms.uMode.value = source.mode === "nations" ? 1 : 2;
    return [{ id: layer.id, uniforms, renderOrder: 1.5 + index * 0.01 }];
  });

  // 新数据画上画布后再放行截图
  useLayoutEffect(() => {
    advance(performance.now());
    releaseLoadedTiles();
  }, [version, advance]);

  const riverGeometry = showRivers && drawGlobeColor && rivers ? buildRiverGeometry(rivers, exaggeration) : null;
  beginChunkFrame();

  return (
    <>
      {drawGlobeColor ? (
        <>
          <mesh geometry={skyGeometry} material={skyMaterial} position={pose.position} renderOrder={-1000} frustumCulled={false} />
          <primitive object={stars} />
        </>
      ) : null}
      {tiles.map((ref) => {
        const tile = getTile(ref.key);
        if (!tile) return null;
        const chunk = getChunk(tile, exaggeration);
        chunk.terrainMaterial.colorWrite = drawGlobeColor;
        return (
          <group key={ref.key} position={chunk.center}>
            <mesh geometry={chunk.terrain} material={chunk.terrainMaterial} />
            {chunk.water ? <mesh geometry={chunk.water} material={waterMaterial} renderOrder={1} /> : null}
            {decals.map((decal) => {
              // 每个分块一份材质（起伏数据按分块），图层参数共享同一组 uniform 对象
              let material = chunk.decals.get(decal.id);
              if (!material) {
                material = createDecalMaterial(decal.uniforms, chunk.relief, exaggeration);
                chunk.decals.set(decal.id, material);
              }
              return <mesh key={decal.id} geometry={chunk.terrain} material={material} renderOrder={decal.renderOrder} />;
            })}
          </group>
        );
      })}
      <mesh geometry={northCapGeometry} material={waterMaterial} renderOrder={1} />
      <mesh geometry={southCapGeometry} material={southCapMaterial} />
      {riverGeometry ? (
        <mesh geometry={riverGeometry} material={riverMaterial} position={RIVER_ORIGIN} renderOrder={2} frustumCulled={false} />
      ) : null}
      {buildings.map((data) => (
        <CityMeshes key={data.city.name + data.city.seed} data={data} />
      ))}
      {activeLayers.map((layer) => {
        const objects = layer.objects?.(context);
        return objects ? <group key={layer.id}>{objects}</group> : null;
      })}
      {drawGlobeColor ? <mesh geometry={atmosphereGeometry} material={atmosphereMaterial} renderOrder={3} /> : null}
    </>
  );
};
