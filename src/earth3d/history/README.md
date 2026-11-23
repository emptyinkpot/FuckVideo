# Historical DB

这里是历史事实数据层。原则是：AI 可以生成镜头、动画节奏和解说，但不能直接编造领土控制、战线和占领区。

## 数据流

```txt
datasets/*.ts
  -> validateHistoricalDataset()          渲染前校验，有错直接报错
  -> resolveHistoricalWorldState(date)    某一天每个区域的控制方、状态、颜色
  -> layers/territory.ts                  画成控制区着色的贴地图层
  -> wars/sinoJapaneseWar.ts              成片配置：事件顺序、镜头规则、阵营颜色、地名
  -> scenes/SinoJapaneseWarDemo.tsx       组装镜头、图层（着色、战线、箭头、地名）和字幕
```

## 推荐建模

长期应该把历史数据拆成两组：

```txt
Control Snapshot
  actors / aliases / region controller / color inheritance / geometry / confidence / sources

Event Process
  date / initiator / origin / target / route / process / result / confidence / sources
```

`Control Snapshot` 负责地图上每个地块的归属、颜色、名称和显示规则；`Event Process` 负责战争推演中的起点、目标、过程、箭头、战线、标题和说明。这样同一个历史时点可以复现，同一个事件也能被多种镜头复用。

当前实现里：

- `regions` 定义可寻址地块和 geometry refs。
- `ownership` 定义 `region + date -> controller/status/sovereign`。
- `getRegionColor()` 定义唯一颜色规则，颜色只来自 `actors + ownership + renderPolicy`。
- `resolveHistoricalWorldState(date)` 把两者解析成渲染状态。
- `events` 定义镜头、字幕、箭头和战线。
- 不存在 `moments` 兼容路径；新数据集必须同时提供 `regions`、`ownership` 和 `events`。

新增数据后应运行 `validateHistoricalDataset`，保证 ownership/event 没有引用不存在的 actor 或 region。

## 静态底图补丁

当前 `src/earth3d/data/historical-world-1938.geojson` 是单一时间点底图，不适合直接表达 1931 到 1945 的连续变化。比如其中 `Empire of Japan` 的 multipolygon 第 `57` 个 part 是满洲，1932 年前属中国控制，1945 年后又回到中国。

数据集用 `geojson-feature-part` 类型的 geometry 把这个 part 单独定义成一个区域（`base-map-empire-of-japan-part-57`），再由 `ownership` 给出各时段的控制方。控制区着色时，底图里的日本帝国先整体着色，被史料库单独管理的 part 跳过，再按 `ownership` 逐区覆盖。

这不是最终史实边界，只是把错误的静态底图纳入可复现的时间线控制。最终应拆成朝鲜、关东州、满洲国、租借地等独立几何。

## 粒度规则

当前可直接渲染的中国区域只有：

```txt
src/earth3d/data/china-provinces.geojson
```

所以数据库里不能把“局部历史区域”强行映射到一个现代省级整块。例如满洲国相关的西部边缘区域不能直接渲染成整个现代 `内蒙古自治区`。这类条目应当：

- 暂不进入 `ownership` 渲染链路；
- 在 `events[].note`、`frontlines[].note` 或待办数据文档中说明；
- 等接入历史行政区、市县级或自定义 polygon 后，再加入 `regions`；
- 设置 `geometry.level: "custom-polygon"`、`prefecture` 或 `county`，并在 `confidence` / `note` 中说明精度。

## 字段含义

- `ownership[].controllerId`：该区域在该历史时点的控制方。
- `ownership[].sovereignId`：傀儡、殖民、租借等场景下用于颜色继承的宗主或主导方。
- `regions[].geometryRefs[].geometry.level`：几何粒度，支持 `country`、`province`、`prefecture`、`county`、`custom-polygon`、`symbolic`。
- `confidence`：事实或几何表达可信度。
- `sources`：数据来源，不写来源的条目不能升级为高可信度。
- `note`：说明简化、争议或待校准问题。

## 下一步

要把战争演化做精细，优先补三类数据：

1. 历史行政区或自定义 polygon 数据，尤其是满洲国、蒙疆、热河、察哈尔等区域。
2. 战役地图人工校准的 frontlines 和 arrows。
3. 现代省级数据之外的市级/县级 overlay，用于局部占领和城市周边战线。
