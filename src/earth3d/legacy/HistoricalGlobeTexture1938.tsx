import { EditableHistoricalWorldGlobe } from "../engine/EditableHistoricalWorldGlobe";
import type { EditableHistoricalGlobeProps } from "../engine/EditableHistoricalWorldGlobe";

export type HistoricalGlobeTexture1938Props = {
  title?: string;
  subtitle?: string;
  startLongitude?: number;
  rotationDegreesPerFrame?: number;
  projectionScale?: number;
  projectionTranslateX?: number;
  projectionTranslateY?: number;
  showLabels?: boolean;
};

// HistoricalGlobeTexture1938 的唯一参数入口。
// 重要：虽然 Composition 名字里还保留 Texture，但这里已经不是 JPG 贴图逻辑。
// 地图来自 public/geojson/historical-world-1938.geojson，每个国家/地区都是可编辑 polygon。
// 以后要调颜色、争议区斜线、战争线、城市、旋转速度，优先只改本文件。
const historicalGlobeTexture1938Config: EditableHistoricalGlobeProps = {
  geoJsonSrc: "geojson/historical-world-1938.geojson",
  overlayGeoJsonSrc: "geojson/china-provinces-full.json",

  title: "1938 世界历史矢量地球",
  subtitle: "国家区块可编辑填色，争议区斜线被地块边界裁切",

  backgroundColor: "#07111f",
  oceanColor: "#0d2740",
  globeShadowColor: "rgba(0,0,0,0.42)",
  showGraticule: false,
  graticuleColor: "rgba(191,219,254,0.18)",
  borderColor: "rgba(248,250,252,0.78)",
  borderWidth: 0.62,
  coastGlowColor: "rgba(255,255,255,0.22)",

  // 300 帧旋转 360 度：首尾角度一致，适合无缝循环。
  loopFrames: 300,
  startLongitude: -104,
  rotationDegreesPerFrame: 360 / 300,
  tiltLatitude: -12,
  projectionScale: 292,
  projectionTranslateX: 0,
  projectionTranslateY: 12,

  // SUBJECTO 是主导国/宗主国字段；殖民地、傀儡国、特殊地区默认继承主导国颜色。
  // NAME 是实际地块名；适合用来单独指定争议区、战争区、标签。
  governingField: "SUBJECTO",
  regionNameField: "NAME",

  // 名称归并：这里决定哪些特殊地块按哪个主导国上色。
  governingAliases: {
    Tibet: "Chinese warlords",
    Xinjiang: "Chinese warlords",
    "United Kingdom of Great Britain and Ireland": "United Kingdom",
  },

  // 主导国专属颜色。这里优先级最高，适合按钢铁雄心风格手工调色。
  // 未列出的主导国会由组件自动生成稳定的唯一颜色，不会全部挤到同一个默认色。
  subjectColorOverrides: {
    "Chinese warlords": "#b79a5b",
    "Empire of Japan": "#f5f0df",
    USSR: "#8f1d1d",
    Germany: "#5f6772",
    Italy: "#6d8b5f",
    France: "#3e76b5",
    "United Kingdom": "#b44b55",
    "United States": "#4d8f79",
    Spain: "#c29a4a",
    Poland: "#9a6fb0",
    Czechoslovakia: "#5d9b89",
    Romania: "#b38647",
    Turkey: "#7b8f52",
    Mongolia: "#8b5d4f",
    Siam: "#a76d89",
    India: "#c29b68",
  },
  hoiFallbackPalette: [
    "#8aa06a",
    "#b98d5f",
    "#6f91a8",
    "#a46f6a",
    "#9d8f58",
    "#6d8f7a",
    "#8c79a8",
    "#b3a160",
    "#5f8f9a",
    "#a87855",
    "#758d5f",
    "#9a6a7b",
    "#6f7fa8",
    "#b0a36c",
    "#7e9872",
    "#a7856c",
    "#7494a3",
    "#987a9f",
  ],
  defaultFill: "#7f8f68",

  // 争议/特殊地块：用同一块地的 polygon 叠加 pattern。
  // 因此横向虚线只会出现在该地块内部，不会浮在地球外面。
  hatchRegionNames: ["Spanish Sahara", "Mandatory Palestine (GB)"],
  hatchSubjectNames: [],
  // 中国省级叠加层。这里使用真实省份 GeoJSON 的 properties.name 匹配，
  // 斜线底纹会按省份边界裁切，和省份填色的原理一致。
  // 注意：这里只能放“需要底纹”的省份，不能放全部省份。
  overlayHatchRegionNames: ["西藏自治区", "新疆维吾尔自治区"],
  hatchLineColor: "#facc15",
  hatchLineWidth: 1.6,
  hatchGap: 8,
  hatchOpacity: 0.68,
  hatchAngle: 0,
  hatchStrokeColor: "#facc15",
  hatchStrokeWidth: 1.8,

  // 不再用经纬度框/折线表示战争区，避免出现“浮在地图上的方框”。
  // 战区底纹改用上面的 hatchRegionNames / overlayHatchRegionNames，按真实地块 polygon 裁切。
  frontLines: [],

  // 地形图层：仍然是矢量经纬度线，不是图片。
  terrainLines: [
    {
      id: "himalaya",
      label: "喜马拉雅山脉",
      points: [
        [74, 35],
        [82, 31],
        [90, 29],
        [97, 28],
      ],
      color: "rgba(255,255,255,0.35)",
      width: 1.2,
      dash: "3 5",
    },
    {
      id: "ural",
      label: "乌拉尔山脉",
      points: [
        [58, 67],
        [60, 58],
        [58, 51],
      ],
      color: "rgba(255,255,255,0.24)",
      width: 1,
      dash: "2 6",
    },
  ],

  cities: [
    { label: "北京", lon: 116.4074, lat: 39.9042, color: "#fde68a" },
    { label: "南京", lon: 118.7969, lat: 32.0603, color: "#fde68a" },
    { label: "东京", lon: 139.6917, lat: 35.6895, color: "#ffffff" },
    { label: "莫斯科", lon: 37.6173, lat: 55.7558, color: "#fecaca" },
    { label: "柏林", lon: 13.405, lat: 52.52, color: "#e5e7eb" },
    { label: "伦敦", lon: -0.1278, lat: 51.5074, color: "#bfdbfe" },
    { label: "马德里", lon: -3.7038, lat: 40.4168, color: "#fed7aa" },
  ],
  cityDotRadius: 3.2,
  cityLabelColor: "#f8fafc",
  cityLabelStroke: "#07111f",
  cityLabelFontSize: 14,

  showLabels: true,
  labelNames: [
    "Chinese warlords",
    "Empire of Japan",
    "USSR",
    "Germany",
    "Italy",
    "France",
    "United Kingdom",
    "United States",
    "Tibet",
    "Xinjiang",
  ],
  labelColor: "#f8fafc",
  labelStroke: "#07111f",
  labelFontSize: 13,

  introFrames: 42,
};

export const HistoricalGlobeTexture1938 = ({
  title = historicalGlobeTexture1938Config.title,
  subtitle = historicalGlobeTexture1938Config.subtitle,
  startLongitude = historicalGlobeTexture1938Config.startLongitude,
  rotationDegreesPerFrame = historicalGlobeTexture1938Config.rotationDegreesPerFrame,
  projectionScale = historicalGlobeTexture1938Config.projectionScale,
  projectionTranslateX = historicalGlobeTexture1938Config.projectionTranslateX,
  projectionTranslateY = historicalGlobeTexture1938Config.projectionTranslateY,
  showLabels = historicalGlobeTexture1938Config.showLabels,
}: HistoricalGlobeTexture1938Props) => {
  return (
    <EditableHistoricalWorldGlobe
      {...historicalGlobeTexture1938Config}
      title={title}
      subtitle={subtitle}
      startLongitude={startLongitude}
      rotationDegreesPerFrame={rotationDegreesPerFrame}
      projectionScale={projectionScale}
      projectionTranslateX={projectionTranslateX}
      projectionTranslateY={projectionTranslateY}
      showLabels={showLabels}
    />
  );
};
