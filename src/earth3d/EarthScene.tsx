import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useReducer } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { citiesNear, getCityBuildings, type CityBuildings } from "./buildings/cityBuildings";
import { buildingMaterial, createBlockGeometry, createHouseGeometry } from "./buildings/buildingMaterial";
import { cameraPose, sunDirection, type GeoCamera } from "./camera/geoCamera";
import { EARTH_RADIUS_KM, MAX_MERCATOR_LAT } from "./core/geo";
import { earthUniforms } from "./materials/earthUniforms";
import { riverMaterial } from "./materials/riverMaterial";
import { atmosphereMaterial, createStars, skyMaterial } from "./materials/skyMaterials";
import { createTerrainMaterial } from "./materials/terrainMaterial";
import { waterMaterial } from "./materials/waterMaterial";
import { getChunk } from "./terrain/chunkMesh";
import { BORDER_ORIGIN, getBorderGeometry, loadBorders } from "./overlays/borders";
import { createLineMaterial } from "./overlays/geoLines";
import { selectTiles } from "./terrain/selectTiles";
import { ensureTiles, getTile, releaseLoadedTiles, subscribeTiles } from "./terrain/tileStore";
import { RIVER_ORIGIN, buildRiverGeometry, getRivers, loadRivers } from "./water/rivers";

/**
 * 默认太阳：近距离时较低（28°），地形起伏更明显；远距离时升高到 60°，
 * 避免整个地球有一大片昏暗的晨昏区。
 */
const autoSun = (rangeKm: number): SunSetting => {
  const t = Math.min(1, Math.max(0, (Math.log(rangeKm) - Math.log(300)) / (Math.log(6000) - Math.log(300))));
  return { azimuthDeg: 210, elevationDeg: 28 + (60 - 28) * t };
};

export type SunSetting = {
  /** 太阳方位角（度），从正北顺时针 */
  azimuthDeg: number;
  /** 太阳高度角（度） */
  elevationDeg: number;
};

export type EarthSceneProps = {
  view: GeoCamera;
  /** 太阳方位角、高度角；不填时按镜头距离自动设置 */
  sun?: SunSetting;
  /** 地形高度放大倍数，1 为真实比例 */
  exaggeration?: number;
  showRivers?: boolean;
  showBuildings?: boolean;
  /** 显示 1938 年陆上国界 */
  showBorders?: boolean;
  /** 地形精度：屏幕误差容许的像素数，越小越精细 */
  pixelError?: number;
  /** 海平面处每公里消光系数，越大越朦胧 */
  hazeDensity?: number;
  children?: React.ReactNode;
};

/** 相机离城区这么近（公里）以内才生成三维建筑；更远处由地表着色器画城区纹理。 */
const BUILDING_RANGE_KM = 7;
/** 相机高度在这个区间内，建筑从地面升到完整高度。 */
const BUILDING_GROW_KM: [number, number] = [6.5, 3.5];

const skyGeometry = new THREE.SphereGeometry(100000, 48, 24);
const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS_KM + 70, 192, 96);
const houseGeometry = createHouseGeometry();
const borderMaterial = createLineMaterial("#f3ead8", 1.4, 0.8);
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

const CityMeshes = ({ data }: { data: CityBuildings }) => {
  const houses = useMemo(() => instanced(houseGeometry, data.houses), [data]);
  const blocks = useMemo(() => instanced(blockGeometry, data.blocks), [data]);
  return (
    <group position={data.origin}>
      {houses ? <primitive object={houses} /> : null}
      {blocks ? <primitive object={blocks} /> : null}
    </group>
  );
};

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

export const EarthScene = ({
  view,
  sun,
  exaggeration = 1,
  showRivers = true,
  showBuildings = true,
  showBorders = true,
  pixelError = 1.5,
  hazeDensity = 1 / 140,
  children,
}: EarthSceneProps) => {
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
  const rivers = getRivers();
  if (showRivers && !rivers) loadRivers();
  if (showBorders) loadBorders();
  const borderGeometry = showBorders ? getBorderGeometry(exaggeration) : null;

  // 3. 共享 uniform
  earthUniforms.uCameraPos.value.copy(pose.position);
  const sunSetting = sun ?? autoSun(view.rangeKm);
  earthUniforms.uSunDir.value.copy(sunDirection(view.lon, view.lat, sunSetting.azimuthDeg, sunSetting.elevationDeg));
  earthUniforms.uHazeDensity.value = hazeDensity;
  earthUniforms.uTime.value = frame / fps;
  earthUniforms.uPixelAngle.value = 1 / pixelsPerUnit;
  const altitude = pose.position.length() - EARTH_RADIUS_KM;
  const [growStart, growEnd] = BUILDING_GROW_KM;
  buildingMaterial.uniforms.uGrow.value = Math.min(1, Math.max(0, (growStart - altitude) / (growStart - growEnd)));
  (stars.material as THREE.PointsMaterial).opacity = Math.min(1, Math.max(0, (altitude - 60) / 400));

  // 4. 附近城市的建筑（需要城市附近的分块已加载，才能贴准地面）
  const nearbyCities = showBuildings ? citiesNear(pose.position, BUILDING_RANGE_KM) : [];
  const cityTilesReady = nearbyCities.length === 0 || ensureTiles(tiles.map((tile) => tile.key));
  const buildings = cityTilesReady ? nearbyCities.map((city) => getCityBuildings(city, rivers)) : [];

  // 新数据画上画布后再放行截图
  useLayoutEffect(() => {
    advance(performance.now());
    releaseLoadedTiles();
  }, [version, advance]);

  const riverGeometry = showRivers && rivers ? buildRiverGeometry(rivers, exaggeration) : null;

  return (
    <>
      <mesh geometry={skyGeometry} material={skyMaterial} position={pose.position} renderOrder={-1000} frustumCulled={false} />
      <primitive object={stars} />
      {tiles.map((ref) => {
        const tile = getTile(ref.key);
        if (!tile) return null;
        const chunk = getChunk(tile, exaggeration);
        return (
          <group key={ref.key} position={chunk.center}>
            <mesh geometry={chunk.terrain} material={chunk.terrainMaterial} />
            {chunk.water ? <mesh geometry={chunk.water} material={waterMaterial} renderOrder={1} /> : null}
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
      {borderGeometry ? (
        <mesh geometry={borderGeometry} material={borderMaterial} position={BORDER_ORIGIN} renderOrder={4} frustumCulled={false} />
      ) : null}
      <mesh geometry={atmosphereGeometry} material={atmosphereMaterial} renderOrder={3} />
      {children}
    </>
  );
};

