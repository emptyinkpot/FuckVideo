# Historical Globe Engine

`src/historical-globe` 是当前项目里的历史地球视频引擎目录。它基于 Remotion、React 和 `d3-geo`，用 GeoJSON 国家/地区区块生成可编程的历史地球动画。

## 当前能力

- 使用 `geoOrthographic` 把 GeoJSON 区块投影成球形地球。
- 按 Remotion 帧数驱动地球旋转，当前 300 帧旋转 360 度，可无缝循环。
- 使用 `SUBJECTO` 字段给殖民地、傀儡区和特殊地区继承主导国颜色。
- 支持国家/地区级颜色覆盖，例如中国主体、日本、苏联、德国、英国、法国等。
- 支持额外 GeoJSON overlay，当前叠加中国省级边界数据。
- 支持争议区/特殊区底纹：底纹绘制在填色之上，并被真实地块边界裁切。
- 支持城市点、城市中文标签、国家标签、地形线和基础光影。
- 支持结构化历史数据库：史实、控制区、战线、来源和可信度独立维护，demo timeline 从数据库派生。
- 支持历史 actor 颜色别名：`Empire of Japan`、`japan`、`manchukuo` 等通过数据库统一映射，避免世界底图和省级占领 overlay 颜色不一致。
- 支持世界底图几何补丁：可按 `featureName + MultiPolygon part index` 保留地块并重写颜色归属，避免 1938 静态底图污染 1931/1945 等时间点。
- 当前历史贴图 JPG 版本已删除，`HistoricalGlobeTexture1938` 名称保留但实际是矢量地球。

## 目录结构

```txt
src/historical-globe/
  README.md
  project.json
  compositions/
    HistoricalGlobeTexture1938.tsx
    SinoJapaneseWarDemo.tsx
  camera/
    cameraPresets.ts
  data/
    sino-japanese-war.timeline.ts
    warTimelineTypes.ts
  engine/
    EditableHistoricalWorldGlobe.tsx
  history-db/
    schema.ts
    index.ts
    README.md
    resolveHistoricalWorldState.ts
    validateHistoricalDataset.ts
    adapters/
      toWarTimeline.ts
    datasets/
      sino-japanese-war.ts
  layers/
    FrontlineLayer.tsx
  timeline/
    getWorldState.ts
```

## 关键文件

- `compositions/HistoricalGlobeTexture1938.tsx`
  - 当前 1938 历史地球 Composition 的参数入口。
  - 常用调整优先改这里，包括数据源、颜色、底纹区域、城市、标签、旋转速度和视角。

- `engine/EditableHistoricalWorldGlobe.tsx`
  - 当前 Globe Engine。
  - 负责加载 GeoJSON、建立正交投影、生成 SVG path、渲染国家、省级 overlay、底纹、城市、标签和光影。
  - 暴露 `extraOverlay` 扩展口，可把战线、箭头、事件层插入到地图之上、光影之下。

- `compositions/SinoJapaneseWarDemo.tsx`
  - 1931-1945 中日战争演化 demo。
  - 使用时间线事件驱动镜头焦点、缩放、底纹省份、进攻箭头、战线和事件标签。

- `layers/FrontlineLayer.tsx`
  - 战线和进攻箭头图层。
  - 使用当前地球投影把经纬度点投影到屏幕，支持流动虚线和动态箭头。

- `data/sino-japanese-war.timeline.ts`
  - 中日战争 demo 的渲染时间线适配层。
  - 不直接维护史实；它从 `history-db/datasets/sino-japanese-war.ts` 派生 `WarEvent[]`，保留给现有渲染层使用。

- `history-db/schema.ts`
  - 结构化历史数据 Schema。
  - 包含 actor、region、geometry ref、territorial control、event process、render policy、source、confidence 和 note。

- `history-db/resolveHistoricalWorldState.ts`
  - 通用历史归属解析器。
  - 输入 `dataset + date`，输出 `HistoricalWorldState`：每个 region 的 geometry、controller、sovereign、status、color、confidence。

- `history-db/getRegionColor.ts`
  - 历史数据链路的唯一颜色入口。
  - 根据 `actors + renderPolicy + ownership` 解析颜色；adapter 和 Composition 只消费 resolved color，不再二次根据 actor 名称查色。

- `history-db/validateHistoricalDataset.ts`
  - 数据集一致性校验器。
  - 检查 ownership 是否引用存在的 region/actor，event 是否引用存在的 actor/region。

- `history-db/datasets/sino-japanese-war.ts`
  - 中日战争第一版事实数据集。
  - 这里是当前 demo 的事实源；新增/校正历史控制区、战线、来源和可信度优先改这里。

- `history-db/adapters/toWarTimeline.ts`
  - 把 `HistoricalDataset` 转换成现有 Remotion demo 使用的 `WarEvent[]`。

- `timeline/getWorldState.ts`
  - 把离散事件转成连续渲染状态。
  - 统一输出 camera、领土颜色覆盖、战线淡入淡出、箭头淡入淡出、底纹省份和标签名单。

## 数据源

当前使用的静态数据在 `public` 目录：

```txt
public/geojson/historical-world-1938.geojson
public/geojson/china-provinces-full.json
```

`historical-world-1938.geojson` 使用 `NAME` 表示具体地块名，使用 `SUBJECTO` 表示主导国/宗主国。配置里通过 `governingAliases` 把 `Tibet` 和 `Xinjiang` 归并到 `Chinese warlords`，使其颜色跟中国主体一致。

## 历史数据原则

这个工程现在按“历史数据驱动”组织：

```txt
history-db/datasets/*.ts
  -> resolveHistoricalWorldState(date)
  -> adapter
  -> WarEvent[]
  -> WorldState(frame)
  -> Globe Engine
```

AI 可以生成镜头、节奏、文案和视觉样式，但不应该直接决定“谁占领哪里、战线在哪里”。史实判断必须写入 `history-db/datasets`，并保留 `sources`、`confidence`、`note`。第一版战线仍有示意性质，低可信度条目不应当被当作精确 GIS 边界。

颜色也由历史数据层统一管理。傀儡国、殖民地、租借地和占领地如果应遵从主导国颜色，必须通过 `actors` / `subjectAliases` / `controller` / `sovereignId` / `renderPolicy` 表达，并统一经过 `getRegionColor()` 解析。Composition 只接收 resolved color，不应再为历史地块单独写另一套颜色。

建议长期数据模型拆成两组：

```txt
Control Snapshot:
  每个时间点谁控制哪些地块、使用什么显示名称、继承什么颜色、可信度和来源。

Event Process:
  每个事件的日期、发起方、发起地、目标地、路径、过程、结果、来源和可信度。
```

渲染时由 `Control Snapshot` / `ownership` 决定地图填色，由 `Event Process` / `events` 决定箭头、战线、标签和解说。这样同一事件可以复现，颜色和归属也不会散落在多个 Composition 文件里。

当前状态：`SinoJapaneseWarDemo` 的地图归属只从 `regions + ownership + resolveHistoricalWorldState(date)` 派生；`events` 提供镜头、字幕、箭头和战线。不存在 `moments` 兼容路径。

## 行政区粒度

当前可渲染地块粒度：

```txt
世界层：1938 历史国家/殖民地/特殊地区 GeoJSON
中国层：现代中国省级 GeoJSON overlay
```

这意味着当前不能精确表达“只占某个省的一部分”或“历史行政区跨越现代省界”的情况。满洲国就是典型例子：不能用现代 `内蒙古自治区` 整块表示满洲国西部边缘或热河/兴安等历史区域。没有精确 geometry 的区域应先保留在资料层或事件说明里，不进入 `ownership` 渲染链路，避免误上色。

当前 1938 世界底图中 `Empire of Japan` 是一个 multipolygon，包含日本本土和日本控制的离散地块；中国省级 overlay 又是另一套现代省界数据。两套几何叠加时，东北/辽东附近可能出现边界不完全一致的白色地块。若该地块代表日本租借/控制区，需要用更精细历史 polygon 显式建模；若不是，则需要替换或校正底图数据。

当前中日战争 demo 已把 `Empire of Japan` 的第 `57` 个 multipolygon part 改成时间线控制的地块，因为它把朝鲜/满洲相关大块静态合在日本底图中，会导致满洲事变前和日本战败后仍出现固定白色块。这个补丁会保留陆地几何，只按时间点重写颜色归属；后续应替换为明确的朝鲜、关东州、满洲国、租借地等历史 polygon。

后续正确路线：

- 省级可用于粗略纪录片视效，但必须在 `confidence` 和 `note` 中说明。
- 市级/县级或历史行政区数据用于需要更高精度的战争推进、占领区变化。
- 对历史边界不等同于现代行政区的区域，使用 `custom-polygon` 或专门历史 GIS 数据。
- `geometry.level` 记录当前数据粒度：`country`、`province`、`prefecture`、`county`、`custom-polygon`、`symbolic`。

## 如何打开

先在项目根目录启动 Remotion Studio：

```bash
npm run dev
```

当前 Studio 端口通常是：

```txt
http://localhost:3001/HistoricalGlobeTexture1938
```

如果端口被占用，Remotion 可能会换端口，以终端输出为准。

## 如何调参数

编辑：

```txt
src/historical-globe/compositions/HistoricalGlobeTexture1938.tsx
```

常用字段：

- `rotationDegreesPerFrame`：每帧旋转角度。
- `startLongitude`：起始经度视角。
- `tiltLatitude`：地球倾斜角。
- `projectionScale`：地球大小。
- `subjectColorOverrides`：主导国颜色覆盖。
- `governingAliases`：地区归属归并。
- `hatchRegionNames`：世界层底纹地块。
- `overlayHatchRegionNames`：省级 overlay 底纹地块。
- `cities`：城市点和中文标签。
- `labelNames`：显示国家/地区标签的名单。

中日战争 demo 的史实数据编辑入口：

```txt
src/historical-globe/history-db/datasets/sino-japanese-war.ts
```

新增一个历史事实时，优先补：

- `regions`：地块 ID、名称、别名、geometry refs。
- `ownership`：某段时间内的 controller、sovereign、status、confidence、sources。
- `events`：事件日期、参与方、镜头、箭头、战线、标签、结果。
- `sources` / `confidence` / `note`。

不要再把归属写进 Composition；地块颜色只能由 `ownership + renderPolicy` 决定。

## 当前 Composition

`Root.tsx` 中注册的历史地球 Composition：

```txt
HistoricalGlobeTexture1938
SinoJapaneseWarDemo
```

参数：

```txt
durationInFrames: 300
fps: 30
width: 1280
height: 720
```

## 验证命令

```bash
npm run lint
npx remotion compositions src/index.ts
```

导出单帧示例：

```bash
npx remotion still src/index.ts HistoricalGlobeTexture1938 --frame=250 --output=screenshots/historical-globe-frame.png
npx remotion still src/index.ts SinoJapaneseWarDemo --frame=180 --output=screenshots/sino-japanese-war-frame.png
```

## 当前限制

- 已有轻量镜头插值 helper 和 `WorldState(frame)`，但还没有完整 Camera Keyframe DSL。
- 还没有 Scene/Timeline DSL，动画逻辑仍然直接来自 Remotion frame。
- 图层还没有完全拆成 `CountriesLayer`、`ProvincesLayer`、`DisputedLayer`。
- 配置还没有外置到 JSON，当前仍在 TypeScript Composition 文件中。
- 中日战争数据集是第一版结构化数据，包含来源和可信度，但战线/部分省级控制仍是示意，需要继续用历史 GIS 或战役地图校正。
- 中国区域目前只有省级 overlay，还没有市级/县级/历史行政区 GeoJSON；因此不能精确渲染局部占领区和跨现代省界历史区域。
- 1938 世界底图和中国现代省级 overlay 是两套几何来源，局部边界可能不完全吻合；日本租借地/控制地等白色小块需要后续历史 polygon 校准。
- Schema 不再提供 `moments` 兼容类型；新数据集必须使用 `regions + ownership + events`。

## 推荐下一步

1. 拆 `engine/EditableHistoricalWorldGlobe.tsx` 为 projection、layers、labels、hatch、lighting。
2. 增加 Camera System：`rotation + zoom + focus target`。
3. 接入市级/县级/历史行政区 GeoJSON，并增加 geometry registry。
4. 把 event adapter 进一步泛化为可复用 Scene/Timeline 输入。
5. 把 1938 配置外置为 JSON，保留 TypeScript 类型校验。
6. 增加 Scene/Timeline DSL，用于 AI 生成镜头脚本。
