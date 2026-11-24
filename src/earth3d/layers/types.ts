import type * as THREE from "three";
import type { GeoCamera } from "../core/camera";
import type { EarthStyle } from "../styles/types";

/** 经纬度 -> 画面像素坐标；地球背面或贴着画面边缘时为 null。 */
export type Projector = (lon: number, lat: number) => { x: number; y: number } | null;

/** 文字层拿到的画面信息：镜头、画面尺寸、当前风格。 */
export type LabelInfo = { view: GeoCamera; width: number; height: number; style: EarthStyle };

/** 西、南、东、北（度） */
export type LonLatBounds = [number, number, number, number];

/**
 * 贴地内容：全球地块系统（map/provinceStore.ts）画在地形表面上，随地形明暗。
 * mode：nations 国家层（按领有政权涂色），occupation 占领层（斜纹、争夺虚线）。
 * 给了 lookupB 时，按 mix 从 lookupA 的状态过渡到 lookupB 的状态。
 */
export type DecalSource = {
  mode: "nations" | "occupation";
  provinces: {
    global: { texture: THREE.Texture; bounds: LonLatBounds; size: [number, number] };
    detail: { texture: THREE.Texture; bounds: LonLatBounds; size: [number, number] };
  };
  lookupA: THREE.Texture;
  lookupB?: THREE.Texture | null;
  mix?: number;
  lookupWidth: number;
  /** 政权色板（按当前风格） */
  palette: THREE.Texture;
};

export type LayerContext = {
  /** 当前画面风格，图层按它决定颜色、线宽、光晕 */
  style: EarthStyle;
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
  labels?: (project: Projector, info: LabelInfo) => React.ReactNode;
};

/**
 * 渲染哪一部分，用于分层导出：
 * - full：完整画面
 * - globe：只有基础地球，不带任何图层
 * - overlay：只有图层的贴地内容和三维对象，透明背景（地形只写深度，用来遮挡）
 * - labels：只有文字，透明背景
 */
export type RenderPass = "full" | "globe" | "overlay" | "labels";
