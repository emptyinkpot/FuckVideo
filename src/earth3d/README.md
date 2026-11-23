# earth3d：地球模块

项目里所有和地球有关的源码、预处理脚本、数据和说明都集中在 `src/earth3d/`。模块外的代码只从 `src/earth3d/index.ts` 引用。

## 新地球的表现形式

新地球是按真实比例建模的三维地球，1 个单位等于 1 公里，地球半径 6371。地表不用照片或画好的贴图。

- **地形**：真实三维网格。顶点按真实高程抬高或压低，比例 1:1，默认不夸张（`exaggeration` 参数可调）。
- **地表颜色**：由 GPU 着色器逐像素计算。依据是地表类型（林地、耕地、草地、裸地、冰雪、湿地等）、海拔、坡度和纬度。地表分类以数据纹理的形式传给 GPU，里面存的是分类编号，不会作为图片显示。近处由程序生成的细节接替：
  - 农田：成片的长条形田块
  - 村庄：农田里大约每 1.3 公里一个
  - 城区：旧城的胡同、街道和瓦顶
- **水**：海洋、湖泊、河流都是独立的三维水面网格。
  - 海洋颜色按真实海底深度渐变，近岸偏浑浊。
  - 湖泊有各自的水位。
  - 河流沿真实河道铺设，宽度按流量计算。
  - WorldCover 标为水体的河道和池塘也按水面着色。
- **建筑**：按城市位置和 1930 年代人口程序生成。
  - 中国城市：东西向胡同、四合院式地块（北正房、东西厢房、临街倒座房）。
  - 大城市中心：联排房屋和零星的多层楼。
  - 相机高度低于约 6.5 公里时开始出现，从地面逐渐升起。
- **天空和大气**：低空是蓝天和空气透视，升到太空后变为星空，地球边缘有受光一侧的大气辉光。
- **国界**：1938 年陆上国界，贴着地面起伏，按像素宽度绘制。
- **精度分级**：整个地球切成四叉树分块，镜头近处细、远处粗。所有分块用同一套数据、同一套生成方法、同一个材质，接缝处用裙边遮挡，边缘法线用分块外多存的一圈采样点计算。不存在局部贴片，镜头对准哪里都不会改变地图本身。

全球统一细分到第 5 级。战区范围（东经 97–146°，北纬 18–54°）细分到第 9 级，最细一级的网格点间距约 240 米，与高程数据本身的分辨率一致。

## 当前状态

| 部分 | 状态 |
|---|---|
| 源码集中到本目录，旧的局部贴片方案已删除 | 完成 |
| 数据预处理（高程、地表分类、水域、湖泊水位、河流、城市、国界、分块） | 完成 |
| 地形分块、精度分级、地表着色、水面、河流、天空大气 | 完成 |
| 1930 年代城市建筑、村庄、农田 | 完成，见下方已知问题 |
| 1938 年国界 | 完成 |
| 预览组合 `Earth3DPreview`（Root 中注册，默认镜头从太空降到南京上空） | 完成 |
| 战线、进攻箭头、占领区着色、城市和地名标签 | 未开始 |
| `compositions/SinoJapaneseWarDemo.tsx` 接入新地球 | 未开始，目前仍使用 `legacy/` 里的矢量地球 |

### 已知问题

- 真实比例下，几十公里外看一两千米的山起伏不大。地形数据本身没有问题，开 2.5 倍高度夸张时山体很清楚。
- 没有投射阴影，山体立体感只靠坡面明暗。
- 城市街网过于规整，没有城墙、河道穿城和成片绿地；城区外缘是按城市规模生成的不规则圆形。
- 地表分类在 300 米尺度上能看出成块的轮廓。
- 里海在 Natural Earth 海洋数据里算作海洋，水面按海平面 0 米画（实际约 -28 米），沿岸低地会被淹没一圈。

## 目录结构

```txt
src/earth3d/
  README.md                 本文件
  index.ts                  对外唯一出口
  EarthScene.tsx            场景组装：按镜头摆相机、选块加载、画地形水面河流建筑天空国界
  core/
    geo.ts                  比例尺、经纬度与场景坐标换算、瓦片范围
    webpack-context.d.ts    require.context 与 .bin 资源的类型声明
  terrain/
    tileStore.ts            分块加载（gzip 解压）、截图等待与放行、按经纬度取高度和水面
    selectTiles.ts          四叉树选块：按屏幕误差细分，视锥外和地平线后剔除
    chunkMesh.ts            单个分块的地形网格（含裙边）、水面网格、地表分类纹理
  materials/
    earthUniforms.ts        所有材质共享的相机、太阳、雾、时间参数
    shaderChunks.ts         噪声、空气透视、光照的 GLSL 片段
    terrainMaterial.ts      地表着色器（分类着色、农田、村庄、城区、岩石、积雪）
    waterMaterial.ts        海洋湖泊水面
    riverMaterial.ts        河流
    skyMaterials.ts         天空、太空大气辉光、星空
  water/
    rivers.ts               河网加载与带状网格
  buildings/
    cityBuildings.ts        城市建筑生成（街网、院落、联排房）
    buildingMaterial.ts     房屋网格与材质
  overlays/
    geoLines.ts             贴地带状线（按像素宽度），国界和后续的战线共用
    borders.ts              1938 年国界
    FrontlineLayer.tsx      旧矢量地球用的战线、箭头
  camera/
    geoCamera.ts            地理相机（目标点、距离、俯仰、朝向）、镜头过渡、太阳方位
    cameraPresets.ts        旧矢量地球用的按事件计算镜头
  compositions/
    Earth3DPreview.tsx      新地球预览
    SinoJapaneseWarDemo.tsx 1931–1945 中日战争成片
  history/                  史料库与战争时间线（字段说明见 history/README.md）
  legacy/                   旧的地球实现，现有模板仍在使用
    EditableHistoricalWorldGlobe.tsx   d3-geo 正交投影的 SVG 矢量地球
    HistoricalGlobeTexture1938.tsx     1938 世界格局（基于上面的矢量地球）
    EarthGlobeTemplate.tsx             照片贴图的光球模板（Root 中的 EarthGlobe）
  scripts/                  数据预处理（Python）
    config.py               路径、数据源、战区范围、各级网格大小
    dem.py                  高程瓦片双线性取样、SRTM 空洞去坑
    fetch_dem.py            下载高程瓦片
    fetch_vectors.py        下载河流、湖泊、海洋、城市矢量数据
    fetch_landcover.py      读取 ESA WorldCover 地表分类（只读云端 COG 的缩略层级）
    build_cities.py         1930 年代城市表（位置、人口、城区轮廓）
    build_masks.py          海洋、湖泊掩码和湖泊水位；1937 年后修建的水库按陆地处理
    build_rivers.py         河流（平滑、按流量定宽、水面不往下游爬升）
    build_borders.py        1938 年陆上国界
    build_tiles.py          渲染分块
    build_all.py            按顺序跑完以上全部步骤
  assets/                   生成的渲染数据，约 415MB（不提交）
  .cache/                   原始下载缓存和 Python 虚拟环境，约 2.8GB（不提交）
```

## 数据来源

| 数据 | 来源 | 用途 | 署名要求 |
|---|---|---|---|
| 高程 | Mapzen Terrain Tiles（AWS Open Data，Terrarium 编码；包含 SRTM、ETOPO1、GMTED2010 等） | 地形、海底 | 需按 <https://github.com/tilezen/joerd/blob/master/docs/attribution.md> 署名 |
| 地表分类 | ESA WorldCover 2021 v200 | 地表上色 | © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021)，CC BY 4.0 |
| 河流 | HydroRIVERS v1.0（亚洲、西伯利亚） | 河道、宽度 | Lehner & Grill 2013，需署名 |
| 湖泊、海洋、城市 | Natural Earth 10m | 水面范围、城市位置 | 公有领域 |
| 1938 国界 | `public/geojson/historical-world-1938.geojson`（源自 historical-basemaps，GPL-3.0） | 国界 | 见 `asset-source/historical-basemaps/` |

使用新地球的视频需要在片尾附上述署名。

WorldCover 是 2021 年的地表数据。现代建成区按耕地处理，1937 年时的城区按 `build_cities.py` 里的城市轮廓重新标记；1937 年后修建的水库（如三峡、丹江口、新安江）按陆地处理。

## 重建数据

脚本使用 `.cache/venv` 里的独立 Python 环境，需要 `rasterio`、`pyshp`、`numpy`、`pillow`、`shapely`、`requests`。默认 PyPI 源安装 `rasterio` 时可能卡住，可以改用镜像源：

```bash
uv venv -p 3.13 src/earth3d/.cache/venv
uv pip install -p src/earth3d/.cache/venv/Scripts/python.exe --index-url https://pypi.tuna.tsinghua.edu.cn/simple rasterio pyshp numpy pillow shapely requests
```

全部重建（下载约 3GB，耗时约一小时，每一步都能断点续跑）：

```bash
cd src/earth3d/scripts
../.cache/venv/Scripts/python.exe build_all.py
```

`assets/` 和 `.cache/` 可以随时整个删掉后重建。

## 预览与调参

`Earth3DPreview` 的参数：

- `view`：单个镜头 `{ lon, lat, rangeKm, pitchDeg, headingDeg }`。`pitchDeg` 为 0 时垂直俯视，越大越倾斜。
- `keyframes`：`[{ frame, camera }]`，镜头在关键帧之间沿大圆过渡，远距离时中途拉高。给了 `keyframes` 就忽略 `view`。
- `sun`：`{ azimuthDeg, elevationDeg }`。不填时按镜头距离自动设置：近处 28°，远处 60°。
- `exaggeration`：地形高度倍数，默认 1（真实比例）。
- `hazeDensity`：雾的浓度，默认 1/140。
- `showRivers`、`showBuildings`、`showBorders`、`pixelError`。

渲染单帧（`--gl=angle` 使用显卡）：

```bash
npx remotion still src/index.ts Earth3DPreview screenshots/earth3d/f0.png --frame=0 --gl=angle
npx remotion still src/index.ts Earth3DPreview screenshots/earth3d/nanjing.png --gl=angle \
  --props='{"keyframes":[],"view":{"lon":118.79,"lat":32.045,"rangeKm":3.2,"pitchDeg":62,"headingDeg":15}}'
```

## 史料编辑

中日战争数据集在 `history/datasets/sino-japanese-war.ts`。新增史实时补齐：

- `regions`：地块 ID、名称、别名、几何引用
- `ownership`：时段内的控制方、主权方、状态、可信度、来源
- `events`：日期、参与方、镜头、箭头、战线、标签
- `sources`、`confidence`、`note`

地块颜色只由 `ownership` 和渲染规则决定，不要写进 Composition。字段细节见 `history/README.md`。

## 旧矢量地球（legacy）

`legacy/EditableHistoricalWorldGlobe.tsx` 是 d3-geo 正交投影的 SVG 矢量地球，`HistoricalGlobeTexture1938` 和 `SinoJapaneseWarDemo` 目前都基于它。主要参数在 `legacy/HistoricalGlobeTexture1938.tsx`：

- `rotationDegreesPerFrame`、`startLongitude`、`tiltLatitude`、`projectionScale`：旋转与视角
- `subjectColorOverrides`、`governingAliases`：归属与颜色
- `hatchRegionNames`、`overlayHatchRegionNames`：底纹区域
- `cities`、`labelNames`：城市和标签

## 验证

```bash
npx tsc --noEmit
npx remotion compositions src/index.ts
```
