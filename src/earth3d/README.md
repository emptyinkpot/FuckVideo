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
- **图层**：国家（按政权涂色、国界）、占领（斜纹、前线、争夺虚线）、铁路、城市、国家名、战线、进攻箭头都是叠加在基础地球上的独立图层，见下方“分层”。
- **精度分级**：整个地球切成四叉树分块，镜头近处细、远处粗。所有分块用同一套数据、同一套生成方法、同一个材质，接缝处用裙边遮挡，边缘法线用分块外多存的一圈采样点计算。不存在局部贴片，镜头对准哪里都不会改变地图本身。

全球统一细分到第 5 级。战区范围（东经 97–146°，北纬 18–54°）细分到第 9 级，最细一级的网格点间距约 240 米，与高程数据本身的分辨率一致。

## 当前状态

| 部分 | 状态 |
|---|---|
| 源码集中到本目录，旧的局部贴片方案已删除 | 完成 |
| 数据预处理（高程、地表分类、水域、湖泊水位、河流、城市、铁路、分块） | 完成 |
| 地形分块、精度分级、地表着色、水面、河流、天空大气 | 完成 |
| 1930 年代城市建筑、村庄、农田 | 完成，见下方已知问题 |
| 政治地理：政权表、区域、领有和控制时间段（1931–1946） | 完成，按省级粒度 |
| 国家层、占领层、战线、进攻箭头、城市和国家名标签 | 完成 |
| 人文图层：国家（政权色、自动国界）、占领（斜纹、前线、争夺虚线、边界推进）、1930 年代城市、1930 年代铁路 | 完成 |
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
- 政治地理按现代省级区块，只能表达大势：日军的“点线占领”按省画会夸大范围；热河、察哈尔、绥远等已撤销的省份无法单独表示；现代内蒙古整块按绥远一带的归属处理。详见 `history/README.md`。
- 1938 年底图不区分朝鲜和日本本土，1945 年投降之后朝鲜仍按日本领有。
- 国家层、占领层贴在地形表面上，海面盖在海底的地形上面：贴着海岸的地方按海面网格的格子呈锯齿状。
- 铁路的经营方只按战前的归属记录（满铁、中东铁路出售等），战时占领区铁路改由日方机构经营（华北交通等）没有逐段记录。
- 铁路走向沿现代路网找出，现代路网改线、截弯取直的地方会和 1930 年代的线路有出入；约 2% 的车站间距离没有对应的现代线路，按直线画。部分区段的通车日期只精确到年（数据里标了 `approx`）。

## 分层

```txt
core/      坐标、镜头
globe/     自然地理基础层：地形、地表、海洋湖泊、河流、建筑、天空大气。不知道任何上层的存在
map/       人文地理层：国家（按政权涂色、国界）、占领、铁路、城市、国家名，全部按日期变化
events/    事件层：战线、进攻箭头、事件光晕、地名标注、航线
layers/    图层接口和公用的贴地线条工具（types.ts、geoLines.ts、geometryCache.ts）
view/      画面组装（EarthView）：自然地理 + 人文地理（按 date 自动加上全部图层）+ 事件 + 文字层；分层导出；风格
scenes/    Remotion 动画：只管镜头、时间线、事件和界面
styles/    风格：与上面各层平行，每个风格覆盖所有层的画法（地形、人文图层、事件、文字、界面）
```

几条约定：

- **所有地球动画都通过 `EarthView` 出画，`EarthView` 必须给 `date`。** 它按日期自动叠上完整的人文地理层（`map/mapLayers.ts`），动画不再自己挑选人文图层；以后新增的人文图层只改 `mapLayers.ts`，所有动画自动带上。
- **所有地球动画共用一组参数**（`scenes/shared.tsx` 的 `EarthSceneProps`，`src/Root.tsx` 的 `earthSceneSchema`）：`style` 风格、`map` 人文地理层开关（河流、国家、占领、铁路、城市、国家名，默认全开）、`pass` 分层导出。单个镜头的动画另有 `date`；动画自己的事件开关在 `events` 里。
- **画法全部来自风格。** 箭头按阵营取色（`events.actors`），航线、战线、事件光晕、地名标注、国家名、字幕卡片、状态条、图例都按风格取色；风格类型要求每一项都填，少一项类型检查就报错。
- **回归测试检查完整性。** `EarthView` 每次挂载时打印它画了哪些人文图层；`tests/verify-upstream.mjs` 逐个组合检查，画了地球却缺任何一个人文图层就失败，原本画地球的组合不再画地球也失败（名单在 `tests/fixtures/earth-compositions.json`）。

目前画地球的组合：`SinoJapaneseWarDemo`、`StrategicMapDemo`、`EarthFlyover`、`Earth3DPreview`、`EarthBackdrop`，以及用到它们的 `NarratedVideo`（讲解背景）、`GeneratedTemplateVideo`（模板默认用战争动画）。`MultiSceneVideo` 的路线飞越场景同样走 `EarthFlyover`。

图层：

| 层 | 图层 | 工厂函数 | 内容 |
|---|---|---|---|
| 人文 | 国家 | `nationsLayer({ date, next })` | 贴地内容：按领有政权涂色，国界从颜色交界处生成，见下方“人文图层” |
| 人文 | 占领 | `occupationLayer({ date, contested, next })` | 贴地内容：控制者颜色的斜纹、前线，争夺区流动虚线 |
| 人文 | 铁路 | `railwaysLayer({ date, focus, only })` | 三维对象，贴地 |
| 人文 | 城市 | `citiesLayer({ date, avoid, reserve })` | 画面文字 |
| 人文 | 国家、政权名 | `regionsLayer({ date })` | 画面文字：当天领有土地的政权；军阀、根据地只在较近的镜头显示 |
| 人文 | 全部人文图层 | `mapLayers(date, options)` | `EarthView` 自动调用 |
| 事件 | 战线 | `frontlinesLayer({ lines })` | 三维对象，贴地 |
| 事件 | 进攻箭头、航线 | `arrowsLayer({ arrows, progress })` | 三维对象，贴地，按进度生长；`actor` 决定颜色 |
| 事件 | 事件光晕 | `pulseLayer({ at, frame, start })` | 画面文字层 |
| 事件 | 地名标注 | `placeLabelsLayer({ places, style })` | 画面文字（城市表里没有的小地方） |

新图层只需实现 `layers/types.ts` 里的 `EarthLayer`：`id`、`order`、`opacity`，以及 `decal`、`objects`、`labels` 中需要的几个。`objects` 拿到的上下文里有当前风格（`context.style`），`labels` 拿到镜头、画面尺寸和风格。每个函数在每次渲染时调用，地形分块加载完成后会重新调用，贴地的线条随之按新高度重建。

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

各图层也可以单独开关，Studio 右侧面板里勾选（`map` 和 `events` 参数），例如关掉国家层、只留占领和箭头。

## 人文图层

国家范围、城市、铁路和自然地理（`globe/`）分开，各自是一个图层，画法都来自风格（`styles/` 的 `political`、`occupation`、`cities`、`railways`、`regions`）。

**全球地块系统**（参考 Paradox 游戏的 province map；数据 `pipeline/build_provinces.py`，前端 `map/provinceStore.ts`）：

- 全世界切成 6955 个固定地块：中国大陆按县（geoBoundaries CHN ADM2，2391 个），世界其他地方（含台港澳）按省、州一级（Natural Earth 一级行政区）。每个地块记代表点、面积、现代中国省份，以及 1930 / 1938 / 1945 年历史世界底图里所属的国家和宗主国。
- 两张地块编号图：全球约 10 公里一像素，东亚（东经 70–150°、北纬 15–56°）约 2.2 公里一像素。不同来源之间的细缝在陆地上按相邻地块补上，海上不补。
- 地块边界线：从编号图抽出相邻地块之间的边（海岸线不算），先简化掉像素台阶再平滑成曲线，每 2 公里取一次地面高度；每条线记两侧的地块。
- 每个日期只算一张“地块 -> 领有者、控制者、状态”的对照表，换日期是瞬间的。世界各国按当年底图的宗主国（殖民地取宗主国，像《钢铁雄心》一样同色）；`history/political/` 里整理的东亚区域按领有、控制时间段覆盖上去（区域展开成地块：中国按现代省份，底图国家按 1938 年国名，手画范围按代表点）。

**国家层**（`map/political.tsx`）：着色器按经纬度取地块、查对照表、从政权色板取颜色，相邻四个像素的颜色双线性混合，交界处没有锯齿。东亚整理的政权逐个配色（日本阵营白色系、国民政府阵营蓝色系、社会主义阵营红色系），世界其他国家按国名从中性色板取，换日期颜色不变。

**国界和前线**（`map/borderLines.tsx`）：从地块边界线里挑出当天两侧不同的，画成按屏幕像素宽度的贴地线，远近都清楚。两侧领有者属于不同国家为国界（粗、可带光晕），同一国家内（中央与军阀）为细线；一侧被占领或争夺、两侧控制者不同为前线，颜色取占领方，占领为实线、争夺为流动虚线。国界属于国家层，前线属于占领层。两个日期之间旧线淡出、新线淡入。

**占领层**（`map/occupation.tsx`）：被占领的地块保留领有者的底色，叠上控制者颜色的斜纹；正在争夺的地块画进攻方颜色的流动虚线（比占领斜纹淡、稀）。斜纹、虚线的间距按屏幕像素，并按 2 的幂分级，推拉镜头不跳。

**国家名**（`map/regions.tsx`）：东亚整理的政权按政权表的位置，当天领有土地的才标；世界其他国家、殖民地按当年底图的国名，位置为其地块的面积加权中心，有中文名、面积够大的才标。

**城市**（`layers/cities.tsx`，数据 `history/places/cities.ts`）：115 座 1930–40 年代东亚城市。

- 按日期显示当时的名字：北平（1928–1949）、奉天（伪满时期）、新京（1932–1945）、京城（1910–1945）、归绥、迪化、安东、石门、宁夏、库伦等；
- 首都按日期标出：国家首都实心星（南京 → 1937-11-20 起重庆）、傀儡政权首都空心星（新京、北平临时政府、汪伪南京、蒙疆张家口）、殖民地首府方形（京城、台北、河内）、根据地中心带圈圆点（延安）；
- 分三级，按镜头距离显示（一级 15000 公里内、二级 3500、三级 1200，超出后淡出）；
- 按重要程度依次摆放，先试圆点右边再试左边，压住别的文字或 `avoid` 矩形（字幕卡片等）就不显示。

**铁路**（`layers/railways.tsx`，数据 `pipeline/railways_source.py` → `assets/railways.bin`、`railways.json`）：31 条 1930 年代干线、62 个区段，包括平汉、津浦、北宁、京沪、沪杭甬、浙赣、粤汉、陇海、胶济、正太、平绥、同蒲、广九、湘桂，东北的南满、安奉、中东、京图、四洮—洮昂—齐北、图佳，朝鲜、台湾、日本的干线，滇越铁路，以及相邻的苏联段。

- 每个区段记通车日期，按日期只显示已通车的；每条线记经营方的变化（中国、日本、满洲国、俄国/苏联、法国），按日期着色；
- 线路走向：相邻车站之间沿 Natural Earth 现代铁路网找最短路径（98% 的车站间距离能找到），找不到或绕路超过 35% 时用直线；
- 写实风格画传统地图的铁路符号（深色外沿、里面黑白相间，段长按屏幕像素）；态势图风格画带光晕的细亮线；
- `focus` 指定焦点线路：更粗、发光，态势图风格下有光点沿线流动。

## 风格

画面风格放在 `styles/`，每个风格一个文件。着色器只读风格参数，不写死任何一种风格：

| 风格 | 文件 | 样子 |
|---|---|---|
| `default` 写实 | `styles/default.ts` | 真实比例地形、真实地表分类、物理天空和空气透视（风格系统建立之前的画面，逐像素一致） |
| `strategic` 态势图 | `styles/strategic.ts` | 地形放大 3.5 倍；西北方向低角度侧光、深阴影；山脊棱线提亮、沟底压暗；统一暗青灰底色；政权底色较浓、国界带光晕；河流换成亮蓝色；远处沉进暗色雾里，四周暗角 |

每个地球组合（战争动画、路线飞越、预览、背景、态势图示例）都有 `style` 参数，Studio 右侧面板里是下拉框。风格参数（`styles/types.ts`）包括：地形高度倍数、自动太阳、地表底色（真实分类或按海拔、坡度的风格化底色）、阳光和天光强度、山脊高光和沟谷压暗、雾的浓度和颜色、天空颜色、水面和河流颜色、贴地图层强度、整体调色和暗角。

新风格：复制一个风格文件改数值，再登记到 `styles/index.ts` 的 `EARTH_STYLES`，下拉框会自动出现。

风格里的 `political`、`occupation` 两节决定国家层和占领层的样子；铁路颜色也取 `political.colors`（写实风格按 `railways.ownerShade` 调暗）。

态势图示例 `StrategicMapDemo`：1937 年平型关战役，12 秒。镜头从高空推近到恒山、五台山之间，日军第 5 师团由灵丘向平型关推进，八路军第 115 师在乔沟一线设伏；顶部状态条、图例、字幕。

## 内存

| 缓存 | 上限 | 位置 |
|---|---|---|
| 解压后的地形分块数据 | 256MB，按最近使用淘汰，当前帧用到的不淘汰 | `globe/terrain/tileStore.ts` |
| 地形、水面网格和坡度、地平线、地表分类纹理 | 内存和显存合计 1GB，按最近使用淘汰，当前帧用到的不淘汰；内存里的数据保留，Studio 新建画布时能重新上传 | `globe/terrain/chunkMesh.ts` |
| 地块对照表、国界和前线几何 | 对照表最近 16 个日期（每个约 28KB）；线条几何最近 48 份 | `map/provinceStore.ts`、`map/borderLines.tsx` |
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
  styles/                   画面风格
    types.ts                风格参数的定义
    default.ts              默认（写实）
    strategic.ts            态势图
    index.ts                风格登记、写入着色器参数、整体调色
  layers/                   图层接口和公用工具
    types.ts                图层接口、渲染通道、文字层拿到的画面信息
    geoLines.ts             贴地带状线（按像素宽度、可带光晕）的几何与材质
    geometryCache.ts        贴地几何缓存（地形变化时重建，旧的立即释放）
  map/                      人文地理层
    mapLayers.ts            某一天的全部人文图层（EarthView 自动调用）、统一开关
    provinceStore.ts        全球地块系统：编号图、边界线、地块信息；某一天每个地块的领有者、控制者
    political.tsx           国家层（按领有政权涂色）、政权色板
    occupation.tsx          占领层（斜纹、争夺虚线）
    borderLines.tsx         国界（国家层）、前线（占领层）：从地块边界线挑出当天两侧不同的
    railways.tsx            1930 年代铁路（按日期通车、按经营方着色）
    cities.tsx              1930 年代城市（历史地名、首都、分级、避让）
    regions.tsx             国家、政权名（当天领有土地的政权）
  events/                   事件层
    warLayers.tsx           战线、进攻箭头（颜色按阵营和风格）
    warLines.ts             战线、箭头的贴地几何与箭头材质
    pulse.tsx               事件地点的跳动光晕
    placeLabels.tsx         地名标注
  view/
    EarthView.tsx           三维画布 + 文字层，渲染通道，缺地形数据时的提示
    screenProjection.ts     经纬度投影到画面坐标
  scenes/                   成片（Remotion 动画）
    shared.tsx              所有地球动画共用的参数、默认日期、按风格的界面颜色
    SinoJapaneseWarDemo.tsx 1931–1945 中日战争
    EarthFlyover.tsx        路线飞越（自动场景系统、多场景视频也在用）
    EarthBackdrop.tsx       讲解视频的地球背景（只有基础地球）
    Earth3DPreview.tsx      新地球预览
    StrategicMapDemo.tsx    态势图风格示例：1937 年平型关战役
  history/                  史料库（字段说明见 history/README.md）
    datasets/               史实数据
    wars/sinoJapaneseWar.ts 中日战争成片的配置：事件顺序、镜头规则、阵营颜色、国家名
    places/                 1930–40 年代城市表、历史地名和首都的时间段
    political/              政治地理：政权表、区域、领有和控制时间段、解析和自检（见 history/README.md）
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
    build_provinces.py      全球地块：编号图、边界线、地块信息
    provinces.lock.json     地块源数据（中国县级、世界一级行政区、三个年份的历史底图）的锁定校验值
    railways_source.py      1930 年代干线铁路（人工整理：车站、通车日期、经营方）
    build_railways.py       铁路走向（沿现代路网找路径）和贴地高度
    build_tiles.py          渲染分块
    relief.py               坡度图、8 方向地平线图（细法线、山体投影、天空可见度）
    build_all.py            检查并增量重建以上全部步骤，最后与 assets.sha256 核对
    progress_window.py      重建时的进度窗口
    fsutil.py               产物原子写入、中断杂物清理
    manifest.py             生成、核对 assets.sha256
    requirements.txt        固定版本的 Python 依赖
    inputs.lock.json        河流、湖泊、海洋、城市矢量数据的锁定校验值
    railways.lock.json      现代铁路网数据的锁定校验值
  assets/                   生成的渲染数据
    cities.json, rivers.bin, railways.bin, railways.json, provinces-*.bin, provinces.json, tiles.json   小文件，提交在仓库里
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
| 铁路走向 | Natural Earth 10m railroads（现代路网，只用来确定车站之间的线路走向） | 铁路 | 公有领域 |
| 历史世界底图 | historical-basemaps 1930 / 1938 / 1945（GPL-3.0，固定到提交 d7cc908） | 世界各国、殖民地的归属 | 见 `asset-source/historical-basemaps/` |
| 中国县级边界 | geoBoundaries CHN ADM2（来源中国国家测绘地理信息局，PDDL 公有领域） | 地块 | 无 |
| 世界一级行政区 | Natural Earth 10m admin-1 | 地块 | 公有领域 |
| 中国省界 | `src/earth3d/data/china-provinces.geojson`（现代省级区块） | 判断地块所在的现代省份 | — |

使用新地球的视频需要在片尾附上述署名。

WorldCover 是 2021 年的地表数据。现代建成区按耕地处理，1937 年时的城区按 `build_cities.py` 里的城市轮廓重新标记；1937 年后修建的水库（如三峡、丹江口、新安江）按陆地处理。

## 重建数据

仓库里提交了城市、河流、铁路这几个小数据文件；地形分块（约 775MB）不提交，克隆后要重建。没有地形分块时，其他动画照常可用，用到地球的动画会在画面上提示。

**不用手动操作：仓库根目录的 `start.bat` 每次启动时都会快速检查一遍**（约一秒，只比较源码指纹、产物是否存在、分块数量，不读数据内容）。都是最新就静默通过；有缺的或过期的，就在后台开始重建并弹出进度窗口，Studio 照常启动，数据生成好后刷新一下页面即可。

手动做完整检查（包括逐个文件核对 `assets.sha256`）：双击 **`src/earth3d/rebuild.bat`**。重建时会：

- 第一次运行时自动创建 `.cache/venv` 里的 Python 3.13 环境（依赖版本固定在 `pipeline/requirements.txt`）。
- 弹出进度窗口，实时显示 9 个步骤的完成情况、当前进度条、剩余时间和最新输出；关掉窗口不影响重建。
- 每一步先检查：步骤脚本、它引用的模块、输入数据和上游步骤的指纹都没变，产物也都在，就跳过；只重做变了或缺了的部分。地形分块逐个判断，缺的补上，源码变了就把旧的逐个覆盖重建。
- 最后与 `assets.sha256` 逐个文件核对；有不一致的分块只重建这些，再核对一次。
- 不删除有用的文件。产物先写 `.tmp`、写完再替换；中途停掉不会留下半截文件。
- 同一时间只有一个重建、一个进度窗口；重建中再双击，只会把窗口叫出来。重建进程无论怎么退出，它的子进程都一起结束。
- 开始和结束时清掉中断留下的临时文件；日志只留本次和上一次（`.cache/rebuild.log`、`rebuild.previous.log`）。
- 某一步失败自动重试，最多 3 次；还是失败就停下，窗口显示原因，再运行一次从中断处继续。
- 不重复下载：已下载的文件直接跳过；大文件下载中断后从断开处续传。数据源发布了新版本时，新下载的先核对，对不上就丢掉新的、保留原有数据。
- 下载步骤的指纹只看数据源地址和锁定值，改进下载脚本本身不会让后面的步骤重做。

全新下载约 3GB，耗时约一小时。数据来源都是固定版本：高程瓦片、ESA WorldCover 2021 v200、HydroRIVERS v1.0 不再更新；Natural Earth 的下载地址指向最新版，`fetch_vectors.py` 会对照 `inputs.lock.json` 核对，对方发布新版本时会停下说明，不会悄悄算出不同的结果。

命令行用法（无图形界面的机器加 `--no-window`）：

```bash
cd src/earth3d/pipeline
../.cache/venv/Scripts/python.exe build_all.py
```

默认 PyPI 源安装 `rasterio` 时可能卡住，可以先用镜像源手动建环境：

```bash
uv venv -p 3.13 src/earth3d/.cache/venv
uv pip install -p src/earth3d/.cache/venv/Scripts/python.exe --index-url https://pypi.tuna.tsinghua.edu.cn/simple -r src/earth3d/pipeline/requirements.txt
```

有意修改了数据处理后，重建并运行 `python manifest.py write` 更新校验清单，再一起提交。

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

- 事件按日期排序，每个事件 5 秒：前 3.5 秒停在事件镜头上缓慢推近，箭头在这段时间里长出来；后 1.5 秒飞往下一个事件，国家层、占领层同时过渡到下一个日期的状态，前线平滑推进。
- 开头 3 秒从太空降到第一个事件。
- 事件镜头取自史料里的 `camera.focus` 和 `camera.zoom`：距离为 `1500 × (2.3 / zoom)³` 公里，俯仰 38°。
- 着色、战线、箭头都来自史料库，城市、国家名、阵营颜色、镜头规则在 `history/wars/sinoJapaneseWar.ts`，成片组件里不写任何归属。史料数据有缺字段、引用不存在的区域等问题时，渲染前直接报错。
- `map` 参数逐个开关河流、国家、占领、铁路、城市、国家名，`events` 参数开关战线、箭头；`pass` 参数分层导出。

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
