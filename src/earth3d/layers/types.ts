import type * as THREE from "three";

/** 经纬度 -> 画面像素坐标；地球背面或贴着画面边缘时为 null。 */
export type Projector = (lon: number, lat: number) => { x: number; y: number } | null;

/** 西、南、东、北（度） */
export type LonLatBounds = [number, number, number, number];

/**
 * 贴地内容：一张经纬度等距的透明图（RGB 颜色，A 强度），画在地形表面上，随地形明暗。
 * 可以给两张图 a、b，按 mix 从 a 过渡到 b。
 */
export type DecalSource = {
  a: THREE.Texture;
  b?: THREE.Texture | null;
  mix?: number;
  bounds: LonLatBounds;
};

export type LayerContext = {
  /** 地形高度倍数，贴地的线条要和地形一致 */
  exaggeration: number;
  /** 已加载的地形分块数；变化时贴地线条按新高度重建 */
  loadedTiles: number;
};

/**
 * 叠加在基础地球上的一个图层。基础地球（地形、水、河流、建筑、天空）不知道图层的存在，
 * 图层通过三种通道接入，按需提供其中任意几种：
 * - decal：贴地内容（控制区着色、斜纹等），单独一遍画在地形上；
 * - objects：三维对象（国界线、战线、箭头）；
 * - labels：画面上的文字（地名），用 HTML 放在三维位置的投影处。
 * 每个通道的函数在每次渲染时调用：地形分块、数据加载完成后场景会重新渲染，结果随之更新。
 */
export type EarthLayer = {
  id: string;
  /** 0..1，整层的不透明度 */
  opacity?: number;
  /** 绘制先后，数值大的画在上面 */
  order?: number;
  decal?: (context: LayerContext) => DecalSource | null;
  objects?: (context: LayerContext) => React.ReactNode;
  labels?: (project: Projector) => React.ReactNode;
};

/**
 * 渲染哪一部分，用于分层导出：
 * - full：完整画面
 * - globe：只有基础地球，不带任何图层
 * - overlay：只有图层的贴地内容和三维对象，透明背景（地形只写深度，用来遮挡）
 * - labels：只有文字，透明背景
 */
export type RenderPass = "full" | "globe" | "overlay" | "labels";
