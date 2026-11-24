/** 颜色：sRGB 0-1（和设计软件里看到的一致），写进着色器前转成线性。 */
export type Rgb = [number, number, number];

/**
 * 地球画面风格。基础地球的着色器只读这些参数，不写死任何一种风格。
 * 新风格：在 styles/ 下新建一个文件，导出一个 EarthStyle，再登记到 styles/index.ts。
 */
export type EarthStyle = {
  id: string;
  /** Studio 面板里显示的名字 */
  label: string;

  /** 地形高度放大倍数，1 为真实比例；组合的 exaggeration 参数可以覆盖 */
  exaggeration: number;

  /** 没有指定太阳时的自动太阳：镜头 300 公里内用 near，6000 公里外用 far，中间按对数过渡 */
  sun: { azimuthDeg: number; elevationNearDeg: number; elevationFarDeg: number };

  /** 地表底色 */
  surface: {
    /** 0：按真实地表分类（森林、农田、城区……）着色；1：风格化底色（按海拔和坡度） */
    stylized: number;
    /** 风格化底色：低处、高处、陡坡岩石 */
    low: Rgb;
    high: Rgb;
    rock: Rgb;
    /** 低处、高处对应的海拔（米），中间渐变 */
    lowHeightM: number;
    highHeightM: number;
    /** 风格化底色上的大尺度明暗起伏强度 */
    variation: number;
    /** 积雪 0-1 */
    snow: number;
  };

  /** 受光 */
  light: {
    /** 阳光强度 */
    sun: number;
    /** 天光（阴影里的亮度主要来自它；越小阴影越深） */
    sky: number;
    /** 山脊高光：凸起的棱线变亮，受光一侧更亮 */
    ridge: number;
    /** 沟谷压暗：凹下去的沟底变暗 */
    valley: number;
    /** 山脊、沟谷的检测尺度（坡度图上的像素数），越大越粗 */
    curvatureTexels: number;
  };

  /** 空气透视 */
  haze: {
    /** 海平面处每公里消光系数；组合的 hazeDensity 参数可以覆盖 */
    density: number;
    /** 0：按物理计算的蓝灰色天光；1：完全用 color */
    mix: number;
    color: Rgb;
  };

  /** 天空：0 为物理天空，1 为完全用 color */
  sky: { mix: number; color: Rgb };

  /** 海洋、湖泊、河流颜色的乘数；river/riverMix：河流单独换成某种颜色（0 为不换），态势图里用亮色 */
  water: { tint: Rgb; river: Rgb; riverMix: number };

  /** 贴地图层（控制区着色等）的强度倍数：1 为半透明叠加，越大越像直接把地形染色 */
  decalStrength: number;

  /** 整体调色，作用在三维画面上（文字不受影响） */
  grade: { brightness: number; contrast: number; saturation: number; vignette: number };
};
