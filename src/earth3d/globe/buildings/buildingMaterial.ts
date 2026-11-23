import * as THREE from "three";
import { earthUniforms } from "../materials/earthUniforms";
import { ATMOSPHERE_GLSL, NOISE_GLSL } from "../materials/shaderChunks";

/**
 * 建筑材质：墙面颜色来自每栋房子的 instanceColor，屋顶为灰瓦色；
 * 与地表共用阳光、天光和空气透视，远处的建筑和地面一起变淡。
 */
export const buildingMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { ...earthUniforms, uGrow: { value: 1 } },
  vertexShader: /* glsl */ `
    attribute float aRoof;
    uniform float uGrow;
    varying vec3 vWorld;
    varying vec3 vNormalW;
    varying vec3 vWall;
    varying float vRoof;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      // uGrow 从 0 到 1：镜头下降时房子从地面里升起来，避免突然出现
      vec4 local = instanceMatrix * vec4(position.xy, position.z * uGrow, 1.0);
      vec4 world = modelMatrix * local;
      vWorld = world.xyz;
      mat3 normalMatrixInstance = transpose(inverse(mat3(instanceMatrix)));
      vNormalW = normalize(mat3(modelMatrix) * normalMatrixInstance * normal);
      vWall = instanceColor;
      vRoof = aRoof;
      gl_Position = projectionMatrix * modelViewMatrix * local;
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vWorld;
    varying vec3 vNormalW;
    varying vec3 vWall;
    varying float vRoof;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    ${NOISE_GLSL}
    ${ATMOSPHERE_GLSL}
    void main() {
      #include <logdepthbuf_fragment>
      vec3 up = normalize(vWorld);
      vec3 n = normalize(vNormalW);
      vec3 roof = mix(pow(vec3(0.30, 0.30, 0.31), vec3(2.2)), vWall * 0.55, 0.25);
      vec3 albedo = mix(vWall, roof, vRoof);
      vec3 color = albedo * e3dSunLight(n, up);
      color = e3dApplyHaze(color, vWorld);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

/**
 * 单位房屋：底面 1x1，总高 1；墙体占 0.72，上面是两坡屋顶。
 * 局部坐标 x 为面宽方向，y 为进深方向，z 向上。
 */
export const createHouseGeometry = () => {
  const wall = 0.72;
  const positions: number[] = [];
  const normals: number[] = [];
  const roofFlags: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], normal: number[], roof: number) => {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(...p);
      normals.push(...normal);
      roofFlags.push(roof);
    }
  };
  const tri = (a: number[], b: number[], c: number[], normal: number[], roof: number) => {
    for (const p of [a, b, c]) {
      positions.push(...p);
      normals.push(...normal);
      roofFlags.push(roof);
    }
  };
  const h = 0.5;
  // 四面墙
  quad([-h, -h, 0], [h, -h, 0], [h, -h, wall], [-h, -h, wall], [0, -1, 0], 0);
  quad([h, h, 0], [-h, h, 0], [-h, h, wall], [h, h, wall], [0, 1, 0], 0);
  quad([h, -h, 0], [h, h, 0], [h, h, wall], [h, -h, wall], [1, 0, 0], 0);
  quad([-h, h, 0], [-h, -h, 0], [-h, -h, wall], [-h, h, wall], [-1, 0, 0], 0);
  // 两坡屋顶，屋脊沿 x 方向
  const ridge = 1;
  const slope = Math.hypot(h, ridge - wall);
  const ny = (ridge - wall) / slope;
  const nz = h / slope;
  quad([-h, -h, wall], [h, -h, wall], [h, 0, ridge], [-h, 0, ridge], [0, -ny, nz], 1);
  quad([h, h, wall], [-h, h, wall], [-h, 0, ridge], [h, 0, ridge], [0, ny, nz], 1);
  // 山墙三角
  tri([h, -h, wall], [h, h, wall], [h, 0, ridge], [1, 0, 0], 0);
  tri([-h, h, wall], [-h, -h, wall], [-h, 0, ridge], [-1, 0, 0], 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aRoof", new THREE.Float32BufferAttribute(roofFlags, 1));
  return geometry;
};

/** 平顶楼房：大城市中心的多层建筑。 */
export const createBlockGeometry = () => {
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  box.translate(0, 0, 0.5);
  const normals = box.getAttribute("normal");
  const roofFlags = new Float32Array(normals.count);
  for (let i = 0; i < normals.count; i++) roofFlags[i] = normals.getZ(i) > 0.5 ? 1 : 0;
  box.setAttribute("aRoof", new THREE.BufferAttribute(roofFlags, 1));
  box.deleteAttribute("uv");
  return box;
};
