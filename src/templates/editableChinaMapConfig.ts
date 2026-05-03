// EditableChinaProvinceMap 的配置入口。
// 这个模板使用真实 GeoJSON 行政区多边形，不是贴图；每个省份/地区都可按名称单独填色。

export const editableChinaMapConfig = {
  geoJsonSrc: "geojson/china-provinces-full.json",

  title: "中国省级区块地图",
  subtitle: "真实 GeoJSON 多边形，可独立填色和高亮",

  backgroundColor: "#07111f",
  seaColor: "#0f2a44",
  defaultFill: "#7da36f",
  defaultStroke: "#f8f2df",
  defaultStrokeWidth: 1.4,

  // 按 GeoJSON properties.name 匹配。没有配置的省份使用 defaultFill。
  regionColors: {
    北京市: "#d9b76e",
    天津市: "#c49a6c",
    河北省: "#8eaa73",
    山西省: "#9c8f68",
    内蒙古自治区: "#b4a06a",
    辽宁省: "#9bb6c7",
    吉林省: "#8fb2bd",
    黑龙江省: "#80a7b5",
    上海市: "#e8d8a8",
    江苏省: "#d1be78",
    浙江省: "#c9a86a",
    安徽省: "#a9b878",
    福建省: "#b88f73",
    江西省: "#a0ad71",
    山东省: "#b79b6a",
    河南省: "#b0a36c",
    湖北省: "#9fb070",
    湖南省: "#a6ad69",
    广东省: "#bd8c74",
    广西壮族自治区: "#9ab071",
    海南省: "#d0b271",
    重庆市: "#a5866c",
    四川省: "#8fa66e",
    贵州省: "#8aa06a",
    云南省: "#839a70",
    西藏自治区: "#7da36f",
    陕西省: "#a99768",
    甘肃省: "#b7a06b",
    青海省: "#8ea5a8",
    宁夏回族自治区: "#c0a56f",
    新疆维吾尔自治区: "#7da36f",
    台湾省: "#f8fafc",
    香港特别行政区: "#e5e7eb",
    澳门特别行政区: "#e5e7eb",
  },

  // 高亮地区：可用于争议区、战争区、重点说明。
  // 渲染方式是“区域内部横向虚线铺满”，不是浮在地图上的外框。
  highlightRegions: ["西藏自治区", "新疆维吾尔自治区", "台湾省"],
  highlightColor: "#facc15",
  highlightStrokeWidth: 4,
  hatchLineColor: "#facc15",
  hatchLineWidth: 2,
  hatchGap: 8,
  hatchOpacity: 0.72,
  hatchAngle: 0,

  // 标注开关和样式。
  showLabels: true,
  labelColor: "#f8fafc",
  labelStroke: "#07111f",
  labelFontSize: 18,

  // 视图和动画。
  mapScale: 0.92,
  mapTranslateX: 0,
  mapTranslateY: 8,
  introFrames: 42,
};
