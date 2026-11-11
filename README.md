# FuckVideo：基于 Remotion 构建的 AI 文本生成视频工具

> **基于 [Remotion](https://github.com/remotion-dev/remotion) 构建。** 本仓库是一个使用 Remotion 的视频项目，Remotion 作为 npm 依赖安装（`remotion`、`@remotion/*`，版本锁定为同一个精确版本），仓库里没有 Remotion 源码，也不修改它。自己的功能以“插件”方式放在 `videolab/`：打开就是原版 Remotion Studio，扩展功能集中在右下角的悬浮按钮和卡片工作台里，只通过 Remotion 的公开 API（`getRemotionEnvironment`、`@remotion/studio` 的 `goToComposition` / `seek`、Composition + zod schema、renderer、bundler）接入，所以接上游更新就是升级版本号，见「15. 升级 Remotion」。
>
> **许可**：Remotion 使用 [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)，个人和不超过 3 人的公司可免费使用，更大的公司需要购买 Company License。使用本仓库即需遵守该许可。

GitHub 仓库标识：`emptyinkpot/FuckVideo`
GitHub 仓库地址：`https://github.com/emptyinkpot/FuckVideo`

视频理解、素材语义检索、自动编排和“花生 AI 复刻路线”的唯一架构真源：`docs/video-understanding-system.md`。

```yaml
projectName: FuckVideo
canonicalDoc: README.md
machineReadableEntry: project.json
githubRepo: https://github.com/emptyinkpot/FuckVideo
visibility: public
projectType: AI video understanding and Remotion generation application
runtimeRunbook: docs/operations/runtime-runbook.md
contributing: CONTRIBUTING.md
security: SECURITY.md
support: SUPPORT.md
```

## 文档体系

| 文档 | 职责 |
| --- | --- |
| `README.md` | 人类主入口：项目目的、运行方式、当前工作流、上游来源和总体规则。 |
| `project.json` | 机器可读入口：仓库标识、项目目标、核心合同和文档索引。 |
| `docs/architecture/readme-system.md` | README / docs 体系、读文档顺序、vendor 文档边界和 bot 策略。 |
| `docs/architecture/language-boundary.md` | TypeScript 主体、Python sidecar 的语言边界及原因。 |
| `docs/video-understanding-system.md` | AI 素材理解、语义检索、自动编排、花生 AI 类路线的唯一架构真源。 |
| `docs/architecture/material-pipeline.md` | 素材入库、抽帧、OCR、ASR、embedding、向量库和检索接入边界。 |
| `docs/contracts/video-project-schema.md` | `ShotPlan`、`TimelineScene`、`VectorSearchResult`、项目 JSON 和 Remotion handoff 合同。 |
| `docs/contracts/material-seed-schema.md` | `material-seed.jsonl` 素材理解/向量 sidecar 输入合同。 |
| `docs/operations/runtime-runbook.md` | 启动、端口、环境变量、验证命令和排障。 |
| `docs/research/cloneable-video-understanding-stacks.md` | 可克隆/可复刻技术栈、大公司分层方式、bot 使用建议。 |
| `CONTRIBUTING.md` | 改动规则、验证命令和提交约定。 |
| `SECURITY.md` | 密钥、素材和生成文件的安全边界。 |
| `SUPPORT.md` | 排障信息入口和支持边界。 |

## 快速启动（Windows）

双击仓库根目录的 `FuckVideo.exe`：

- 后台启动原版 Remotion Studio（:3000）和 VideoLab 接口服务（:3037），不弹终端窗口，启动时显示一个小进度窗口。
- 就绪后用 Edge 应用模式打开 Studio，显示为没有地址栏和标签页的独立窗口（没装 Edge 时用默认浏览器）。已经在运行时再双击，只会重新打开窗口。
- 右下角的 **FV** 悬浮按钮打开 FuckVideo 工作台卡片：项目 / 分镜、生成视频、设置（界面中文开关、关闭）。
- 关闭：工作台「设置」里的「关闭 FuckVideo」，所有服务一起停止（`POST /api/shutdown`，只接受本机 Studio 页面发起的请求）。
- 日志：`out/launcher.log`。

不用 exe 时：`npm run dev:video` 效果相同（终端里运行，Ctrl+C 停止）；`npm run dev` 只开 Studio，悬浮按钮照样出现，但项目和生成功能需要 :3037 服务。

`FuckVideo.exe` 不进 git，源码在 `videolab/launcher/FuckVideo.cs`，运行 `videolab\launcher\build.cmd` 用 Windows 自带的 .NET Framework 编译器生成。需要本机装有 Node.js 18+。

本地目录布局：`data/`（图片、视频素材）、`artifacts/`（导出任务、成片）都在仓库根目录下，被 gitignore，只存在本机。

## 0. 项目目的

本项目的目标不是做一个传统“自动剪辑器”，也不是把 FFmpeg 自动切片包装成产品。

本项目要做的是：

```text
输入文案
  -> 自动生成配音
  -> 理解文案并拆成镜头语义
  -> 在素材库中做语义检索和素材匹配
  -> 自动编排 B-roll / 程序化 Remotion 镜头 / 字幕 / 进度条
  -> 生成可继续编辑的 Remotion 工程
  -> 渲染带配音、带剪辑、带素材证据的成片
```

因此项目的核心能力应被定义为：

```text
AI 素材理解 + 语义检索 + 自动编排 + Remotion 可编辑生成工程
```

真正的难点不是“剪”，而是“从素材库里找对东西”。FFmpeg/Remotion 渲染只是下游执行层；上游必须先把素材库理解成可检索的镜头记忆。

语言边界：本仓库主体采用 TypeScript / Node，因为 Remotion、React composition、FuckVideo 悬浮工作台、项目时间轴和渲染编排都在这个生态内；素材理解、embedding、ASR、OCR、Qwen-VL/CLIP/SigLIP 等模型重活采用 Python sidecar，因为成熟模型库、GPU/批处理和向量入库生态主要在 Python。完整规则见 `docs/architecture/language-boundary.md`。

## 仓库来源与上游标识

- 本仓库的 GitHub owning repo 是 `emptyinkpot/FuckVideo`。
- 本仓库不是 GitHub fork：GitHub API 当前显示 `isFork=false`、`parent=null`、`templateRepository=null`。
- 本仓库不是从某一个 GitHub 仓库直接复刻而来；初始提交是本地创建的 Remotion 视频工作台工程，首个提交为 `05bb1e1 Initial Remotion video workspace`。
- 本仓库的核心框架上游是 `remotion-dev/remotion`，GitHub 地址为 `https://github.com/remotion-dev/remotion`。它以 npm 依赖的形式使用，不 fork、不改源码；工程根目录（`src/index.ts`、`src/Root.tsx`、`public/`、`remotion.config.ts`）保持官方模板（`npx create-video`）的结构。
- Remotion 的许可是 Remotion License（非 MIT），见文首说明。
- 本仓库的设计、模板、素材和数据参考来源列在下方“研究与素材来源说明”；这些是研究/素材/实现参考来源，不等同于 GitHub fork parent。
- 本仓库早期的本地目录名和 npm 包名是 `remotion-project`，2026-11-10 统一改为 FuckVideo；其他仓库或文档里提到的 `remotion-project` 指的就是本仓库根目录。

## 曾经合并进来的 huasheng-clone（已移出）

`emptyinkpot/huasheng-clone`（仿 B 站「花生」的 Next.js + Hono + 渲染 worker 产品形态）曾在 2026-11-10 连同 10 个提交合并到本仓库的 `platform/`，2026-11-11 移出：它用另一套技术栈把同一条「文案 → 配音 → 分镜 → 素材 → 渲染」流程又实现了一遍，并带有模板和 TTS 的复制版，和「打开就是原版 Remotion、扩展只做扩展」的方向重复。代码仍在本仓库提交历史里（`git log -- platform`），GitHub 上的 huasheng-clone 已归档保留；它在本机独有的配置、路线图、逆向报告和数据存放在 `data/platform-archive/`（不进 git）。

## 研究与素材来源说明

本仓库不是单一上游仓库的 fork，而是在本地 Remotion 视频工作台基础上，参考、适配并集成了下列公开项目、素材库和数据源的研究成果。下列说明用于标注技术来源、设计参考和数据来源；具体许可证与使用边界以各上游项目原始声明为准。

| 来源 | 上游地址 | 本项目中的用途 | 本地位置 |
| --- | --- | --- | --- |
| Remotion | https://github.com/remotion-dev/remotion | 视频合成、逐帧渲染、Studio 预览、Composition schema/defaultProps 工作流的基础框架。 | `src/Root.tsx`, `src/templates/`, `remotion.config.ts` |
| RemotionLab Showcase | https://remotionlab.com/showcase | 参考公开 showcase 中的动画结构、镜头节奏和可复用 Remotion 片段；本地保存 showcase 索引、公开代码片段、预览与缩略图，用于素材库和镜头调度参考。 | `asset-source/remotionlab/`, `src/remotionlab-showcase/` |
| remotion-bits | https://github.com/av/remotion-bits | 参考并适配 Remotion 动画组件与工具模式，包括文本入场、渐变转场、粒子、3D 场景辅助等程序化视觉机制。 | `asset-source/programmatic-visual-assets/remotion-bits/` |
| React Video Editor Remotion Templates | https://github.com/reactvideoeditor/remotion-templates | 参考并适配 RVE 的免费 Remotion 模板集合，包括数据图表、文字高亮、噪声颗粒、film burn、vignette、相机运动等模板模式。 | `asset-source/programmatic-visual-assets/reactvideoeditor-remotion-templates/` |
| Mixkit Video Templates | https://mixkit.co/free-after-effects-templates/ | 参考 Mixkit 免费 AE reveal 模板的视觉结构，并在 Remotion 中重建为确定性的程序动画预设；原始下载缓存不作为运行时必需代码。 | `asset-source/mixkit-reveal/`, `src/templates/MixkitReveal.tsx` |
| historical-basemaps | https://github.com/aourednik/historical-basemaps | 历史边界底图、SVG/GeoJSON 历史地图数据和历史地图可视化方法参考，用于 historical globe 与 historical map 模板。 | `asset-source/historical-basemaps/`, `public/historical-maps/`, `src/historical-globe/` |
| Natural Earth | https://www.naturalearthdata.com/ | 自然地球底图、国家边界和 shaded relief 地图素材来源，用于地图、地球和历史地图背景。 | `asset-source/natural-earth/`, `public/maps/`, `public/geojson/` |
| Wikimedia Commons | https://commons.wikimedia.org/ | 作为证据素材缓存来源之一，用于自动片段中的公共图片证据素材。 | `public/evidence-cache/` |

除上述来源外，本项目还有本地实现的文本生成视频链路、千问 TTS 集成、Studio 注入插件、项目存储、片段调度、字幕/进度条布局和 Remotion 多镜头时间轴组合逻辑。若新增上游参考、复制代码、导入素材或引入数据集，应同步更新本节与对应 `asset-source/*/README.md`。

## 可借鉴的成熟路线

行业里成熟的方向是“素材 embedding + 向量数据库 + 多模态检索 + 时间轴编排”，而不是单纯做 FFmpeg 自动切片。本项目应借鉴这些路线，但保持 Remotion 作为可编辑工程和最终渲染层：

| 可借鉴方向 | 项目中的落点 | 说明 |
| --- | --- | --- |
| VideoDB 式视频语义搜索 | `asset-index.json` + future vector store | 借鉴“视频入库后可按自然语言检索具体片段”的数据模型。 |
| Towhee / CLIP / Milvus pipeline | 素材预处理层 | 抽帧、OCR、ASR、视觉标签、embedding 写入向量库。 |
| LanceDB / Weaviate multimodal retrieval | 本地轻量向量检索 | 适合先做本地版素材库，避免一开始引入重型服务。 |
| LLM rerank | `visual-resolver.mjs` 候选重排阶段 | 先粗搜 Top N 素材，再让 LLM 按上下文、情绪、镜头目的重排。 |
| JSON timeline | `.runtime/video-projects/*.json` 和 `MultiSceneVideo` props | 时间轴必须是结构化、可编辑、可回写的工程数据。 |

当前项目已经预留了轻量素材索引和 embedding 接口：

- `pipeline/asset-indexer.mjs` 生成 `public/generated/asset-index.json`
- `pipeline/material-seed.mjs` 从 `asset-index.json` 生成 `public/generated/material-seed.jsonl`
- `pipeline/asset-matcher.mjs` 提供词法匹配和 `optionalEmbeddingRerank()`
- `pipeline/visual-resolver.mjs` 负责把语义镜头映射到 Remotion 模板或素材
- `pipeline/project-store.mjs` 负责把生成结果保存成可编辑 timeline project

下一步素材理解层应该产出统一结构，而不是绕过现有编排器：

```json
{
  "id": "clip-001",
  "type": "footage",
  "path": "footage/city-night.mp4",
  "description": "深夜城市航拍，霓虹灯，高楼，车流",
  "semantic": {
    "kind": "atmosphere",
    "visualObjects": ["高楼", "街道", "车流", "霓虹"],
    "actions": ["establish"],
    "location": ["上海"],
    "ocrText": "",
    "asrText": ""
  },
  "shots": [
    {
      "id": "clip-001:shot-001",
      "startMs": 0,
      "endMs": 4200,
      "embeddingRef": "lancedb://footage/clip-001/shot-001"
    }
  ],
  "retrieval": {
    "vectorStore": "lancedb",
    "collection": "footage_shots",
    "embeddingModel": "openclip"
  }
}
```

这是一个本地 Remotion 工程，核心能力是：

```text
Remotion Studio（原版，:3000）
  + 32 个模板的预览、时间线、schema 参数编辑、渲染
  + 右下角 FV 悬浮按钮 -> FuckVideo 工作台卡片：
      项目 / 分镜：切换、新建、载入到 Studio、点分镜跳到对应帧、改文案、锁定、调整顺序、重配并替换素材、解析证据
      生成视频：千问 TTS、自动片段规划、素材检索、现有模板复用，生成新项目
      设置：Studio 界面中文开关、关闭全部服务
```

扩展只做 Remotion 没有的事。预览、时间线、调参数、渲染出片都用 Studio 自己的功能，不在工作台里重复。

本文档按“给一个不了解项目的人复现出近似工程”的标准编写，包含运行环境、目录结构、端口、数据流、模板系统、参数系统、API 合约、排障和验证方式。

## 1. 项目能力概览

本项目目前包含三层能力：

第一层是 Remotion 模板工程：

- `src/Root.tsx` 注册全部 Remotion compositions。
- 每个 composition 都有 `schema` 和 `defaultProps`。
- Remotion Studio 中 32 个合成都能显示 props 编辑区。
- 多数模板参数会真实影响画面，不是只挂一个空 schema。

第二层是文本生成视频链路：

- 输入文案。
- 调用千问 TTS 服务生成旁白。
- 下载 TTS 音频。
- 用 `ffmpeg` 转成 Remotion Studio 更稳定识别的标准 MP3。
- 根据音频时长计算视频时长。
- 可选调用字幕接口生成 SRT。
- 如果存在 SRT/captions，自动片段会先按 caption 建立父时间轴，再把过长 caption 拆成 semantic micro-segments：一段音频、一段文本、一个画面。
- 如果存在 `public/generated/asset-index.json`，自动片段会尝试匹配 `public/footage/` 下的素材。
- 使用 `GeneratedTemplateVideo` 包装已有模板并叠加音频/字幕。
- 或使用 `MultiSceneVideo` 自动拼接多个镜头模板。
- 调用 Remotion CLI 渲染 MP4。

第三层是 FuckVideo 工作台（`videolab/`）：

- `npm run dev:video` 或双击 `FuckVideo.exe` 启动 Studio（:3000）和 VideoLab 接口服务（:3037）。
- 工作台由 `src/index.ts` 在 `getRemotionEnvironment().isStudio` 时懒加载，渲染时不会加载。
- 生成视频默认“自动分镜”：文本 -> 千问 TTS -> 自动片段规划 -> `MultiSceneVideo` -> MP4；也可选“单模板”。
- 任务提交到 `POST /api/jobs`，完成后保存 `.runtime/video-projects/<id>.json`，并自动载入到 Studio。
- 载入项目：服务端把项目写成 `MultiSceneVideo` 的 defaultProps（`src/generated/currentMultiSceneDefaultProps.ts`），Studio 热更新，工作台调用 `goToComposition("MultiSceneVideo")`。

## 2. 运行环境

推荐环境：

- Windows 10/11。
- Node.js 18 或更高版本。
- npm。
- `ffmpeg` 和 `ffprobe` 已加入 PATH。
- 能访问项目配置的千问 TTS API。

检查命令：

```console
node -v
npm -v
ffmpeg -version
ffprobe -version
```

如果 `ffmpeg` 或 `ffprobe` 不可用，文本生成视频链路会失败，因为项目需要：

- 用 `ffmpeg` 把 TTS 返回的原始音频转成标准 MP3。
- 用 `ffprobe` 读取音频时长，决定 Remotion 渲染时长。

## 3. 安装依赖

本仓库地址：

```console
https://github.com/emptyinkpot/FuckVideo
```

仓库包含大素材，必须安装 Git LFS：

```console
git lfs install
git clone https://github.com/emptyinkpot/FuckVideo.git
cd FuckVideo
git lfs pull
```

如果你已经在本机已有目录，例如：

```console
cd /d "E:\My Project\FuckVideo"
git lfs pull
```

安装依赖：

```console
npm i
```

项目主要依赖：

- `remotion@4.0.456`
- `@remotion/cli@4.0.456`
- `@remotion/three`
- `@react-three/fiber`
- `three`
- `zod`
- `typescript`
- `eslint`

`zod` 来自 Remotion 依赖树，用于给 `<Composition>` 添加可编辑参数 schema。

## 4. 常用启动方式

| 命令 | 作用 |
| --- | --- |
| 双击 `FuckVideo.exe` | Studio + VideoLab 接口服务，后台运行，独立窗口打开 Studio |
| `npm run dev:video` | 同上，在终端里运行 |
| `npm run dev` | 只开 Remotion Studio（:3000） |
| `npm run videolab` | 只开 VideoLab 接口服务（:3037） |

端口：

```text
3000  Remotion Studio（FuckVideo 工作台在页面里的悬浮按钮上）
3037  VideoLab 接口：生成任务、项目数据、关闭
```

## 5. 目录结构

关键目录如下：

```text
FuckVideo/
  src/  public/  remotion.config.ts   Remotion 官方模板结构，只放视频模板（见下）

  videolab/                         自己的插件；删掉它和 src/index.ts 里那段挂载代码，剩下的就是标准 Remotion 项目
    overlay/                        Studio 里的悬浮工作台（Shadow DOM 隔离样式）
      mount.tsx                     挂载入口，由 src/index.ts 在 Studio 环境下懒加载
      Workbench.tsx                 悬浮按钮 + 卡片：项目/分镜、生成视频、设置
      i18n/dict.ts  translate.ts    Studio 界面中文（可开关，可增补词典）
    server/
      server.mjs                    生成任务 / 项目 API（:3037）
      start.mjs                     一键启动 Studio + API
    launcher/
      FuckVideo.cs  build.cmd       FuckVideo.exe 源码与编译脚本

  pipeline/
    text-to-video.mjs               命令行生成视频主链路
    scene-planner.mjs               caption/micro-segment 切分、语义卡、视觉合约、Visual Resolver 调用
    visual-resolver.mjs             Programmatic / Template / Footage 三类 VisualProvider 调度器
    timeline-aligner.mjs            旧兼容：把已有 scenes 贴到音频真实时间轴
    asset-indexer.mjs               扫描 public/footage 生成素材索引草稿
    asset-matcher.mjs               根据 semanticCard/visualContract 硬过滤、召回和解释素材候选
    scene-asset-planner.mjs         给已有 scenes JSON 补充 visualLayer 素材信息
    import-mixkit-reveal.mjs        下载 Mixkit Reveal 26 个 AE 源模板并生成本地 manifest
    project-store.mjs               VideoProject 读写、scene patch、素材替换、props 转换
    export-video-project.mjs        project.json -> MultiSceneVideo props -> MP4
    text-to-scenes-video.mjs        只生成/渲染多镜头视频，不调用 TTS
    text-to-scenes-tts-video.mjs    一站式：TTS + 自动片段 + Remotion 渲染

  tests/
    verify-upstream.mjs             每个合成渲染一帧，升级 Remotion 后的检查
    videolab-smoke.mjs              无头浏览器打开 Studio，检查悬浮工作台、载入项目、界面中文开关


  src/
    Root.tsx                        所有 Composition 注册、schema、defaultProps
    index.ts                        Remotion root 入口
    templates/
      GeneratedTemplateVideo.tsx    生成视频包装器：现有模板 + 音频 + 字幕
      MultiSceneVideo.tsx           多镜头视频容器：Sequence 时间轴拼接
      DocumentReveal.tsx            唯一文件证据展示模板：截取上下文、高亮、推镜、纸张质感
      MixkitReveal.tsx              Mixkit Reveal 26 个 AE 素材复刻成一个可参数化 Remotion 模板
      mixkitRevealPresets.ts        Mixkit Reveal presetId、颜色、effectKind 和来源映射
      AutoSceneTemplates.tsx        人物、引文、概念、隐喻四类解释型镜头模板
      FootageScene.tsx              本地素材片段镜头模板
      sceneRegistry.tsx             自动片段 templateId -> Remotion 组件映射
      visual-provider-manifest.json 可执行 VisualProvider 握手说明书，供 resolver 调度三类 provider
      template-manifest.json        旧兼容模板说明书
      NarratedVideo.tsx             通用旁白视频模板
      MapTemplates.tsx              地图飞越模板
      MotionTemplates.tsx           二维动态图形模板
      PromptMotionExamples.tsx      提示词动态图形模板
      ThreeDTemplates.tsx           Three.js / 三维模板
      EarthGlobeTemplate.tsx        三维地球模板
      HistoricalMapTemplates.tsx    历史地图模板

    remotionlab-showcase/
      catalog.ts                    263 个 RemotionLab showcase 素材索引
      RemotionLabShowcaseAsset.tsx  原生合成入口；通过 assetId 切换素材，不注册 263 个重复合成
      types.ts                      RemotionLab 素材元数据类型

    historical-globe/
      compositions/
        HistoricalGlobeTexture1938.tsx
        SinoJapaneseWarDemo.tsx
      engine/
      history-db/
      layers/
      timeline/

  public/
    generated/                      生成后的 MP3、SRT、props JSON
    footage/                        本地影视/历史/实拍素材库
    geojson/                        历史地球 GeoJSON 数据
    maps/                           地图纹理

  asset-source/
    historical-basemaps/            历史底图源数据、SVG、GeoJSON、示例素材
    natural-earth/                  Natural Earth 原始下载与解压素材
    mixkit-reveal/                  Mixkit Reveal manifest；原始 zip/preview/poster 为本地忽略素材

  .runtime/
    text-to-video/
      jobs/                         Web 任务临时文本
      raw-audio/                    TTS 原始音频缓存
    video-projects/                 可编辑项目 JSON，不作为源码提交

  out/                              渲染出的 MP4
```

素材边界：

- `public/maps/`、`public/geojson/`、`public/historical-maps/` 是运行时直接读取的公开素材。
- `asset-source/` 是工程素材源文件，也已经纳入仓库。
- `asset-source/natural-earth/NE1_LR_LC_SR_W.zip` 和 `asset-source/natural-earth/natural-earth/NE1_LR_LC_SR_W.tif` 走 Git LFS。
- `asset-source/mixkit-reveal/manifest.json` 记录 26 个 Mixkit Reveal AE 源模板；`originals/`、`previews/`、`posters/` 是下载缓存，默认被 `.gitignore` 忽略，避免把约 700MB 源资产塞进源码仓库。
- `public/generated/` 当前包含已生成示例；新运行任务也会继续往这里写 MP3、SRT、props、scenes。
- `.runtime/` 是本机运行状态和 raw audio 缓存，不作为复刻所需源码。
- `out/` 是渲染产物目录，不作为源码必需项。

## 6. 核心架构

整体架构：

```text
Remotion Studio（http://localhost:3000）里的 FuckVideo 悬浮工作台
  |
  | 点击“生成视频”
  v
本地任务 API videolab/server/server.mjs
  |
  | POST /api/jobs
  v
命令行生成链路 pipeline/text-to-video.mjs
  |
  | 调用千问 TTS
  | 下载音频
  | ffmpeg 转 MP3
  | ffprobe 读取时长
  | 写 props JSON
  | remotion render
  v
out/text-to-video-*.mp4
```

单模板生成时，真正负责渲染的是：

```text
src/templates/GeneratedTemplateVideo.tsx
```

它根据 `templateId` 选择一个已有 Remotion 模板，然后叠加：

- TTS 音频
- 可选字幕
- 由音频时长决定的视频时长

自动片段生成时，任务 API 会调用：

```text
pipeline/text-to-scenes-tts-video.mjs
```

它会执行：

```text
文本
  -> 千问 TTS 生成旁白
  -> ffmpeg 标准化 MP3
  -> 可选 SRT
  -> scene-planner 生成 scenes
  -> MultiSceneVideo 按 scenes 生成 Remotion 时间轴
  -> remotion render 输出 MP4
```

## 7. Remotion Composition 系统

所有合成都注册在：

```text
src/Root.tsx
```

当前合成总数：

```text
32 个 Composition
32 个 schema
32 个 defaultProps
```

也就是说，每个合成都能在 Remotion Studio 里显示可编辑 props 面板。

### 7.1 生成视频相关合成

`GeneratedTemplateVideo`

用途：文本生成视频链路的主合成。它包装已有模板，叠加音频和字幕。

主要参数：

- `templateId`：选择现有模板。
- `title`：视频标题。
- `audioSrc`：音频路径，通常为 `generated/tts-*.mp3`。
- `captions`：字幕数组。
- `durationSeconds`：视频时长。
- `showCaptions`：是否显示字幕。

`NarratedVideo`

用途：通用旁白视频模板，不依赖特定现有模板。

主要参数：

- `title`
- `subtitle`
- `bodyText`
- `audioSrc`
- `captions`
- `durationSeconds`
- `theme`

`DocumentReveal`

用途：历史文件、条约、策论、档案类镜头。自动片段系统遇到“条约/和约/协定/策论/转让/租借地”等文本时会优先使用它。

主要参数：

- `title`
- `subtitle`
- `body`
- `sealText`
- `highlightWords`
- `tone`

`QuoteReveal`

用途：原文引用、关键句、被圈点的策论文字、需要强调的比喻句。

主要参数：

- `quote`
- `source`
- `highlightWords`
- `tone`

`PortraitFocus`

用途：人物、官员、将领、作者、组织负责人等身份介绍。

主要参数：

- `name`
- `roleTitle`
- `description`
- `era`
- `keywords`
- `tone`

`ConceptDiagram`

用途：利权、租借地、铁路附属地、势力范围、控制结构等抽象关系解释。

主要参数：

- `concept`
- `definition`
- `nodes`
- `keywords`
- `tone`

`MetaphorVisual`

用途：把“犹如、仿佛、像、好比”这类文本隐喻转换为对象移动或关系变化。

主要参数：

- `metaphor`
- `fromLabel`
- `toLabel`
- `objectLabel`
- `tone`

`FootageScene`

用途：播放 `public/footage/` 下的本地素材片段。自动片段系统匹配到高相关素材时，会通过 `visualLayer.type = "footage"` 调用它。

主要参数：

- `src`
- `title`
- `subtitle`
- `fit`
- `darken`
- `zoom`
- `showTitle`

`MixkitReveal`

用途：把 Mixkit Reveal 分类下 26 个免费 After Effects 源素材拆成可复用的 Remotion reveal 预设。它不是把 `.aep` 二进制直接塞进运行时，而是把成熟 AE 模板的视觉结构重建为逐帧确定性的程序动画：遮罩入场、lower third、新闻扫光、像素框、3D 层叠、液体 splash、swirl、neon、glitch、radial wipe、audio visualizer、gaming shard、sport stripe、confetti、fireworks、seasonal、particles、food organic 等。

主要参数：

- `presetId`：26 个 Mixkit 源模板之一，例如 `bar-transition-text-625`。
- `title`
- `subtitle`
- `logoText`
- `body`
- `accentColor`
- `secondaryColor`
- `backgroundColor`
- `intensity`
- `showSourceLabel`

`MultiSceneVideo`

用途：一站式自动片段视频的主合成。它不代表单个模板，而是根据 `scenes` 数组用 Remotion `Sequence` 串联多个镜头。

主要参数：

- `title`
- `scenes`
- `audioSrc`
- `captions`
- `showCaptions`
- `showSceneLabels`

### 7.2 动态图形模板

`ClaudeTyper`

- `prompt`
- `backgroundColor`
- `panelColor`
- `textColor`

`SpotlightReveal`

- `title`
- `backgroundColor`
- `lightColor`
- `fontSize`

`ProceduralFish`

- `fishCount`
- `backgroundTop`
- `backgroundBottom`
- `primaryColor`
- `secondaryColor`

`RulerProgress`

- `title`
- `targetProgress`
- `backgroundColor`
- `fillColorA`
- `fillColorB`

`SvgAssembly`

- `title`
- `backgroundColor`
- `glowColor`
- `partColorA`
- `partColorB`

`Wechat2D`

- `contactName`
- `leftMessageA`
- `rightMessageA`
- `leftMessageB`
- `rightMessageB`

`ThreeDTicker`

- `backgroundColor`
- `perspective`
- `columnGap`

`VinylPlayer`

- `title`
- `subtitle`
- `coverImage`
- `backgroundColor`

### 7.3 提示词动态图形模板

`PromptTextRotation`

- `words`：用英文逗号分隔，例如 `提示词,动画,图形,模板`。
- `backgroundColor`
- `textColor`
- `fontSize`

`PromptProgressBar`

- `label`
- `backgroundColor`
- `barColorA`
- `barColorB`

`PromptHistogram`

- `title`
- `backgroundColor`
- `firstLabel`
- `secondLabel`
- `thirdLabel`
- `fourthLabel`
- `fifthLabel`

`PromptAnimatedShapes`

- `backgroundColor`
- `gap`
- `size`
- `spinSpeed`

### 7.4 三维模板

`ThreeProductStage`

- `title`
- `backgroundColor`
- `objectColor`
- `accentColor`
- `rotationSpeed`

`ThreeBouncingSpheres`

- `sphereCount`
- `backgroundColor`
- `bounceStrength`
- `cameraDistance`

`ThreeParticleNebula`

- `particleCount`
- `backgroundColor`
- `coreColor`
- `orbitSpeed`

`ThreeCardCascade`

- `titleLine1`
- `titleLine2`
- `cardCount`
- `backgroundColor`

### 7.5 地图模板

`MapRouteFlyover`

- `title`
- `subtitle`
- `backgroundColor`
- `routeColor`
- `glowColor`

`AtlasMapFlyover`

- `title`
- `subtitle`
- `textureSrc`
- `routeColor`
- `overlayOpacity`

`EarthGlobe`

- `title`
- `subtitle`
- `rotationSpeed`
- `startRotation`
- `axialTiltDegrees`
- `globeRadius`
- `cameraDistance`
- `cameraFov`
- `ambientIntensity`
- `sunIntensity`
- `sunColor`
- `atmosphereColor`
- `atmosphereOpacity`
- `routeAltitude`
- `routeThickness`
- `showStars`
- `showOverlayText`

### 7.6 历史地球模板

`HistoricalGlobeTexture1938`

- `title`
- `subtitle`
- `startLongitude`
- `rotationDegreesPerFrame`
- `projectionScale`
- `projectionTranslateX`
- `projectionTranslateY`
- `showLabels`

`SinoJapaneseWarDemo`

- `title`
- `subtitle`
- `cardLeft`
- `cardBottom`
- `progressTop`
- `showProgressBar`

## 8. 如何新增一个 Remotion 模板

新增模板的推荐步骤：

1. 在 `src/templates/` 下创建组件文件，或加到现有模板文件中。
2. 给组件定义 props 类型。
3. 组件内部使用 props 影响画面。
4. 在 `src/Root.tsx` 中导入组件。
5. 用 `z.object()` 定义 schema。
6. 定义 defaultProps。
7. 增加 `<Composition>` 注册。
8. 如果希望被“生成视频扩展”调用，还要加入：
   - `src/templates/GeneratedTemplateVideo.tsx` 的 `ExistingTemplateId`
   - `src/templates/sceneRegistry.tsx` 的 `AutoSceneTemplateId` 和 `renderSceneTemplate`
   - `src/templates/visual-provider-manifest.json` 的 provider 握手说明
   - `pipeline/visual-resolver.mjs` 能识别的新 provider 能力
   - `pipeline/scene-planner.mjs` 生成的 `semanticCard / visualContract`
   - `templates` 映射
   - `templateOptions`
   - `videolab/overlay/templates.ts` 的模板下拉（单模板模式）

最小示意：

```tsx
const myTemplateSchema = z.object({
  title: z.string(),
  backgroundColor: z.string(),
});

const myTemplateDefaultProps = {
  title: "我的模板",
  backgroundColor: "#111111",
};

<Composition
  id="MyTemplate"
  component={MyTemplate}
  schema={myTemplateSchema}
  defaultProps={myTemplateDefaultProps}
  durationInFrames={180}
  fps={30}
  width={1280}
  height={720}
/>
```

## 9. 文本生成视频命令行

主脚本：

```text
pipeline/text-to-video.mjs
```

基础命令：

```console
npm run text-to-video -- --text "旅顺港的海风吹进东京霞关，战争的尾声并没有带来平静。" --title "南满铁路的开端" --template AtlasMapFlyover --output out/narrated.mp4 --skip-srt=true
```

使用文本文件：

```console
npm run text-to-video -- --text-file input.txt --title "标题" --subtitle "副标题" --instruction "标准播音风格，吐字清晰，语速平稳" --output out/video.mp4
```

只生成音频和 props，不渲染视频：

```console
npm run text-to-video -- --text "短文本" --render=false --skip-srt=true
```

输出 JSON 摘要，供 Web 任务服务读取：

```console
npm run text-to-video -- --text "短文本" --json=true
```

常用参数：

```text
--text             直接传入文本
--text-file        从文本文件读取
--title            视频标题
--subtitle         视频副标题
--instruction      TTS 风格指令
--language         语言，默认 Chinese
--voice            音色，默认 my-clone
--template         使用哪个现有 Remotion 模板
--composition      渲染哪个 Remotion composition，默认 GeneratedTemplateVideo
--theme            视觉主题，historical 或 clean
--skip-srt         是否跳过字幕
--render           是否执行 Remotion 渲染
--output           输出 MP4 路径
--json             是否输出 TEXT_TO_VIDEO_RESULT
```

默认配置在 `pipeline/text-to-video.mjs` 顶部的 `defaults` 中。

## 9.1 一站式自动片段生成命令行

主脚本：

```text
pipeline/text-to-scenes-tts-video.mjs
```

基础命令：

```console
npm run text-to-scenes-tts-video -- --text-file input.txt --title "南满铁路的开端" --output out/auto-scenes-tts-video.mp4 --skip-srt=true
```

直接传文本：

```console
npm run text-to-scenes-tts-video -- --text "条约上用词谨慎，所谓转让遮住了更复杂的权力关系。" --title "自动片段测试" --output out/auto.mp4 --skip-srt=true
```

只生成音频、镜头规划和 props，不渲染：

```console
npm run text-to-scenes-tts-video -- --text-file input.txt --no-render --skip-srt=true
```

成功后会产生：

```text
public/generated/tts-*.mp3
public/generated/scenes-*.json
public/generated/props-scenes-tts-*.json
out/*.mp4
```

常用参数：

```text
--text             直接传入文本
--text-file        从文本文件读取
--title            视频标题
--instruction      TTS 风格指令
--language         语言，默认 Chinese
--voice            音色，默认 my-clone
--tts-provider     TTS provider，auto / dashscope / proxy
--max-chars        每个镜头块的目标最大字符数，默认 130
--skip-srt         是否跳过字幕
--match-assets     是否匹配 public/generated/asset-index.json，默认 true
--asset-index      素材索引路径，默认 public/generated/asset-index.json
--no-render        只生成音频/镜头/props，不渲染视频
--output           输出 MP4 路径
--json             是否输出 TEXT_TO_VIDEO_RESULT
```

## 10. 千问 TTS 接入方式

当前脚本只使用 DashScope 直连 TTS，不再走中转：

```text
dashscope  阿里云 DashScope CosyVoice WebSocket API。
```

DashScope API Key 只放在本地 `.env.local`，不要写入 README、`project.json` 或其它会提交到 Git 的文件：

```text
QWEN3_TTS_DASHSCOPE_API_KEY=<your-dashscope-api-key>
DASHSCOPE_API_KEY=<your-dashscope-api-key>
```

当前本地 DashScope TTS 配置：

```text
QWEN3_TTS_DASHSCOPE_MODEL=cosyvoice-v3.5-plus
QWEN3_TTS_DASHSCOPE_VOICE=cosyvoice-v3.5-plus-bailian-f04eec5bf9e64f14afeefd3bb09cccfe
QWEN3_TTS_DASHSCOPE_LANGUAGE_TYPE=Chinese
DASHSCOPE_WS_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference/
```

直连模式会直接把 WebSocket 返回的音频写入：

```text
.runtime/text-to-video/raw-audio/tts-raw-*.mp3
```

然后仍统一转成 Remotion 稳定识别的：

```text
public/generated/tts-*.mp3
```

TTS 中转接口已禁用，生成链路只走 DashScope 直连。

字幕不走语音识别。TTS 生成后，脚本读取真实音频时长，用原文按标点和长度切分字幕，默认每条不超过 22 个有效字符，再按文本长度比例估算时间轴，写出：

```text
public/generated/tts-*.srt
```

视频内字幕使用程序化打字机动效，复用 `ClaudeTyper` 的逐帧字符揭示和闪烁光标思路；所有生成视频底部只显示一条全局分段进度条。

视频级基础设施统一放在：

```text
src/video-infrastructure/
```

当前包含字幕覆盖层、底部全局分段进度条和统一入口 `VideoInfrastructure`。一站式生成页面可手动选择字幕和进度条方案：

```text
captionStyle: typewriter | classic | none
progressStyle: gradient | thin | none
```

字幕布局进入 Remotion schema 顶层端口，可在 Remotion 参数面板里实时微调：

```text
captionLeft
captionRight
captionBottom
captionMinHeight
captionPaddingX
captionPaddingY
captionFontSize
captionBorderRadius
captionTextColor
captionBackgroundColor
captionFontWeight
captionLineHeight
```

进度条布局同样进入 Remotion schema 顶层端口：

```text
progressLeft
progressRight
progressBottom
progressHeight
progressGap
progressPaddingX
progressLabelFontSize
progressMinSegmentWidth
```

命令行也支持同名 kebab 参数，例如：

```console
node pipeline/text-to-scenes-tts-video.mjs --caption-bottom=34 --caption-background-color=transparent --caption-font-size=28 --progress-height=34 --progress-padding-x=0
```

默认视频基础设施采用紧凑底部布局：字幕没有黑色底板，默认 `captionBackgroundColor=transparent`；分段进度条贴底且横向全长，默认 `progressLeft=0`、`progressRight=0`、`progressPaddingX=0`；字幕默认放在进度条上方约 4px 的位置。画面字幕只允许单行，渲染层强制 `whiteSpace: nowrap`，并按字幕字数和可用宽度自动压缩字号，不能通过换成两行来撑开。

这些不是一次性生成参数。`MultiSceneVideo`、`GeneratedTemplateVideo`、`NarratedVideo` 都把这些字段作为 composition schema/defaultProps 暴露，生成后可以直接在 Remotion 参数面板实时调整。字幕正文 `captions` 是生成数据，不在参数面板里逐句展开；参数面板只调字幕整体抽象样式和整体布局。项目侧仍可继续在 FuckVideo 工作台里修改并保存：

```text
PATCH /api/projects/:id/infrastructure
```

保存后的 `captionLayout` / `progressLayout` 会进入项目数据；导出 props 时会同时写出 Remotion 可编辑的顶层字段，如 `captionBottom`、`captionFontSize`、`progressHeight`。

视频时间结构只保留两层：

```text
caption：字幕/音频对齐
segment：一段话绑定一个画面，同时也是进度条分段单位
```

进度条规则：

```text
只允许一个底部进度条
进度条本身就是全局进度
进度条内部按 segment 分段
不再建立 chapter / chapter generator / chapter API / chapter editor
```

`MultiSceneVideo` 会直接从 `scenes/segments` 生成分段进度，标题来自 `scene.props.title`、`keywords[0]` 或 `sceneType`：

```ts
type ProgressSegment = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  color?: string;
};
```

默认音色：

```text
my-clone
```

脚本内部会把 `my-clone` 映射成具体克隆声音 ID：

```text
cosyvoice-v3.5-plus-bailian-f04eec5bf9e64f14afeefd3bb09cccfe
```

短文本接口：

```text
DashScope WebSocket SpeechSynthesizer
```

长文本接口：

```text
DashScope WebSocket SpeechSynthesizer
```

当前判断逻辑：

```text
所有文本统一走 DashScope 直连；不再调用 <private-tts-relay> 的 TTS 中转。
```

请求体：

```json
{
  "text": "要朗读的文本",
  "language": "Chinese",
  "providerVoice": "音色 ID",
  "styleInstruction": "标准播音风格，吐字清晰，语速平稳，停顿自然"
}
```
期望响应结构：

```json
{
  "success": true,
  "data": {
    "audio": {
      "url": "https://.../audio.wav"
    }
  }
}
```

如果返回不是 JSON，脚本会把 HTML 标签剥掉后报错，避免再出现：

```text
Unexpected token '<', "<html>..." is not valid JSON
```

## 11. 音频标准化

千问 TTS 返回的 WAV 有可能能被 `ffprobe` 读取，但不能被 Remotion Studio 的 mediabunny 稳定识别。为避免：

```text
UnsupportedInputFormatError
Input has an unsupported or unrecognizable format.
```

脚本会做两步：

1. 原始音频下载到：

```text
.runtime/text-to-video/raw-audio/
```

2. 用 `ffmpeg` 转成标准 MP3，输出到：

```text
public/generated/tts-*.mp3
```

转换参数：

```text
-ac 2
-ar 44100
-codec:a libmp3lame
-b:a 192k
```

Remotion props 中使用的是标准化后的 MP3：

```json
{
  "audioSrc": "generated/tts-20260503065237.mp3"
}
```

## 12. 字幕系统

字幕是可选的。

如果没有传 `--skip-srt=true`，脚本会调用：

```text
POST /srt
```

请求体：

```json
{
  "audioUrl": "TTS 返回的音频 URL",
  "language": "Chinese"
}
```

期望响应：

```json
{
  "success": true,
  "data": {
    "srtText": "1\n00:00:00,000 --> 00:00:02,000\n字幕文本\n"
  }
}
```

脚本会把 SRT 解析为 Remotion captions：

```ts
{
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}
```

如果字幕接口失败，脚本会继续渲染只有音频的视频，不会直接中断。

自动片段模式会优先使用字幕时间轴创建画面：

```text
TTS 音频
  -> SRT/captions
  -> pipeline/scene-planner.mjs 的 planScenesFromCaptions()
  -> 每条 caption 生成一个或多个 semantic micro-segment，并写入 fromFrame / durationInFrames / audioStartMs / audioEndMs
  -> MultiSceneVideo 按音频真实时间切镜头
```

也就是说，一站式生成时如果没有跳过字幕，`scenes.length` 必须大于或等于 `captions.length`。每个父 caption 至少要有一个 scene 覆盖；如果被切成多个 micro-segment，第一段的 `audioStartMs` 等于父 caption 的 `startMs`，最后一段的 `audioEndMs` 等于父 caption 的 `endMs`，中间时间按文本 token 比例估算，并写入 `estimatedTiming: true`。当前实现依赖 `/srt` 返回的句段时间戳；后续如果接本地 Whisper/faster-whisper，只需要让它输出同样的 captions/SRT 结构即可。

生成脚本里有硬校验：有 captions 时如果 `scenes.length < captions.length`，任一 caption 没有对应 scene，父 caption 时间没有被 scene 覆盖，或任一 scene 缺少文本，任务必须失败，不能继续输出错位项目。

## 13. Web 任务 API

本地任务服务：

```text
videolab/server/server.mjs
```

默认端口：

```text
3037
```

### 13.1 创建任务

```http
POST /api/jobs
Content-Type: application/json
```

请求体：

```json
{
  "text": "要生成旁白的视频文案",
  "title": "标题",
  "subtitle": "副标题",
  "instruction": "标准播音风格，吐字清晰，语速平稳，停顿自然",
  "mode": "auto-scenes",
  "template": "AtlasMapFlyover",
  "theme": "historical",
  "skipSrt": true
}
```

`mode` 可选：

```text
auto-scenes       默认。一站式自动片段：TTS -> scene-planner -> MultiSceneVideo。
single-template   旧链路。TTS -> GeneratedTemplateVideo -> 选中的单个模板。
```

响应：

```json
{
  "success": true,
  "data": {
    "id": "任务 ID",
    "status": "queued",
    "progress": "排队中"
  }
}
```

### 13.2 查询任务

```http
GET /api/jobs/:id
```

任务状态：

```text
queued
running
succeeded
failed
```

成功后会返回：

```json
{
  "result": {
    "audioFile": "...",
    "srtFile": "...",
    "propsPath": "...",
    "videoFile": "...",
    "durationSeconds": 10,
    "videoUrl": "/files/任务 ID",
    "projectId": "任务 ID",
    "projectUrl": "/video-project/任务 ID"
  }
}
```

`projectUrl` 是备用独立编辑页。Studio 主工作流使用 `projectId` 调 `GET /api/projects/:id/props`，然后把项目加载到左侧 `片段` 页签和中央 `MultiSceneVideo` 预览。

### 13.3 获取视频文件

```http
GET /files/:id
```

返回 `video/mp4`。

### 13.4 项目编辑器 API

生成任务成功后，服务端会把 `propsPath/scenesPath/audio/captions` 转成可编辑项目：

```text
.runtime/video-projects/<projectId>.json
```

列出最近项目：

```http
GET /api/projects
```

返回：

```json
[
  {
    "id": "project-id",
    "title": "南满铁路",
    "updatedAt": 1798776000000,
    "createdAt": 1798772000000,
    "sceneCount": 19,
    "videoUrl": "/project-files/project-id"
  }
]
```

这个接口供 Studio 顶部项目切换器使用，数据来源是 `.runtime/video-projects/*.json`，按 `updatedAt` 倒序排列。

新建空项目：

```http
POST /api/projects
Content-Type: application/json

{
  "title": "未命名视频项目"
}
```

返回完整 `VideoProject`。空项目只建立工作空间，不会自动生成镜头；生成内容仍走右侧 `生成视频` 控制台的 `POST /api/jobs`。

项目页面：

```http
GET /video-project/:id
```

读取项目：

```http
GET /api/projects/:id
```

返回的项目对象会带 `segments` 主视图。`tracks` 仍保留给内部兼容和未来高级模式，但默认前端不暴露多轨：

```ts
type VideoSegment = {
  id: string;
  order: number;
  text: string;
  narrationText: string;
  subtitleText: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  visual: {
    source: "template" | "footage";
    templateId?: string;
    materialId?: string;
    confidence?: number;
    reason?: string;
  };
  status: "ok" | "missing_visual" | "low_confidence" | "needs_review";
  locked: boolean;
};
```

`segments` 由服务端 `projectToSegments(project)` 根据 `scenes / visualLayer / audioSrc` 计算，前端不重复推导片段状态。

把项目转换成 Remotion `MultiSceneVideo` props：

```http
GET /api/projects/:id/props
```

这个接口供 Studio 内嵌前端刷新中央预览使用：右侧生成控制台触发刷新，左侧片段页签提供项目编辑数据。

更新单个片段：

```http
PATCH /api/projects/:id/segments/:segmentId
Content-Type: application/json

{
  "patch": {
    "voiceText": "新的旁白文本",
    "subtitle": "新的字幕/画面文案",
    "startMs": 0,
    "endMs": 4200,
    "templateId": "DocumentReveal",
    "props": {
      "body": "新的画面正文"
    }
  }
}
```

锁定片段：

```http
POST /api/projects/:id/segments/:segmentId/lock
Content-Type: application/json

{
  "locked": true
}
```

重配当前片段画面：

```http
POST /api/projects/:id/segments/:segmentId/rematch-visual
```

响应：

```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": "war-smoke-001",
        "path": "footage/war-smoke-001.mp4",
        "title": "战争硝烟",
        "score": 38,
        "reason": "命中：战争、硝烟、geo_context",
        "copyright": "local"
      }
    ]
  }
}
```

替换当前片段画面：

```http
POST /api/projects/:id/segments/:segmentId/replace-visual
Content-Type: application/json

{
  "candidate": {
    "id": "war-smoke-001",
    "path": "footage/war-smoke-001.mp4",
    "title": "战争硝烟",
    "score": 38,
    "reason": "命中：战争、硝烟"
  }
}
```

重排片段：

```http
POST /api/projects/:id/reorder
Content-Type: application/json

{
  "sceneIds": ["scene-002", "scene-001"]
}
```

旧接口 `/scenes/:sceneId`、`rematch-material`、`replace-material` 仍兼容，但新前端应优先使用 `/segments/:segmentId`、`rematch-visual`、`replace-visual`。

总导出：

```http
POST /api/projects/:id/export
```

导出会执行：

```text
project.json -> projectToMultiSceneProps -> Remotion render MultiSceneVideo -> out/video-project-*.mp4
```

## 14. FuckVideo 工作台：以插件方式扩展 Remotion

打开就是原版 Remotion Studio。扩展集中在右下角的 **FV** 悬浮按钮，点开是一张卡片工作台，再点收起。卡片只放 Remotion 没有的功能：

| 页签 | 功能 |
| --- | --- |
| 项目 / 分镜 | 切换、新建项目，载入到 Studio；分镜列表，点击后 Studio 跳到该分镜开头；改旁白、字幕、视觉意图；锁定、上移下移；重配并替换素材；解析证据 |
| 生成视频 | 文案、标题、模式（自动分镜 / 单模板）、字幕和进度条样式、语音指令；显示任务日志，完成后自动载入新项目 |
| 设置 | Studio 界面中文开关；关闭 FuckVideo（停止全部服务） |

预览、时间线、字幕/进度条布局等参数（`MultiSceneVideo` 的 schema 面板）、渲染出片，都用 Studio 自带的功能。

用到的 Remotion 扩展点（全部公开 API）：

| 扩展点 | 用在哪里 |
| --- | --- |
| `getRemotionEnvironment().isStudio` | `src/index.ts` 只在 Studio 里懒加载工作台，渲染时不加载 |
| `@remotion/studio` 的 `goToComposition`、`seek` | 载入项目后切到 `MultiSceneVideo`，点分镜跳帧 |
| `<Composition>` + zod `schema` | 32 个模板全部带 schema，Studio 右侧参数面板直接可用 |
| 文件形式的 defaultProps | 载入项目 = 服务端写 `src/generated/currentMultiSceneDefaultProps.ts`，Studio 热更新 |
| `@remotion/bundler` + `@remotion/renderer` / CLI | 生成任务渲染出片、`tests/verify-upstream.mjs` |

（`@remotion/studio` 的 `updateDefaultProps` 在 4.0.542 是 `saveDefaultProps` 的别名，会把参数写回 `Root.tsx` 源码，所以载入项目不用它。）

隔离方式：

- 工作台挂在一个 Shadow DOM 里，样式和 Studio 互不影响，也不读取 Studio 的页面元素。
- `eslint.config.mjs` 规定 `src/` 和 `videolab/overlay/` 只能从 `remotion`、`@remotion/<包名>` 这些公开入口导入，禁止 `Internals`、`StudioInternals` 和 `@remotion/*/内部路径`。

**界面中文**（设置里的开关，默认关闭）：Remotion Studio 没有多语言接口，这是扩展里唯一会改 Studio 页面的部分，所以做成可开关、可完全恢复：

- 只替换整段完全匹配词典的文字，以及 `title`、`aria-label`、`placeholder` 提示；
- 不碰输入框、下拉框的值和可编辑区域，Studio 参数面板里填的值不会被改；
- 跳过预览画面（`#remotion-canvas`、`.remotion-studio-composition-container`）和工作台自己；
- 关闭后所有文字恢复英文原样；渲染不加载工作台，成片不受影响。
- 词典 `videolab/overlay/i18n/dict.ts`，按 @remotion/studio 4.0.542 的实际文案整理，两百多条，可自己增补。升级后如有改名的按钮，只是暂时显示英文。

新功能放哪：

| 要加的东西 | 位置 |
| --- | --- |
| 新动画模板 | `src/templates/`，在 `src/Root.tsx` 登记并写 zod schema |
| 新的生成步骤（配音、分镜、素材匹配等） | `pipeline/` |
| 新的工作台功能 | `videolab/overlay/`，需要的接口加在 `videolab/server/server.mjs` |

## 15. 升级 Remotion

1. 根目录：`npx remotion upgrade`。它把所有 `@remotion/*` 包统一升到同一版本（Remotion 要求版本完全一致）。Windows 上它可能报 `spawn npm ENOENT`，这时直接运行它打印出来的那条 `npm i --save-exact ...` 命令即可；`@remotion/studio`、`@remotion/bundler`、`@remotion/renderer` 也一起写进去。
2. `npm run verify:upstream`：依次跑 lint 和类型检查、每个合成渲染一帧（对照 `tests/fixtures/compositions.json`，少了合成就报错）、无头浏览器打开 Studio 检查悬浮工作台（载入项目、跳帧、界面中文开关）。
3. 全部通过就提交。新增或删除合成后用 `node tests/verify-upstream.mjs --update` 更新期望列表。

4.x 之内的升级就是以上几步。大版本（如 5.0）先看官方迁移指南。

## 16. 一站式自动片段入口验证

启动：

```console
npm run dev:video
```

打开：

```text
http://127.0.0.1:3037
```

确认 FuckVideo 工作台「生成视频」页签里有：

```text
生成模式
自动片段
生成初版项目
生成进度
```

也可以直接验证 API：

```powershell
$body = @{
  text = "条约上用词谨慎，所谓转让遮住了更复杂的权力关系。南满铁路成为新的利益轴线。"
  title = "一站式自动片段测试"
  instruction = "标准播音风格，吐字清晰，语速平稳，停顿自然"
  mode = "auto-scenes"
  skipSrt = $true
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3037/api/jobs" -ContentType "application/json" -Body $body
```

任务成功日志中应看到：

```text
[1/6] 正在生成千问 TTS 旁白音频...
[4/6] 正在规划自动片段...
[5/6] 正在渲染 Remotion 自动片段视频...
[6/6] 已完成。
```

## 17. 当前可选择模板

生成视频扩展可以选择：

```text
DocumentReveal                历史文件揭示
QuoteReveal                   引文揭示
PortraitFocus                 人物身份卡
ConceptDiagram                概念关系图
MetaphorVisual                隐喻可视化
FootageScene                  本地素材片段
MixkitReveal                  Mixkit 揭示预设
RemotionLabShowcaseAsset     RemotionLab showcase 素材预览入口
SinoJapaneseWarDemo          中日战争历史地球
HistoricalGlobeTexture1938   1938 历史地球纹理
AtlasMapFlyover              世界地图飞越
MapRouteFlyover              路线地图飞越
ThreeProductStage            三维产品舞台
ThreeParticleNebula          三维粒子星云
ThreeCardCascade             三维卡片级联
ThreeBouncingSpheres         三维弹跳球
ClaudeTyper                  命令行打字机
SpotlightReveal              聚光灯揭示
ProceduralFish               程序鱼群
RulerProgress                进度尺
SvgAssembly                  SVG 组装
Wechat2D                     微信对话
ThreeDTicker                 三维色块滚动
VinylPlayer                  黑胶播放器
PromptTextRotation           提示词文本轮播
PromptProgressBar            提示词进度条
PromptHistogram              提示词柱状图
PromptAnimatedShapes         提示词动态图形
```

注意：`GeneratedTemplateVideo` 包装这些模板时，主要控制的是模板选择、音频、字幕和视频时长。每个单独模板的细颗粒 props 编辑是在 Remotion Studio 合成详情里完成。

自动片段模式不使用这个下拉选择的单一模板，而是由 `pipeline/scene-planner.mjs` 根据文本内容自动选择多个镜头模板。

## 18. 从零复现近似工程的步骤

如果要从一个空 Remotion 项目复现类似工程，按这个顺序做：

1. 初始化 Remotion 项目。
2. 安装 Three.js 相关依赖：

```console
npm i three @react-three/fiber @remotion/three
```

3. 准备模板组件：

```text
src/templates/MotionTemplates.tsx
src/templates/MapTemplates.tsx
src/templates/ThreeDTemplates.tsx
src/templates/PromptMotionExamples.tsx
src/templates/EarthGlobeTemplate.tsx
src/templates/NarratedVideo.tsx
src/templates/GeneratedTemplateVideo.tsx
src/templates/MultiSceneVideo.tsx
src/templates/DocumentReveal.tsx
src/templates/AutoSceneTemplates.tsx
src/templates/FootageScene.tsx
src/templates/sceneRegistry.tsx
src/templates/visual-provider-manifest.json
```

4. 在 `src/Root.tsx` 注册所有 Composition。
5. 给每个 Composition 添加：

```text
schema
defaultProps
durationInFrames
fps
width
height
```

6. 写 `pipeline/text-to-video.mjs`：

```text
解析 CLI 参数
调用 TTS API
下载音频
ffmpeg 转 MP3
ffprobe 读时长
写 props JSON
调用 Remotion CLI render
```

7. 写 `pipeline/scene-planner.mjs` 和 `pipeline/text-to-scenes-tts-video.mjs`：

```text
分句 / 读取 captions
把过长 caption 拆成 semantic micro-segments
为每个 micro-segment 生成 semanticCard 和 visualContract
调用 visual-resolver.mjs 做 VisualProvider 握手
优先调度 Remotion 程序动画资产，footage 只作为强命中候选
生成 scenes JSON，保留 visualCandidates 和 decisionTrace
把 TTS 音频、字幕和 scenes 送入 MultiSceneVideo
```

8. 写 caption-driven 片段生成：

```text
读取 captions/SRT
每条 caption 调用 planScenesFromCaptions()
过长 caption 继续拆成 semantic micro-segments
用 caption 或父 caption 内估算的 start/end 计算 fromFrame 和 durationInFrames
每个 scene 只使用当前 micro-segment 文本做 semanticCard、visualIntent 和素材匹配
没有 captions 时才使用文本估算时长
```

9. 写 `src/templates/visual-provider-manifest.json` 和 `pipeline/visual-resolver.mjs`：

```text
把程序动画、兜底模板、footage 统一登记为 VisualProvider
为每个 provider 写 accepts / rejectIf / capabilities / propMapping / score / duration
resolver 对 Programmatic / Template / Footage 三类 provider 做硬过滤、打分、填参和决策追踪
每个 scene 输出 providerType / visualProviderId / visualCandidates / decisionTrace
```

10. 写 `pipeline/asset-indexer.mjs`、`pipeline/asset-matcher.mjs` 和 `pipeline/scene-asset-planner.mjs`：

```text
扫描 public/footage
生成 public/generated/asset-index.json
给 resolver 提供 footage 候选
兼容旧流程：给已有 scenes 单独追加 visualLayer
```

11. 写 `pipeline/project-store.mjs` 和 `pipeline/export-video-project.mjs`：

```text
把生成结果转成 VideoProject
保存 .runtime/video-projects/<id>.json
支持 scene patch / lock / reorder / replace material
把项目重新转换成 MultiSceneVideo props
调用 Remotion 总导出
```

12. 写 `videolab/server/server.mjs`：

```text
GET /                    跳转到 Remotion Studio
POST /api/shutdown       停止全部服务
POST /api/jobs
GET /api/jobs/:id
GET /api/projects/:id
PATCH /api/projects/:id/segments/:segmentId
POST /api/projects/:id/segments/:segmentId/rematch-visual
POST /api/projects/:id/segments/:segmentId/replace-visual
POST /api/projects/:id/export
GET /files/:id
```

13. 写 `videolab/overlay/`（Studio 里的悬浮工作台）：

```text
src/index.ts：getRemotionEnvironment().isStudio 时 import("../videolab/overlay/mount")
mount.tsx：在 document.body 上建一个 Shadow DOM 宿主，渲染 Workbench
Workbench.tsx：FV 悬浮按钮 + 卡片（项目/分镜、生成视频、设置）
载入项目：POST /api/projects/:id/studio-default-props，然后 goToComposition("MultiSceneVideo")
点分镜：seek(帧号)
生成视频：POST /api/jobs，每 2 秒轮询 GET /api/jobs/:id
i18n/：可开关的 Studio 界面中文
```

14. 写 `videolab/server/start.mjs`：

```text
启动 videolab/server/server.mjs（:3037）
启动 remotion studio（:3000）
```

15. 在 `package.json` 增加：

```json
{
  "scripts": {
    "dev": "remotion studio",
    "dev:video": "node videolab/server/start.mjs",
    "plan-scenes": "node pipeline/scene-planner.mjs",
    "text-to-scenes-video": "node pipeline/text-to-scenes-video.mjs",
    "text-to-scenes-tts-video": "node pipeline/text-to-scenes-tts-video.mjs",
    "index-assets": "node pipeline/asset-indexer.mjs",
    "match-assets": "node pipeline/scene-asset-planner.mjs",
    "export-project": "node pipeline/export-video-project.mjs",
    "text-to-video": "node pipeline/text-to-video.mjs",
    "videolab": "node videolab/server/server.mjs",
    "lint": "eslint src videolab/overlay && tsc",
    "verify:upstream": "npm run lint && node tests/verify-upstream.mjs && node tests/videolab-smoke.mjs"
  }
}
```

16. 建立素材目录：

```text
public/generated/
public/footage/
public/maps/
public/geojson/
.runtime/text-to-video/jobs/
.runtime/text-to-video/raw-audio/
.runtime/video-projects/
out/
```

17. 跑验证：

```console
npm run lint
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
npm run dev:video
```

## 19. 验证方式

代码验证：

```console
npm run lint
```

合成注册验证：

```console
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
```

预期能看到 32 个合成。

schema 覆盖验证：

```powershell
$root = Get-Content -Raw src\Root.tsx
[pscustomobject]@{
  CompositionTags = ([regex]::Matches($root,'<Composition')).Count
  SchemaProps = ([regex]::Matches($root,'schema=')).Count
  DefaultProps = ([regex]::Matches($root,'defaultProps=')).Count
}
```

当前应为：

```text
CompositionTags : 30
SchemaProps     : 30
DefaultProps    : 30
```

运行态验证：

```console
npm run dev:video
```

打开：

```text
http://localhost:3000   Remotion Studio（右下角 FV 按钮是 FuckVideo 工作台）
```

确认：

- `npm run test:videolab` 通过：悬浮按钮出现，卡片能展开，载入项目后 Studio 切到 `MultiSceneVideo`，点分镜不报错，界面中文能打开并恢复英文，页面无报错。
- 选择任意合成，右侧能看到 props 编辑区。
- 生成视频任务能进入运行状态。

升级 Remotion 后一条命令跑完全部检查：`npm run verify:upstream`。

## 20. 常见问题

### 20.1 Studio 里提示没有可编辑参数

原因通常是 `<Composition>` 没有传 `schema`。

本项目当前要求：

```text
每个 Composition 都必须有 schema 和 defaultProps
```

如果新增模板后忘记写 schema，Studio 会提示：

```text
Make the props of this composition interactively editable by adding a schema prop to the <Composition> component.
```

### 20.2 `UnsupportedInputFormatError`

通常是音频格式不被 Remotion Studio 的 mediabunny 识别。

本项目已经通过 `ffmpeg` 把 TTS 原始音频转成标准 MP3。检查新生成 props 中的音频路径应类似：

```json
{
  "audioSrc": "generated/tts-20260503065237.mp3"
}
```

如果仍然报错，检查：

```console
ffprobe public\generated\tts-xxxx.mp3
```

### 20.3 `Unexpected token '<'`

说明某个接口返回了 HTML 错误页，而不是 JSON。

检查：

- TTS API 地址是否正确。
- 服务是否登录/鉴权有效。
- 代理是否返回 502/404。
- `postJson()` 报错里剥离出的文本。

### 20.4 端口被占用

默认端口：

```text
3000 Remotion Studio
3037 VideoLab 接口服务
```

Windows 查看端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,3037
```

结束进程：

```powershell
Stop-Process -Id <PID> -Force
```

### 20.5 生成任务成功但页面打不开视频

检查：

- `out/` 下是否有 `text-to-video-*.mp4`。
- `GET /api/jobs/:id` 是否返回 `result.videoUrl`。
- `GET /files/:id` 是否返回 `video/mp4`。

## 21. 安全注意

不要把 API Key 写进前端文件。

浏览器只应该调用：

```text
http://127.0.0.1:3037
```

真正的 TTS 鉴权应该放在后端代理服务里。

当前前端插件只发送：

- 文案
- 标题
- 副标题
- 生成模式
- 模板 ID
- 语音指令
- 字幕选项

## 22. 当前状态

当前工程状态：

- Remotion Studio 可运行。
- 生成视频扩展已集成到 Studio 页面：原生“渲染”按钮旁边是生成入口，右侧浮层是生成控制台，左侧 explorer 是片段页签。
- 右侧 Remotion 原生参数栏保持给 `schema/defaultProps` 编辑使用，不承载本项目片段 UI。
- 32 个合成都已注册 schema 和 defaultProps。
- 文本生成视频默认使用 `GeneratedTemplateVideo`。
- 自动片段系统使用 `MultiSceneVideo`，可以把长文拆成一段话绑定一个画面的片段时间轴。
- 自动片段系统会在有 captions/SRT 时使用音频真实时间轴对齐片段。
- 自动片段系统会给每个片段写入 `semanticCard`、`visualContract`、`visualGrounding`、`visualCandidates` 和 `decisionTrace`。
- Visual Resolver 会优先调度 Remotion 程序动画 provider，并在 `asset-index.json` 存在时把本地 footage 作为强命中候选。
- TTS 音频会统一转成标准 MP3。
- 可选 SRT 字幕。
- 输出视频落到 `out/`。
- 临时素材落到 `public/generated/` 和 `.runtime/text-to-video/`。

最后一次应运行的验证命令：

```console
npm run lint
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
```

## 23. 自动片段系统

自动片段系统解决的是“长文案如何变成有镜头切换的视频”，而不是只给整段文本套一个模板。

当前链路：

```text
文本 + TTS 音频
  -> pipeline/scene-planner.mjs 拆句
  -> captions/SRT 存在时建立父 caption 时间轴
  -> 过长 caption 拆成 semantic micro-segments
  -> SegmentSemanticCard
  -> Visual Contract / Evidence Mode
  -> visual-provider-manifest.json 执行 VisualProvider 握手
  -> Visual Resolver 优先调度 Programmatic Asset
  -> asset-index.json 作为 footage 候选参与强命中竞争
  -> visualCandidates + decisionTrace
  -> scenes JSON
  -> MultiSceneVideo
  -> Remotion Sequence 按时间轴拼接多个模板
```

新增文件：

- `pipeline/scene-planner.mjs`：文本拆块、caption 驱动片段生成、关键词提取、语义卡、视觉合约、调用 Visual Resolver 生成 scene。
- `pipeline/visual-resolver.mjs`：统一调度 `VisualProvider`，按 `programmatic / footage / static / fallback` 四类资源执行握手、打分、填参和决策追踪。
- `pipeline/sound-resolver.mjs`：根据 `visualContract.kind`、事件动作和叙事角色生成 `soundDesign` 元数据。
- `pipeline/timeline-aligner.mjs`：旧兼容工具；新一站式生成不再用它把 captions 按文本长度分组到 scenes。
- `pipeline/asset-indexer.mjs`：扫描 `public/footage/`，生成素材索引草稿。
- `pipeline/asset-matcher.mjs`：旧兼容工具，给已有 scenes 单独追加 footage 候选；一站式生成主链路优先走 `visual-resolver.mjs`。
- `pipeline/scene-asset-planner.mjs`：给已有 scenes JSON 追加 `visualLayer`。
- `pipeline/text-to-scenes-video.mjs`：生成 scenes/props，并可直接渲染 `MultiSceneVideo`。
- `pipeline/import-mixkit-reveal.mjs`：抓取 Mixkit Reveal 分类两页，解析 26 个详情页、下载 AE zip/preview/poster，并写入可追踪 manifest。
- `src/templates/DocumentReveal.tsx`：唯一文件证据展示模板，承接条约、文件、策论、档案、原文证据类片段。
- `src/templates/MixkitReveal.tsx`：把 26 个 Mixkit reveal 源素材复刻为一个可参数化 Remotion composition，运行时通过 `presetId` 切换视觉结构。
- `src/templates/mixkitRevealPresets.ts`：记录 26 个 Mixkit 源素材的 `presetId`、`mixkitId`、源链接、颜色和 `effectKind`。
- `src/templates/AutoSceneTemplates.tsx`：`PortraitFocus`、`QuoteReveal`、`ConceptDiagram`、`MetaphorVisual` 四类解释型镜头模板。
- `src/templates/FootageScene.tsx`：本地素材片段模板。
- `src/templates/sceneRegistry.tsx`：把 `templateId` 映射到现有 Remotion 模板。
- `src/templates/MultiSceneVideo.tsx`：多镜头容器，使用 Remotion `Sequence` 拼接时间轴。
- `src/templates/visual-provider-manifest.json`：当前主说明书，记录每个可调度视觉资源的 `providerType`、`accepts/rejects`、`capabilities`、`propSchema`、`propMapping`、`scoring`、时长和声音能力。
- `src/templates/template-manifest.json`：旧兼容说明书，保留给历史脚本和人工查阅，不再是一站式自动片段的主调度入口。

### 23.1 Visual Provider 说明书

`visual-provider-manifest.json` 是 planner 和 resolver 理解视觉资源的根。视觉资源统一叫 `VisualProvider`，不是只分“模板”和“素材”：

```ts
type VisualProviderType = "programmatic" | "footage" | "static" | "fallback";
```

从现在开始，动画握手只认一个入口：`src/templates/visual-provider-manifest.json`。不要再让 `Root.tsx`、`sceneRegistry.tsx`、前端下拉框、素材清单各自发明一套模板语义。新增或改造动画时按这条链路接入：

```text
Pencil / AE / 参考视频
  -> provider.design.layerModel
  -> provider.accepts / capabilities / propMapping
  -> sceneRegistry runtime template
  -> Root.tsx composition schema/defaultProps
  -> visual-resolver decisionTrace
```

运行时校验命令：

```console
npm run validate-animation-contracts
```

校验器在 `pipeline/animation-contracts.mjs`。它会读取 `visual-provider-manifest.json`，并检查：

- provider id 是否唯一。
- programmatic provider 的 `runtime.sceneRegistryId` 是否存在于 `sceneRegistry.tsx`。
- 对应 Composition 是否在 `Root.tsx` 注册。
- provider 是否有 `accepts.visualKinds`、`capabilities`、`propMapping`。
- Pencil 设计引用如果声明为 `sourceType: "pencil"`，必须写清 `.pen` 文件和 nodeIds。

Resolver 也通过同一个规范化层读取 provider。provider 的业务能力名和实际渲染模板可以分开：

```json
{
  "id": "ColdOpenAtmosphere",
  "templateId": "MixkitReveal",
  "runtime": {
    "sceneRegistryId": "MixkitReveal",
    "compositionId": "MixkitReveal"
  }
}
```

这里 `ColdOpenAtmosphere` 是调度语义，`MixkitReveal` 是实际 Remotion 渲染组件。以后所有“一个模板承接多个视觉意图”的情况都必须这样写，不要在代码里散落 if/else。

#### 23.1.1 Pencil 接入边界

Pencil 只作为视觉蓝图输入，不作为自动生成器。正确接法：

```text
designs/animation-blueprints/*.pen
  -> Pencil MCP 读取变量 / 布局 / 节点
  -> export selected frames 到 public/design-references/<providerId>/
  -> 把层结构写入 provider.design.layerModel
  -> 手写或改造 Remotion 模板
```

`provider.design` 建议格式：

```json
{
  "design": {
    "sourceType": "pencil",
    "status": "linked",
    "intent": "文件证据展示：纸张、正文、高亮、镜头推进、光影",
    "layerModel": ["background", "paper", "text", "highlight", "camera", "light"],
    "pencil": {
      "filePath": "designs/animation-blueprints/document-reveal.pen",
      "nodeIds": ["document-reveal-main"]
    }
  }
}
```

Pencil 导出的 PNG/PDF 只能当参考图或验收图，不得直接进入 `visualDecision` 当成动画实现。真正参与调度的是 Remotion provider contract。

### 23.1.2 Evidence Resolver：史料优先

历史视频的主链路必须是：

```text
文案片段
  -> 识别可考据实体
  -> 自动检索真实素材/史料
  -> 绑定来源
  -> 没找到才用程序动画
  -> 每个 segment 可编辑素材、标题、时间
  -> Remotion 渲染
```

实现入口：

```text
pipeline/evidence-resolver.mjs
```

核心类型：

```ts
type EvidenceNeed = {
  segmentId: string;
  kind: "document" | "person" | "place" | "event" | "map" | "newspaper";
  query: string;
  mustFind: boolean;
  entities: string[];
};

type EvidenceSource = {
  id: string;
  provider: "local" | "wikimedia" | "wikipedia" | "archive" | "loc" | "manual";
  title: string;
  url: string;
  thumbnail?: string;
  mediaUrl?: string;
  localPath?: string;
  license?: string;
  confidence: number;
  reason: string;
};
```

当前 v1 已接：

```text
local asset index
Wikimedia Commons API
Wikipedia page image API
```

命中的远程图片会缓存到：

```text
public/evidence-cache/
```

Remotion 渲染只读取缓存后的本地路径，避免导出时依赖远程图片。没有找到真实素材时，不伪造史料；segment 会保留程序动画并标记 `fallback_used` 或 `missing_evidence`。

API：

```http
POST /api/projects/:id/evidence/extract
POST /api/projects/:id/evidence/resolve
GET  /api/projects/:id/segments/:segmentId/evidence
PATCH /api/projects/:id/segments/:segmentId/evidence
```

一键生成成功后，服务端会自动执行一次 `resolveEvidenceForProject()`。硬规则：

```ts
const HARD_RULES = {
  noFakeDocument: true,
  noFakePortrait: true,
  noFakeHistoricalPhoto: true,
  evidenceFirst: true,
  fallbackMustBeMarked: true,
};
```

视觉优先级：

```text
local 已入库素材
  -> Wikimedia Commons
  -> Wikipedia page image
  -> Archive.org / LOC（后续扩展）
  -> programmatic template
```

规则：

```text
出现条约 / 文件 / 报告 / 档案：先找真实扫描或图片。
出现人物：先找真人照片或肖像图。
出现地点 / 铁路 / 战场：先找真实地图、照片或可信图像。
找不到真实资料：才允许 DocumentReveal / PortraitFocus / MapRouteFlyover 等程序动画，并标记来源状态。
```

含义：

- `programmatic`：Remotion 程序动画资产，当前产品的主打能力，优先调度。
- `footage`：本地影视/实拍素材，适合强命中、氛围增强或真实素材引用。
- `static`：静态图片、地图、档案图。
- `fallback`：低置信兜底，比如 `NarratedScene`。

每个 provider 至少包含：

```json
{
  "id": "DocumentReveal",
  "providerType": "programmatic",
  "displayName": "历史文件揭示",
  "category": "document",
  "accepts": {
    "visualKinds": ["document", "quote", "telegram"],
    "requiredAnyEntityGroups": ["documents", "objects"],
    "allowedActions": ["show_evidence", "transfer", "quote"],
    "requiredCapabilities": ["render_text", "highlight_text", "show_document"]
  },
  "rejects": {
    "mustNotShowConflicts": true
  },
  "capabilities": ["render_text", "highlight_text", "show_document", "show_movement", "loopable"],
  "propMapping": {
    "title": "semanticCard.entities.documents[0] || semanticCard.summary",
    "body": "snippetFromSegment",
    "highlightText": "visualContract.mustShow[0]",
    "highlightWords": "visualContract.mustShow",
    "style": "'old_paper'",
    "highlightMode": "'underline'"
  },
  "scoring": {
    "kindMatch": 52,
    "requiredEntityMatch": 35,
    "mustShowMatch": 24,
    "actionMatch": 12
  },
  "duration": { "minSec": 4, "idealSec": 7, "maxSec": 12, "canLoop": true }
}
```

### 23.2 DocumentReveal 证据展示模板

`DocumentReveal` 是唯一文件展示模板，不再保留 `DocumentRevealPro` 这类平行名字。所有 document / quote 的证据展示都先调度它，避免出现“基础版”和“高级版”并存导致调度器或用户误选。

模板目标不是把文字放到纸上，而是复刻解说视频里常见的 Evidence Reveal 视觉公式：

```text
背景/空间
  -> 纸张/书页/现代卡片
  -> 文本排版
  -> 手绘感高亮
  -> 非线性推镜和光影
```

标准节奏：

```text
0s - 1s    文件进入：淡入、轻微位移、轻微旋转
1s - 3s    稳定阅读：保持可读
3s - 5s    高亮画出：underline / box / marker
5s - 7s    镜头推进：Remotion Easing.bezier 慢快慢，不用线性 scale
```

参数合约：

```ts
type DocumentRevealProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  highlightText?: string;
  highlightWords?: string[];
  style?: "old_paper" | "book" | "modern";
  highlightMode?: "underline" | "box" | "marker";
  maxSnippetChars?: number;
  sealText?: string;
};
```

实现规则：

- `extractDocumentSnippet(body, highlightText, maxSnippetChars)` 只展示“证据句 + 上下文”，默认控制在 120 字以内，不把整段文案塞进纸面。
- `old_paper` 用泛黄纸、颗粒、微抖、印章、vignette 和光扫，适合条约、档案、信件。
- `book` 用米白书页和轻阴影，适合知识类原文引用。
- `modern` 用深色卡片和蓝色强调，适合解释类证据。
- 高亮必须像“画出来”，不能只用死板矩形；当前用确定性的 SVG 手绘路径实现 underline / box，marker 用渐进荧光笔背景。
- 字体优先 `Noto Serif SC` / `LXGW WenKai`，再回退到 Georgia/serif；不要用默认 sans-serif 承载历史文件正文。
- 可以参考 AE 模板、Envato / MotionArray / Artlist 的 document reveal、paper zoom、archive opener 动效节奏，但 Remotion 里必须重写为逐帧确定性动画，不能依赖运行时时间轴。

工程边界：

- 不引入另一个 `DocumentRevealPro`。
- 不把 `framer-motion` 作为 Remotion 渲染主动画引擎；视频帧必须由 `frame`、`spring`、`interpolate`、`Easing.bezier` 决定。
- 如果将来引入 `rough.js` 或真实纸张 PNG，必须仍保持可复现输入、可离线渲染，并在 `Root.tsx` schema 和 `visual-provider-manifest.json` 同步暴露参数。

### 23.3 Mixkit Reveal 资产复刻流程

Mixkit Reveal 的处理方式是“源素材下载 + 程序化复刻”，不是把 After Effects 工程文件直接当成 Remotion 运行时。当前已支持 Mixkit Reveal 分类的 26 个免费 AE 模板：

```console
npm run import-mixkit-reveal
```

脚本会读取：

```text
https://mixkit.co/free-after-effects-templates/reveal/
https://mixkit.co/free-after-effects-templates/reveal/?page=2
```

输出：

```text
asset-source/mixkit-reveal/manifest.json
asset-source/mixkit-reveal/originals/*.zip      本地忽略
asset-source/mixkit-reveal/previews/*.mp4       本地忽略
asset-source/mixkit-reveal/posters/*.jpg        本地忽略
```

`manifest.json` 会随源码提交，用来证明导入来源、license note、下载 URL、预览 URL、poster URL 和每个模板的 `effectKind`。原始 zip、preview、poster 是重资产下载缓存，默认不提交；需要在另一台机器复刻时重新运行 import 脚本即可。

Remotion 侧只有一个公开 composition：

```text
MixkitReveal
```

它通过 `presetId` 切换 26 个源素材对应的视觉结构：

```ts
type MixkitRevealProps = {
  presetId?: MixkitRevealPresetId;
  title?: string;
  subtitle?: string;
  logoText?: string;
  body?: string;
  accentColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  intensity?: number;
  showSourceLabel?: boolean;
};
```

设计规则：

- 不在 Remotion Studio 左侧注册 26 个重复 composition，避免模板列表膨胀。
- `MixkitReveal` 是一个 programmatic `VisualProvider`，用于 intro、summary、transition、概念揭示、quote 氛围等片段；document evidence 仍优先走 `DocumentReveal`。
- 复刻目标是 AE 模板的视觉公式：遮罩、光扫、图形推进、粒子、glitch、neon、radial wipe、lower third，而不是二进制 `.aep` 图层自动转换。
- 视频渲染必须是 frame-driven：`useCurrentFrame()`、`spring()`、`interpolate()`、`Easing.bezier()`；手绘边框用 `roughjs` 的 deterministic generator 输出 SVG path，不依赖浏览器运行时动画。
- 26 个 preset 的源 ID 和链接保存在 `mixkitRevealPresets.ts`，未来要做更接近 AE 的逐模板复刻时，以该文件作为唯一索引入口。

## 24. 可编辑项目系统

自动生成不再只是一次性 MP4。任务完成后会生成一个可编辑 `VideoProject`：

```ts
type VideoProject = {
  id: string;
  title: string;
  audioSrc: string;
  captions: Caption[];
  scenes: TimelineScene[];
  assets: AssetItem[];
  history: ProjectOperation[];
};
```

兼容 scene 结构：

```ts
type TimelineScene = {
  id: string;
  order: number;
  startMs: number;
  endMs: number;
  voiceText: string;
  subtitle: string;
  sceneType: string;
  templateId: string;
  props: Record<string, unknown>;
  semanticCard: SegmentSemanticCard;
  visualContract: {
    kind: string;
    mustShow: string[];
    shouldShow: string[];
    mustNotShow: string[];
    evidenceMode: "explicit_text" | "asset_match" | "template_abstraction";
    allowedSources: string[];
  };
  visualGrounding: {
    source: "explicit_text" | "asset_match" | "template_abstraction";
    evidence: string[];
    hallucinationRisk: "low" | "medium" | "high";
  };
  providerType?: "programmatic" | "template" | "footage";
  visualProviderId?: string;
  visualLayer: {
    type: "template" | "footage";
    providerType?: "programmatic" | "template" | "footage";
    templateId?: string;
    clipId?: string;
    path?: string;
    startMs?: number;
    endMs?: number;
    reason?: string;
    confidence?: number;
  };
  visualCandidates: VisualCandidate[];
  decisionTrace: DecisionTrace;
  alternatives: MaterialCandidate[];
  locked: boolean;
};

type VisualCandidate = {
  source: "programmatic" | "template" | "footage";
  providerType: "programmatic" | "template" | "footage";
  id: string;
  templateId?: string;
  materialId?: string;
  score: number;
  reason: string | string[];
  mappedProps?: Record<string, unknown>;
};

type DecisionTrace = {
  rejectedProviders: { id: string; providerType?: string; reason: string }[];
  candidateProviders: { id: string; providerType: string; score: number; reason: string[] }[];
  rejectedTemplates?: { id: string; reason: string }[];
  candidateTemplates?: { id: string; score: number; reason: string[] }[];
  candidateAssets?: { id: string; score: number; reason: string }[];
  finalChoice: { type: "programmatic" | "template" | "footage" | "none"; id: string; score?: number; reason: string; mappedProps?: Record<string, unknown> };
};
```

项目编辑入口是 Studio 里的 FuckVideo 工作台（FV 悬浮按钮 ->「项目 / 分镜」）：

- 选项目即载入：服务端写出 `MultiSceneVideo` 的 defaultProps，Studio 热更新并切到 `MultiSceneVideo`。旧地址 `http://127.0.0.1:3037/video-project/:id` 会跳转到 Studio。
- 分镜列表，点击后 Studio 预览跳到该分镜开头。
- 支持：修改旁白/字幕/视觉意图、锁定片段、调整顺序、重配画面、替换画面、解析证据；每次保存后自动重新载入到 Studio。
- 预览、时间线、字幕/进度条布局（schema 面板）、渲染导出都在 Studio 里做。

核心文件：

```text
videolab/overlay/Workbench.tsx
pipeline/project-store.mjs
pipeline/export-video-project.mjs
```

`locked` 是给后续 AI 微调预留的边界。后续做“重新生成当前项目”时，应该跳过 `locked: true` 的片段。

操作历史保存在项目 JSON 的 `history` 内，目前记录最近 80 次操作快照，用于后续补撤销/重做：

```ts
type ProjectOperation = {
  id: string;
  type: "replaceMaterial" | "updateScene" | "reorderScene";
  patch: unknown;
  snapshotBefore: VideoProject;
  createdAt: number;
};
```

总导出流程：

```text
VideoProject
  -> projectToMultiSceneProps()
  -> public/generated/props-project-*.json
  -> remotion render MultiSceneVideo
  -> out/video-project-*.mp4
```

### 24.1 统一 props

自动片段模板统一吃一组通用字段，再由 `sceneRegistry.tsx` 适配到具体模板：

```ts
type CommonSceneProps = {
  title?: string;
  subtitle?: string;
  body?: string;
  keywords?: string[];
  highlightWords?: string[];
  visualFocus?: string;
  tone?: "historical" | "dark" | "clean" | "dramatic";
};
```

例如：

- `DocumentReveal` 使用 `title/subtitle/body/highlightText/highlightWords/style/highlightMode/maxSnippetChars/sealText`，旧 `tone` 只作为兼容映射。
- `AtlasMapFlyover` 使用 `title/subtitle/keywords/visualFocus`。
- `QuoteReveal` 使用 `body/highlightWords/source`。
- `ConceptDiagram` 使用 `title/body/keywords` 生成节点关系。

### 24.2 片段语义合约

planner 输出的 scene 不再只是 `{ templateId, props }`，而是完整的可执行片段合约。当前实现路径是：

```text
Caption Segment
  -> Semantic Card
  -> Visual Contract
  -> VisualProvider Handshake
  -> candidates + decisionTrace
  -> Studio 左侧片段理解面板
```

`semanticCard` 是调度器理解片段的主结构，`visualContract` 是所有 `VisualProvider` 必须遵守的画面契约，`visualGrounding` 用来约束证据来源，`decisionTrace` 用来解释为什么选中或拒绝某个程序动画、兜底模板或 footage。任何新增程序动画、素材检索或 AI 重配逻辑都必须优先复用这几个字段，不要在前端或新脚本里重新猜画面。

核心结构：

```ts
type Segment = {
  id: string;
  index: number;
  text: string;
  narrationText: string;
  subtitleText: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  semanticCard: SemanticCard;
  visualContract: VisualContract;
  visualDecision?: VisualDecision;
  soundDesign?: SoundDesign;
  status: "ok" | "low_confidence" | "needs_review" | "missing_visual";
};

type SemanticCard = {
  summary: string;
  entities: {
    people: string[];
    locations: string[];
    organizations: string[];
    documents: string[];
    objects: string[];
    dates: string[];
    events: string[];
  };
  event: {
    action:
      | "establish" | "quote" | "show_evidence" | "transfer" | "expand"
      | "occupy" | "explode" | "assassinate" | "debate" | "mobilize"
      | "resist" | "retreat" | "found_state" | "extract_resource"
      | "reflect" | "unknown";
    subject?: string;
    object?: string;
    from?: string;
    to?: string;
    location?: string;
  };
  tone: "cold" | "tense" | "documentary" | "tragic" | "analytical" | "ominous" | "climax" | "reflective";
  narrativeRole:
    | "opening_atmosphere" | "background" | "evidence" | "quote" | "character"
    | "concept_explain" | "geo_explain" | "event_action" | "climax"
    | "transition" | "ending_reflection";
  visualNeed: {
    kind:
      | "atmosphere" | "document" | "quote" | "person" | "concept"
      | "map" | "route" | "event" | "explosion" | "battle"
      | "crowd" | "newspaper" | "telegram" | "train" | "industry"
      | "ruins" | "ending" | "fallback";
    mustShow: string[];
    shouldShow: string[];
    mustNotShow: string[];
  };
  searchQueries: {
    entity: string[];
    visual: string[];
    mood: string[];
  };
};

type VisualContract = {
  kind: SemanticCard["visualNeed"]["kind"];
  required: {
    entities?: Partial<SemanticCard["entities"]>;
    props?: string[];
    capabilities?: VisualCapability[];
  };
  mustShow: string[];
  shouldShow: string[];
  mustNotShow: string[];
  allowedProviderTypes: VisualProviderType[];
  grounding: {
    mode: "explicit_text" | "asset_match" | "programmatic_abstraction" | "atmosphere_only";
    evidence: string[];
    hallucinationRisk: "low" | "medium" | "high";
  };
  timing: {
    minSec: number;
    idealSec: number;
    maxSec: number;
    canHoldLonger: boolean;
    canLoop: boolean;
  };
  style: {
    era?: string;
    palette?: "sepia" | "dark" | "mono" | "paper" | "modern";
    motion?: "slow_push" | "handheld" | "flash_cut" | "typewriter" | "map_pan" | "static_hold";
    density?: "low" | "medium" | "high";
  };
};
```

示例 scene：

```json
{
  "id": "scene-005",
  "sceneType": "document_evidence",
  "narrationText": "这“牛”，便是被《朴茨茅斯和约》悄然易手的关东州租借地与南满铁路。",
  "visualIntent": "用文件/条约视觉呈现证据，突出关键措辞：朴茨茅斯和约、关东州、南满铁路",
  "semanticCard": {
    "summary": "《朴茨茅斯和约》悄然易手关东州租借地与南满铁路",
    "entities": {
      "people": [],
      "locations": ["关东州", "南满铁路"],
      "organizations": [],
      "documents": ["朴茨茅斯和约"],
      "objects": ["租借地", "铁路"],
      "dates": []
    },
    "event": {
      "action": "transfer",
      "object": "租借地"
    },
    "visualNeed": {
      "kind": "document",
      "mustShow": ["朴茨茅斯和约"],
      "shouldShow": ["关东州", "南满铁路", "租借地"],
      "mustNotShow": ["战场爆炸", "现代城市", "现代办公室", "炮火"]
    },
    "tone": "documentary",
    "narrativeRole": "evidence",
    "searchQueries": {
      "entity": ["朴茨茅斯和约", "关东州", "南满铁路"],
      "visual": ["document", "朴茨茅斯和约", "关东州", "南满铁路"],
      "mood": ["历史", "严肃", "纪录片"]
    }
  },
  "visualContract": {
    "kind": "document",
    "required": {
      "entities": { "documents": ["朴茨茅斯和约"] },
      "capabilities": ["render_text", "highlight_text", "show_document"]
    },
    "mustShow": ["朴茨茅斯和约"],
    "shouldShow": ["关东州", "南满铁路", "租借地"],
    "mustNotShow": ["战场爆炸", "现代城市", "现代办公室", "炮火"],
    "allowedProviderTypes": ["programmatic", "static", "footage"],
    "grounding": {
      "mode": "explicit_text",
      "evidence": ["朴茨茅斯和约", "关东州", "南满铁路"],
      "hallucinationRisk": "low"
    },
    "timing": { "minSec": 4, "idealSec": 7, "maxSec": 12, "canHoldLonger": true, "canLoop": true },
    "style": { "palette": "paper", "motion": "slow_push", "density": "medium" }
  },
  "visualGrounding": {
    "source": "explicit_text",
    "evidence": ["朴茨茅斯和约", "关东州", "南满铁路"],
    "hallucinationRisk": "low"
  },
  "templateId": "DocumentReveal",
  "providerType": "programmatic",
  "visualProviderId": "DocumentReveal",
  "visualDecision": {
    "providerType": "programmatic",
    "providerId": "DocumentReveal",
    "templateId": "DocumentReveal",
    "score": 84
  },
  "durationSec": 6,
  "soundDesign": {
    "ambient": { "id": "room_tone", "volume": 0.18 },
    "fx": [
      { "id": "paper_rustle", "at": "start", "volume": 0.35 },
      { "id": "pen_underline", "at": "highlight", "volume": 0.32 }
    ],
    "music": { "mood": "documentary", "intensity": 0.35 }
  },
  "decisionTrace": {
    "rejectedProviders": [
      { "id": "PortraitFocus", "providerType": "programmatic", "reason": "缺少必需实体组：people" }
    ],
    "candidateProviders": [
      { "id": "DocumentReveal", "providerType": "programmatic", "score": 84, "reason": ["kind=document", "程序动画优先"] }
    ],
    "finalChoice": {
      "type": "programmatic",
      "id": "DocumentReveal",
      "reason": "画面类型=document；文档实体=朴茨茅斯和约"
    }
  },
  "props": {
    "title": "朴茨茅斯和约",
    "body": "这“牛”，便是被《朴茨茅斯和约》悄然易手的关东州租借地与南满铁路。",
    "highlightText": "朴茨茅斯和约",
    "highlightWords": ["朴茨茅斯和约", "关东州", "南满铁路"],
    "style": "old_paper",
    "highlightMode": "underline"
  }
}
```

`visualIntent` 给人看，`visualIntentData` 是旧的轻量机器字段，仍然保留兼容；新逻辑必须优先读 `semanticCard.visualNeed` 和 `visualContract`。Evidence Mode 的硬规则：

- 画面主体只能来自文案明确实体、已匹配素材、或程序动画/模板能抽象表达的概念。
- 如果人物实体不存在，`PortraitFocus` 会被拒绝，不能生造真实肖像。
- 如果 `mustNotShow` 命中素材描述、标签或 semantic 字段，素材会被硬过滤。
- `FootageScene` 不由程序动画 provider 直接选择，只能由 footage 资产有 `asset.path` 且通过 resolver 打分后启用。
- 前端只能展示和微调这些结构，不要在 UI 层用关键词重新推断模板。

### 24.3 Visual Resolver 策略

`scene-planner.mjs` 不再直接用 `chooseTemplate()` 决定画面，主链路改为调用 `pipeline/visual-resolver.mjs`。Resolver 的输入是 `SegmentSemanticCard + VisualContract`，输出是统一的 `VisualProvider` 决策：

```text
Segment 语义
  -> Visual Contract
  -> Visual Resolver
  -> Programmatic Asset / Footage / Static / Fallback
```

Resolver 优先级：

```text
1. Programmatic Exact Match
2. Programmatic Abstract Match
3. Footage Exact Match
4. Template Fallback
5. Needs Review
```

具体规则：

- 从 `visual-provider-manifest.json` 读取全部 provider。
- `programmatic` 是 Remotion 程序动画资产，默认比 footage 更优先，因为它能稳定表达抽象关系、地图、文件、隐喻和人物卡。
- `fallback` 只做低置信兜底，当前主要是 `NarratedScene`。
- `static` 作为档案图、地图图、图片素材入口保留在合约里。
- `footage` 必须有素材路径，并且必须通过 `mustNotShow / avoidFor / copyright` 硬过滤。
- 如果 `visualContract.kind` 是 `document / quote / person / concept / map / route / newspaper / telegram / train / ending / explosion`，分数足够的 programmatic provider 直接胜出。
- 如果 `kind` 是 `battle / crowd / ruins / industry / atmosphere`，footage 强命中可以胜出；否则仍可回到 programmatic 抽象表达。
- 每个 scene 都写入 `visualDecision`、`providerType`、`visualProviderId`、`visualCandidates`、`decisionTrace` 和 `soundDesign`，前端显示“为什么这么配”。

当前 `sceneType` 到 `visualContract.kind` 的主映射：

```text
深秋/海风/硝烟/焦土/铁锈/迷雾 -> atmosphere -> ColdOpenAtmosphere
条约/和约/协定/策论/报告/条例/转让/租借地 -> document -> DocumentReveal
引用/原文/圈点/写道/宣言/公告 -> quote -> DocumentReveal / QuoteReveal
人物/官员/将领/课长/太郎/参谋 -> person -> PortraitFocus
利权/铁路附属地/势力范围/控制结构/隐喻 -> concept -> ConceptDiagram / MetaphorVisual
港/关东州/旅顺/大连/黄海/东京/霞关 -> map -> MapRouteFlyover
铁路/铁轨/沿线/路线/南满铁路 -> route -> MapRouteFlyover
报纸/号外/舆论/媒体 -> newspaper -> NewspaperReveal
电文/电报/通电 -> telegram -> DocumentReveal
爆炸/炸药/闷响/柳条湖 -> explosion -> ExplosionFlash
火车/列车/铁轨转场 -> train -> TrainTrackEnding
历史的车轮/无人能够预料/答案/驶向 -> ending -> TrainTrackEnding
战争/战役/作战/占领 -> battle -> 强命中 footage 或 programmatic 抽象表达
其他文本 -> fallback -> NarratedScene
```

### 24.4 音频驱动时间轴

图文错位的根因是只用文本长度估算镜头时长。当前一站式链路改成：

```text
TTS -> SRT/captions -> planScenesFromCaptions -> scenes[fromFrame,durationInFrames,audioStartMs,audioEndMs]
```

`pipeline/text-to-scenes-tts-video.mjs` 在生成 SRT 成功后会调用 `planScenesFromCaptions()`。caption 仍是父时间轴，但 planner 会继续做 semantic micro-segment：如果 caption 里超过 22 个有效汉字，或同时出现多个实体、地点、文件名、人物名、隐喻、转折词，就尝试切成更小片段。每个 micro-segment 都有 `parentCaptionId`、`parentCaptionIndex` 和 `estimatedTiming`，时间按文本 token 比例分配在父 caption 内。这样仍满足“一段话、一段音频、一个画面”，但不会把一句里三件事塞进一个画面。

scene 的时间来自 caption 或父 caption 内的 micro-segment 分配，scene 的语义文本优先来自原始文案：当原始句子数和 caption 数不一致时，用 caption 文本在原文中找锚点切片，避免 ASR 错字污染画面匹配。禁止再用旁白文本长度把多个 captions 分组到旧 scenes；那会造成画面和声音错位。只有在跳过字幕或字幕接口失败时，才使用文本拆句估算并按音频总时长拉伸。

项目持久层也必须执行同一条规则，不能只在生成脚本里校验。`pipeline/project-store.mjs#repairProjectTimeline()` 是统一闸门：

- captions 的显示文本以原始文案为准；如果旧项目里保存了 ASR 错字字幕，会保留时间戳并把文本重写为原文切片。
- Remotion props 里的显示字幕由 segment/micro-segment 派生，而不是直接显示父 caption 大段文本；父 caption 只负责音频时间校验。
- 有 captions 时，segments 必须带 `parentCaptionIndex` 或 `captionIndex`，并且每个父 caption 的 `startMs/endMs` 必须被一个或多个 segment 完整覆盖。
- `projectToMultiSceneProps()`、`/api/projects/:id/studio-default-props`、项目导出都会先执行这个闸门；校验失败且无法按原文重建时，不允许继续写 Remotion props。
- 禁止把旧 captions、旧 audio、新 scenes 静默混在一个 `MultiSceneVideo` 里。修一个 UI 参数不能改坏音频/字幕/画面时间线。

素材匹配也必须发生在这个 caption-derived scene 之后：`asset-matcher.mjs` 的 query 只能包含当前 scene 的 `narrationText/text/visualIntent/keywords/semanticCard`，不能用整段文案或相邻片段的文本参与当前片段匹配。

独立多镜头命令也支持同样的对齐：

```console
npm run text-to-scenes-video -- --text-file input.txt --audio-src generated/tts-xxxx.mp3 --captions-file public/generated/tts-xxxx.srt --output out/aligned.mp4
```

### 24.5 Footage 素材候选

Footage 素材候选解决“讲到战争、港口、铁路、真实地点时是否有本地素材可用”的问题。当前主调度器仍是 `visual-resolver.mjs`，默认优先程序动画资产；本地 footage 只有在强命中、氛围增强或真实素材引用时参与竞争，不会取代 `VisualProvider` 握手。

目录约定：

```text
public/footage/
  war-smoke-001.mp4
  treaty-paper-001.mp4
  railway-map-001.mp4
public/generated/asset-index.json
```

第一步扫描素材：

```console
npm run index-assets
```

这会生成 `public/generated/asset-index.json` 草稿。你需要补充或修正每条素材的 `description`、`tags`、`bestFor`、`avoidFor`、`mood`：

```json
{
  "id": "treaty-paper-001",
  "type": "footage",
  "path": "footage/treaty-paper-001.mp4",
  "title": "旧纸文件与印章",
  "description": "泛黄纸张、条约、文件、印章、历史档案、合约签署",
  "tags": ["条约", "文件", "印章", "档案", "和约", "转让"],
  "bestFor": ["document_evidence", "quote_evidence"],
  "avoidFor": ["战争地图", "人物卡片"],
  "mood": ["historical", "serious"],
  "durationSec": 6,
  "license": "local",
  "source": "local-library"
}
```

当前 `index-assets` 已升级为 v2 索引格式。它仍然是轻量本地索引器，不会在 Node 脚本里强行安装 PySceneDetect、BLIP、RAM、OpenCLIP、Qdrant 或 FiftyOne；这些组件应该作为素材理解层接入，输出统一写回 `asset-index.json` 和向量库。v2 索引会为每个素材保留以下落点：

```json
{
  "schemaVersion": 2,
  "assets": [
    {
      "id": "railway-map-001",
      "providerType": "footage",
      "kind": "map",
      "shots": [
        {
          "id": "railway-map-001:shot-001",
          "startMs": 0,
          "endMs": 6200,
          "keyframes": [],
          "captions": [],
          "embeddingRef": ""
        }
      ],
      "semantic": {
        "visualKinds": ["map", "route"],
        "entities": [],
        "visualObjects": ["地图", "铁路", "路线"],
        "actions": ["expand"],
        "ocrText": "",
        "asrText": ""
      },
      "qualityGate": {
        "reject": false,
        "reason": "",
        "metrics": {
          "textAreaRatio": 0,
          "objectRichness": 36,
          "motionScore": 35,
          "sceneDiversity": 24,
          "historicalRelevance": 45,
          "visualValueScore": 34
        }
      },
      "retrieval": {
        "vectorStore": "",
        "collection": "",
        "pointId": "",
        "embeddingModel": ""
      },
      "review": {
        "fiftyOneSampleId": "",
        "status": "unreviewed",
        "notes": ""
      }
    }
  ]
}
```

推荐的素材理解/检索层是：

```text
PySceneDetect
  -> 把素材拆成 shots，写 startMs/endMs/keyframes
BLIP / RAM / OCR / ASR
  -> 给 shot 写 captions、tags、visualObjects、ocrText、asrText、quality metrics
OpenCLIP / clip-retrieval
  -> 给关键帧/shot 写 embeddingRef，并把向量写入 Qdrant 或 Milvus
FiftyOne
  -> 审核素材、删错、改标签、同步 review.status 和人工修正字段
visual-resolver.mjs
  -> 继续做最终选择：语义召回、硬过滤、质量门控、程序动画兜底
```

不要复刻通用“自动剪片源码”。本项目需要的是“历史旁白 -> 分镜 -> 画面合约 -> 镜头级素材语义检索 -> 人工审核闭环”。成熟开源组件用于素材理解和检索层，Remotion、`scene-planner.mjs`、`visual-resolver.mjs` 保留为生成和调度主链路。

白布写字、纯字幕卡、白底大字这类素材不能进入真实 footage 池。`pipeline/asset-quality.mjs` 统一计算 `qualityGate`：

```text
visualValueScore =
  objectRichness
  + motionScore
  + sceneDiversity
  + historicalRelevance
  - textOnlyPenalty
  - blankBackgroundPenalty
```

如果 `textAreaRatio > 35%` 且 `objectRichness`、`motionScore` 都很低，素材会被标记为 `text_only_card` 并被 `visual-resolver.mjs` 和 `asset-matcher.mjs` 硬过滤。它可以作为程序动画/字幕卡模板的参考，但不能被当作真实 footage。

给已有 scenes 匹配素材：

```console
npm run match-assets -- --scenes=public/generated/scenes-demo.json --output=public/generated/scenes-with-assets.json
```

这条命令是旧兼容/手动补素材流程。一站式链路会把 `asset-index.json` 作为 footage 候选交给 `visual-resolver.mjs`；没有素材索引时不会中断，会继续使用 programmatic provider 或 `NarratedScene` 兜底。

resolver 选择 footage 后会写入 `providerType: "footage"` 和 `visualLayer`：

```json
{
  "providerType": "footage",
  "visualProviderId": "war-smoke-001",
  "templateId": "FootageScene",
  "visualLayer": {
    "type": "footage",
    "providerType": "footage",
    "clipId": "war-smoke-001",
    "path": "footage/war-smoke-001.mp4",
    "confidence": 37,
    "reason": "素材命中：战争、硝烟；score=37"
  }
}
```

`sceneRegistry.tsx` 看到 `templateId === "FootageScene"` 或 `visualLayer.type === "footage"` 时会直接渲染 `FootageScene`。如果 footage 只是候选但没有胜出，它只保留在 `visualCandidates` / `decisionTrace.candidateAssets` 中，不写混合 visualLayer 类型。

目前素材匹配使用三阶段本地召回：

```text
第一阶段：硬过滤
  -> visualNeed.mustNotShow / asset.avoidFor / copyright restricted / kind 冲突
第二阶段：语义召回
  -> entities / visualNeed.mustShow / searchQueries / tags / description / bestFor
第三阶段：握手评分
  -> 实体命中 > 必须展示命中 > 视觉对象命中 > mood/tag 命中
  -> visualLayer + visualCandidates + decisionTrace.candidateAssets
```

`asset-matcher.mjs` 已保留 `optionalEmbeddingRerank()` 接口，适合旧 scenes JSON 的离线补素材。主链路如果后续要接 embedding rerank，应优先接到 `visual-resolver.mjs` 的 footage candidate 排序阶段，而不是绕过 resolver。

只生成镜头规划，不渲染：

```console
npm run plan-scenes -- --text-file input.txt --output public/generated/scenes-demo.json
```

生成多镜头视频：

```console
npm run text-to-scenes-video -- --text-file input.txt --title "南满铁路的开端" --output out/auto-scenes-video.mp4
```

一站式生成多镜头视频和旁白：

```console
npm run text-to-scenes-tts-video -- --text-file input.txt --title "南满铁路的开端" --output out/auto-scenes-tts-video.mp4
```

入口：双击 `FuckVideo.exe`，或 `npm run dev:video` 后打开 `http://localhost:3000`，点右下角 FV 按钮。

工作台里切到 `生成视频` 页签。默认模式是 `自动分镜`，流程是文本 -> 语音 -> 片段 -> 成片；如果只想套一个固定模板，切到 `单模板`。生成完成后自动载入到 Studio，在「项目 / 分镜」页签继续改分镜画面。

如果已有旁白音频和字幕，可以把它们传给多镜头视频：

```console
npm run text-to-scenes-video -- --text-file input.txt --audio-src generated/tts-xxxx.mp3 --captions-file public/generated/tts-xxxx.srt --output out/auto-scenes-video.mp4
```

`audio-src` 必须是 `public/` 下的相对路径，例如 `generated/tts-xxxx.mp3`。字幕文件可以传本地路径。

`MultiSceneVideo` 的 props 结构：

```json
{
  "title": "自动片段视频",
  "audioSrc": "generated/tts-xxxx.mp3",
  "showCaptions": true,
  "showSceneLabels": false,
  "scenes": [
    {
      "id": "scene-001",
      "index": 0,
      "text": "《朴茨茅斯和约》悄然易手。",
      "sceneType": "document_evidence",
      "narrationText": "《朴茨茅斯和约》悄然易手。",
      "visualIntent": "用文件/条约视觉呈现证据，突出关键措辞：朴茨茅斯和约、转让",
      "visualIntentData": {
        "type": "document_evidence",
        "action": "show_evidence",
        "evidenceType": "document",
        "highlightWords": ["朴茨茅斯和约", "转让"]
      },
      "templateId": "DocumentReveal",
      "durationSec": 6,
      "fromFrame": 0,
      "durationInFrames": 180,
      "audioStartMs": 0,
      "audioEndMs": 6000,
      "timingSource": "captions",
      "keywords": ["朴茨茅斯和约", "转让"],
      "decisionReason": "历史文件揭示: 一张旧纸文件展开，展示标题、正文、高亮词和印章",
      "providerType": "programmatic",
      "visualProviderId": "DocumentReveal",
      "visualLayer": {
        "type": "template",
        "providerType": "programmatic",
        "templateId": "DocumentReveal",
        "confidence": 84,
        "reason": ["kind=document", "provider=DocumentReveal", "程序动画优先"]
      },
      "visualCandidates": [
        {
          "source": "programmatic",
          "providerType": "programmatic",
          "id": "DocumentReveal",
          "templateId": "DocumentReveal",
          "score": 84,
          "reason": ["kind=document", "provider=DocumentReveal", "程序动画优先"]
        },
        {
          "source": "footage",
          "providerType": "footage",
          "id": "treaty-paper-001",
          "materialId": "treaty-paper-001",
          "score": 52,
          "reason": "素材命中：条约、文件；score=52"
        }
      ],
      "props": {
        "title": "朴茨茅斯和约",
        "subtitle": "历史文件",
        "body": "条约上用词谨慎，所谓“转让”遮住了更复杂的权力关系。",
        "sealText": "ARCHIVE",
        "highlightWords": ["转让"],
        "tone": "aged"
      }
    }
  ]
}
```
