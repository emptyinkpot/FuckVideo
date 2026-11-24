import type { PolityId } from "../history/political/polities";

/** 颜色：sRGB 0-1（和设计软件里看到的一致），写进着色器前转成线性。 */
export type Rgb = [number, number, number];

/**
 * 地球画面风格。各层（自然地理 globe/、人文地理 map/、事件 events/、文字和界面）都只读这里的参数，
 * 不写死任何颜色；风格之间是平行的，每个风格都必须把所有字段填全（少一项类型检查就报错）。
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

  /** 整体调色，作用在三维画面上（文字不受影响） */
  grade: { brightness: number; contrast: number; saturation: number; vignette: number };

  /**
   * 国家层（map/political.ts）和国界线（map/borderLines.tsx）。
   * colors：手工整理的东亚政权（history/political/polities.ts）每个都要配色，少一个类型检查就报错；
   * slots：世界其他国家按国名从这组中性色里取（换日期颜色不变，殖民地取宗主国的颜色）。
   * 国界：不同国家之间粗线（可带光晕），同一国家内（国民政府与各地军阀）细线。
   */
  political: {
    colors: Record<PolityId, Rgb>;
    slots: Rgb[];
    fill: number;
    international: { color: Rgb; widthPx: number; alpha: number; glowPx: number; glowAlpha: number };
    internal: { color: Rgb; widthPx: number; alpha: number };
    /** 0：颜色完全按地形受光；1：自发光 */
    emissive: number;
  };

  /**
   * 占领层（map/occupation.ts）：被占领的地方在原主人的底色上画控制者颜色的斜纹；正在争夺的地方画进攻方颜色的
   * 流动虚线。斜纹、虚线的间距和宽度按屏幕像素，远近不变。前线（map/borderLines.tsx）画在占领区和未占领区的交界处。
   */
  occupation: {
    stripeSpacingPx: number;
    stripeWidthPx: number;
    stripeAlpha: number;
    /** 占领区整体再叠一层控制者颜色的淡色 */
    fill: number;
    frontWidthPx: number;
    frontAlpha: number;
    frontGlowPx: number;
    frontGlowAlpha: number;
    /** 争夺区虚线：一段的长度（像素）、流动速度（像素/秒） */
    dashPx: number;
    dashSpeed: number;
    emissive: number;
  };

  /**
   * 城市（map/cities.tsx）：文字色、圆点色、首都星标色、文字描边（阴影）色、
   * 文字发光强度（0 不发光）、字号倍数
   */
  cities: { text: Rgb; dot: Rgb; capital: Rgb; halo: Rgb; glow: number; fontScale: number };

  /**
   * 铁路（map/railways.tsx）。颜色取经营方政权在 political.colors 里的颜色，乘以 ownerShade
   * （写实风格调暗成深色线条，态势图风格保持原色发亮）；dashPx > 0 时画传统地图的铁路符号
   * （外沿 casing 色，里面按 dashPx 像素一段，经营方颜色与 dashColor 交替）；
   * 焦点线路加 glow 光晕，flowPxPerSec > 0 时有光点沿线流动。
   */
  railways: {
    ownerShade: number;
    casing: Rgb;
    widthPx: number;
    alpha: number;
    dashPx: number;
    dashColor: Rgb;
    glowPx: number;
    glowAlpha: number;
    /** 焦点线路的线宽倍数、光晕强度 */
    focusWidth: number;
    focusGlowAlpha: number;
    flowPxPerSec: number;
  };

  /** 国家、地区名（map/regions.tsx）：文字色、描边色、发光强度 */
  regions: { text: Rgb; halo: Rgb; glow: number };

  /**
   * 事件层（events/）：进攻箭头按阵营着色，航线（没有阵营的路线）单独一色；
   * 箭头、战线的线宽和光晕；事件地点光晕的颜色；地名标注的文字色。
   */
  events: {
    actors: { japan: Rgb; manchukuo: Rgb; china: Rgb; soviet: Rgb; other: Rgb };
    route: Rgb;
    arrowWidthPx: number;
    arrowGlowPx: number;
    arrowGlowAlpha: number;
    frontline: Rgb;
    frontlineWidthPx: number;
    frontlineGlowPx: number;
    frontlineGlowAlpha: number;
    pulse: Rgb;
    placeText: Rgb;
    placeHalo: Rgb;
  };

  /** 画面上的界面（字幕卡片、标题、状态条、图例）：底板色和不透明度、文字、次要文字、强调色、边框、发光 */
  ui: {
    panel: Rgb;
    panelAlpha: number;
    text: Rgb;
    muted: Rgb;
    accent: Rgb;
    border: Rgb;
    borderAlpha: number;
    glow: number;
  };
};
