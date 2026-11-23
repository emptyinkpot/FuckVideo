# earth3d：地球模块

项目里所有和地球有关的源码、预处理脚本、数据和说明都集中在 `src/earth3d/`。模块外的代码只从 `src/earth3d/index.ts` 引用。

项目里只有这一套地球。原来的照片贴图光球、SVG 矢量地球、平面照片世界地图（`EarthGlobe`、`HistoricalGlobeTexture1938`、`AtlasMapFlyover`）和它们用的数据都已删除，各处改用这里的三维地球。

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
- **起伏光照**：
  - 细法线：每个分块带一张 256×256 坡度图（分块所在级别的高程数据），比网格顶点细，远处的山脊、沟谷在光照上依然锐利。
  - 山体投影：每个分块带一张 64×64 的 8 方向地平线图（每点向北、东北……看出去最高地形的仰角，搜索半个分块宽，计入地球曲率）。着色器拿太阳方位和高度跟地平线比较，被山挡住的地方没有直射光，边缘留 3° 半影。
  - 天空可见度：8 个方向 cos²(地平线仰角) 的平均，谷底接收的天光少，阴天、高太阳时也有体积感。
  - 贴地图层用同一套光照，着色区域里的山也有阴影。
  - 默认太阳：近处 18°，远处升到 60°；想要更强的立体感，把 `sun.elevationDeg` 设到 10-12°。
- **天空和大气**：低空是蓝天，升到太空后变为星空，地球边缘有受光一侧的大气辉光。空气透视分波长计算：蓝光衰减和散射都更强，远山逐渐偏蓝灰；朝太阳方向看时，前向散射让空气发亮。
- **图层**：国界、控制区着色、战线、进攻箭头、地名都是叠加在基础地球上的独立图层，见下方“分层”。
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
| 战线、进攻箭头、控制区着色、城市和地名标签 | 完成 |
| `SinoJapaneseWarDemo`（中日战争成片）改用新地球 | 完成 |
| `EarthFlyover`（路线飞越，替代平面照片地图的 `AtlasMapFlyover`） | 完成 |
| `EarthBackdrop`（讲解视频背景，替代平面照片世界地图） | 完成 |
| 预览组合 `Earth3DPreview`（默认镜头从太空降到南京上空） | 完成 |
| 旧地球、旧地图动画及其数据 | 已删除 |

### 已知问题

- 真实比例下，几十公里外看一两千米的山起伏不大。地形数据本身没有问题，开 2.5 倍高度夸张时山体很清楚。
- 地平线图的采样间距是分块宽度的 1/64（第 9 级约 1 公里），一公里以内的小山包、小沟不产生投影，只有坡面明暗。
- 远景（几千公里）下真实比例的山体起伏仍然不明显。
- 城市街网过于规整，没有城墙、河道穿城和成片绿地；城区外缘是按城市规模生成的不规则圆形。
- 地表分类在 300 米尺度上能看出成块的轮廓。
- 里海在 Natural Earth 海洋数据里算作海洋，水面按海平面 0 米画（实际约 -28 米），沿岸低地会被淹没一圈。
- 控制区着色用的是现代省界和 1938 年世界格局底图，按省整块着色，不是精确的历史占领线（史料库 `geometryPolicy` 里有说明）。
- 1938 年底图里的“日本帝国”（本土、朝鲜、台湾等）在所有年份都按日本着色，包括 1945 年投降之后。

## 分层

```txt
基础地球（globe/）       地形、地表、海洋湖泊、河流、建筑、天空大气。不知道任何图层的存在。
  └─ 图层（layers/）     每个图层按需提供三种内容中的任意几种：
       decal             贴地内容：一张经纬度透明图，单独一遍画在地形表面上，随地形明暗
       objects           三维对象：国界线、战线、箭头
       labels            画面文字：地名，HTML 放在三维位置的投影处
画面（view/EarthView）   三维画布 + 文字层；按渲染通道分层导出
成片（scenes/）          只负责组装：镜头 + 基础地球 + 图层 + 字幕卡片
```

现有图层：

| 图层 | 工厂函数 | 内容 |
|---|---|---|
| 1938 年国界 | `bordersLayer()` | 三维对象 |
| 控制区着色 | `territoryLayer({ dataset, date, next })` | 贴地内容，两个日期之间可渐变 |
| 战线 | `frontlinesLayer({ lines })` | 三维对象，贴地 |
| 进攻箭头 | `arrowsLayer({ arrows, progress })` | 三维对象，贴地，按进度生长 |
| 地名 | `placeLabelsLayer({ places, style })` | 画面文字 |

新图层只需实现 `layers/types.ts` 里的 `EarthLayer`：`id`、`order`、`opacity`，以及 `decal`、`objects`、`labels` 中需要的几个。每个函数在每次渲染时调用，地形分块加载完成后会重新调用，贴地的线条随之按新高度重建。

贴地内容的实现：用地形网格再画一遍，顶点着色器与地形完全相同，深度一致，配合 LessEqual 深度比较贴在地表上；颜色按地形的阳光、天光、陡坡明暗受光，再加空气透视。

### 分层导出

成片都有 `pass` 参数：

| pass | 内容 | 背景 |
|---|---|---|
| `full` | 完整画面 | 不透明 |
| `globe` | 只有基础地球 | 不透明 |
| `overlay` | 只有图层的贴地内容和三维对象；地形只写深度，山后的线条照样被挡住 | 透明 |
| `labels` | 只有地名、标题、信息卡、进度条；地形照常加载，文字位置与完整画面一致 | 透明 |

`globe`、`overlay`、`labels` 三层依次叠起来与 `full` 一致（实测平均每像素差 0.09/255，只在抗锯齿边缘有差别）。透明背景要用支持透明的格式导出：

```bash
npx remotion render src/index.ts SinoJapaneseWarDemo out/war-overlay.mov --gl=angle \
  --image-format=png --codec=prores --prores-profile=4444 --props='{"pass":"overlay"}'
```

各图层也可以单独开关，Studio 右侧面板里勾选（`layers` 参数），例如关掉国界、只留控制区和箭头。

## 内存

| 缓存 | 上限 | 位置 |
|---|---|---|
| 解压后的地形分块数据 | 256MB，按最近使用淘汰，当前帧用到的不淘汰 | `globe/terrain/tileStore.ts` |
| 地形、水面网格和坡度、地平线、地表分类纹理（显存） | 512MB，同上；上传显卡后释放内存里的副本 | `globe/terrain/chunkMesh.ts` |
| 控制区叠加图 | 最近 4 张（每张约 32MB） | `layers/territory.ts` |
| 城市建筑 | 最近 4 座城市；城市离开画面时释放显卡实例数据 | `globe/buildings/cityBuildings.ts` |
| 贴地线条几何 | 每条只留最新一份，地形变化重建时释放旧的 | `layers/geometryCache.ts` |

实测：从太空降到南京上空的 300 帧镜头，网格缓存在第 270 帧达到上限后开始淘汰，不再继续增长。

## 目录结构

```txt
src/earth3d/
  README.md                 本文件
  index.ts                  对外唯一出口
  webpackOverride.mjs       .e3d、.bin、.geojson 数据文件的打包规则（remotion.config.ts 和 tests/verify-upstream.mjs 共用）
  core/
    geo.ts                  比例尺、经纬度与场景坐标换算、瓦片范围
    camera.ts               地理相机（目标点、距离、俯仰、朝向）、镜头过渡、太阳方位
    webpack-context.d.ts    require.context 与数据文件的类型声明
  globe/                    基础地球
    GlobeScene.tsx          场景组装：摆相机、选块加载、画地形水面河流建筑天空，再画图层
    terrain/
      tileStore.ts          分块加载（gzip 解压）、截图等待与放行、按经纬度取高度和水面
      selectTiles.ts        四叉树选块：按屏幕误差细分，视锥外和地平线后剔除
      chunkMesh.ts          单个分块的地形网格（含裙边）、水面网格、地表分类纹理
    materials/
      earthUniforms.ts      所有材质共享的相机、太阳、雾、时间参数
      shaderChunks.ts       噪声、空气透视、光照、起伏光照（细法线、阴影、天空可见度）的 GLSL 片段
      terrainMaterial.ts    地表着色器（分类着色、农田、村庄、城区、岩石、积雪）
      decalMaterial.ts      贴地图层的材质（每个分块一份，光照与地表一致）
      waterMaterial.ts      海洋湖泊水面
      riverMaterial.ts      河流
      skyMaterials.ts       天空、太空大气辉光、星空
    water/rivers.ts         河网加载与带状网格
    buildings/              城市建筑生成（街网、院落、联排房）与房屋材质
  layers/                   图层
    types.ts                图层接口、渲染通道
    borders.tsx             1938 年国界
    territory.ts            控制区着色（按日期从史料库生成贴地叠加图）
    warLayers.tsx           战线、进攻箭头图层
    warLines.ts             战线、箭头的贴地几何与箭头材质
    geoLines.ts             贴地带状线（按像素宽度）的几何与材质
    geometryCache.ts        贴地几何缓存（地形变化时重建，旧的立即释放）
    placeLabels.tsx         地名图层
  view/
    EarthView.tsx           三维画布 + 文字层，渲染通道，缺地形数据时的提示
    screenProjection.ts     经纬度投影到画面坐标
  scenes/                   成片
    SinoJapaneseWarDemo.tsx 1931–1945 中日战争
    EarthFlyover.tsx        路线飞越（自动场景系统、多场景视频也在用）
    EarthBackdrop.tsx       讲解视频的地球背景（只有基础地球）
    Earth3DPreview.tsx      新地球预览
  history/                  史料库（字段说明见 history/README.md）
    datasets/               史实数据
    wars/sinoJapaneseWar.ts 中日战争成片的配置：事件顺序、镜头规则、阵营颜色、城市、国家名
  data/                     地理边界：1938 年世界格局、中国省界
  pipeline/                 数据预处理（Python）
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
    relief.py               坡度图、8 方向地平线图（细法线、山体投影、天空可见度）
    build_all.py            按顺序跑完以上全部步骤，最后与 assets.sha256 核对
    manifest.py             生成、核对 assets.sha256
    requirements.txt        固定版本的 Python 依赖
    inputs.lock.json        河流、湖泊、海洋、城市矢量数据的锁定校验值
  assets/                   生成的渲染数据
    cities.json, rivers.bin, borders-1938.bin, tiles.json   小文件，提交在仓库里
    tiles/                  地形分块，约 775MB，不提交，由脚本重建
  assets.sha256             assets 下每个文件的校验值（解压后内容），用来确认重建结果一致
  .cache/                   原始下载缓存和 Python 虚拟环境，约 2.8GB（不提交）
```

## 数据来源

| 数据 | 来源 | 用途 | 署名要求 |
|---|---|---|---|
| 高程 | Mapzen Terrain Tiles（AWS Open Data，Terrarium 编码；包含 SRTM、ETOPO1、GMTED2010 等） | 地形、海底 | 需按 <https://github.com/tilezen/joerd/blob/master/docs/attribution.md> 署名 |
| 地表分类 | ESA WorldCover 2021 v200 | 地表上色 | © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021)，CC BY 4.0 |
| 河流 | HydroRIVERS v1.0（亚洲、西伯利亚） | 河道、宽度 | Lehner & Grill 2013，需署名 |
| 湖泊、海洋、城市 | Natural Earth 10m | 水面范围、城市位置 | 公有领域 |
| 1938 国界 | `src/earth3d/data/historical-world-1938.geojson`（源自 historical-basemaps，GPL-3.0） | 国界、控制区着色底图 | 见 `asset-source/historical-basemaps/` |
| 中国省界 | `src/earth3d/data/china-provinces.geojson`（现代省级区块） | 控制区着色 | — |

使用新地球的视频需要在片尾附上述署名。

WorldCover 是 2021 年的地表数据。现代建成区按耕地处理，1937 年时的城区按 `build_cities.py` 里的城市轮廓重新标记；1937 年后修建的水库（如三峡、丹江口、新安江）按陆地处理。

## 重建数据

仓库里提交了城市、河流、国界这几个小数据文件；地形分块（约 775MB）不提交，克隆后要用脚本重建。没有地形分块时，其他动画照常可用，`Earth3DPreview` 会在画面上提示运行重建脚本。

脚本使用 `.cache/venv` 里的独立 Python 3.13 环境，依赖版本固定在 `pipeline/requirements.txt`。默认 PyPI 源安装 `rasterio` 时可能卡住，可以改用镜像源：

```bash
uv venv -p 3.13 src/earth3d/.cache/venv
uv pip install -p src/earth3d/.cache/venv/Scripts/python.exe --index-url https://pypi.tuna.tsinghua.edu.cn/simple -r src/earth3d/pipeline/requirements.txt
```

全部重建（下载约 3GB，耗时约一小时，每一步都能断点续跑）：

```bash
cd src/earth3d/pipeline
../.cache/venv/Scripts/python.exe build_all.py
```

最后一步会把生成的每个文件和 `assets.sha256` 逐个核对，输出 `assets identical to manifest` 就说明和仓库作者的数据完全一致。数据来源都是固定版本：高程瓦片、ESA WorldCover 2021 v200、HydroRIVERS v1.0 不再更新；Natural Earth 的下载地址指向最新版，`fetch_vectors.py` 会对照 `inputs.lock.json` 核对，对方发布新版本时会停下说明，不会悄悄算出不同的结果。

有意修改了数据处理后，重建并运行 `python manifest.py write` 更新校验清单，再一起提交。

`assets/tiles/` 和 `.cache/` 可以随时整个删掉后重建。

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

## 战争成片（SinoJapaneseWarDemo）

- 事件按日期排序，每个事件 5 秒：前 3.5 秒停在事件镜头上缓慢推近，箭头在这段时间里长出来；后 1.5 秒飞往下一个事件，控制区着色同时渐变到下一个日期的状态。
- 开头 3 秒从太空降到第一个事件。
- 事件镜头取自史料里的 `camera.focus` 和 `camera.zoom`：距离为 `1500 × (2.3 / zoom)³` 公里，俯仰 38°。
- 着色、战线、箭头都来自史料库，城市、国家名、阵营颜色、镜头规则在 `history/wars/sinoJapaneseWar.ts`，成片组件里不写任何归属。史料数据有缺字段、引用不存在的区域等问题时，渲染前直接报错。
- `layers` 参数逐个开关河流、国界、控制区、战线、箭头、城市名、国家名；`pass` 参数分层导出。

## 史料编辑

中日战争数据集在 `history/datasets/sino-japanese-war.ts`。新增史实时补齐：

- `regions`：地块 ID、名称、别名、几何引用
- `ownership`：时段内的控制方、主权方、状态、可信度、来源
- `events`：日期、参与方、镜头、箭头、战线、标签
- `sources`、`confidence`、`note`

地块颜色只由 `ownership` 和渲染规则决定，不要写进 Composition。字段细节见 `history/README.md`。

## 验证

```bash
npm run lint                      # eslint + tsc
npm run verify:upstream           # 打包并给每个组合渲染一帧
```
