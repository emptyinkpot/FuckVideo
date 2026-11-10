# Remotion 视频工作台与文本生成视频系统

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

语言边界：本仓库主体采用 TypeScript / Node，因为 Remotion、React composition、Studio 插件、项目时间轴和渲染编排都在这个生态内；素材理解、embedding、ASR、OCR、Qwen-VL/CLIP/SigLIP 等模型重活采用 Python sidecar，因为成熟模型库、GPU/批处理和向量入库生态主要在 Python。完整规则见 `docs/architecture/language-boundary.md`。

## 仓库来源与上游标识

- 本仓库的 GitHub owning repo 是 `emptyinkpot/FuckVideo`。
- 本仓库不是 GitHub fork：GitHub API 当前显示 `isFork=false`、`parent=null`、`templateRepository=null`。
- 本仓库不是从某一个 GitHub 仓库直接复刻而来；初始提交是本地创建的 Remotion 视频工作台工程，首个提交为 `05bb1e1 Initial Remotion video workspace`。
- 本仓库的核心框架上游是 `remotion-dev/remotion`，GitHub 地址为 `https://github.com/remotion-dev/remotion`。
- 本仓库的设计、模板、素材和数据参考来源列在下方“研究与素材来源说明”；这些是研究/素材/实现参考来源，不等同于 GitHub fork parent。
- 本仓库早期的本地目录名和 npm 包名是 `remotion-project`，2026-11-10 统一改为 FuckVideo；其他仓库或文档里提到的 `remotion-project` 指的就是本仓库根目录。

## platform/：产品化子系统（原 huasheng-clone）

`platform/` 原本是独立仓库 `emptyinkpot/huasheng-clone`，2026-11-10 连同全部 10 个提交合并进本仓库。它把根目录这条“文案 → 配音 → 分镜 → 素材匹配 → Remotion 渲染”的流程做成在线产品形态，仿照 B 站「花生」的使用流程：

- `platform/apps/web`：Next.js 14 前端（:3000）
- `platform/apps/api`：Hono 后端（:3001）
- `platform/apps/worker`：Remotion 服务端渲染 worker（:3002）
- `platform/packages/*`：schemas、tts-dashscope、llm、material-search、db、compositions

与根目录的关系和边界：

- 根目录是 npm 工程（React 19、Remotion 4.0.456），`platform/` 是独立的 pnpm workspace（Next 14 所以 React 18、Remotion 4.0.481），两边各自安装依赖，互不引用。根 `tsconfig.json` 已排除 `platform/`。
- `platform/packages/compositions` 和 `platform/packages/tts-dashscope` 是从根目录 `src/templates/` 和 `scripts/*tts*.mjs`、`subtitle-aligner.mjs` 改写来的 TypeScript 版本，已经和原版分开演化（props 合同改成 zod schema，模板裁剪重写）。合成一份需要先定下统一的 props 合同，并把 web 升到 Next 15 / React 19，属于后续重构。
- 运行方式见 `platform/README.md`，路线图 `platform/docs/ROADMAP.md` 只保存在本机（gitignore）。`platform/.runtime/` 里放着本地便携 Node 22（被 gitignore），pnpm 命令用它跑。

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

- `scripts/asset-indexer.mjs` 生成 `public/generated/asset-index.json`
- `scripts/material-seed.mjs` 从 `asset-index.json` 生成 `public/generated/material-seed.jsonl`
- `scripts/asset-matcher.mjs` 提供词法匹配和 `optionalEmbeddingRerank()`
- `scripts/visual-resolver.mjs` 负责把语义镜头映射到 Remotion 模板或素材
- `scripts/project-store.mjs` 负责把生成结果保存成可编辑 timeline project

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
Remotion Studio 模板预览与参数编辑
  + 右侧“生成视频”控制台
  + 左侧“片段”扩展页签
  + 千问 TTS 旁白生成
  + 自动片段规划
  + 现有 Remotion 模板复用
  + 自动音频格式标准化
  + 音频驱动镜头时间轴
  + 可选字幕文件
  + 本地素材库检索与素材镜头混合
  + 生成可编辑 video project
  + Studio 内嵌片段微调与总导出
  + 一键渲染 MP4
```

它不是一个单独的控制台页面，也不是把控制面板塞进视频画面里。当前做法是：保留 Remotion Studio 原有工作流，右侧用浮层控制台负责“生成视频”，左侧在 `合成列表 / 素材` 旁边注入 `片段` 页签负责“一段话绑定一个画面”的微调；中央画布仍然使用 Remotion Studio 原生预览屏幕。生成成功后，插件会把项目转换成 `MultiSceneVideo` props，写入 Remotion 的 input props override，并切到 `MultiSceneVideo` composition 预览。

**唯一真源规则：Remotion Studio 工作台是唯一产品入口和唯一预览真源。** 入口固定为 `npm run dev:video` -> `http://127.0.0.1:3057`。不得为了部署、预览或调试另起独立静态网页、独立 Vercel 项目、`dist` 项目、`vercel-static-preview` 项目，或把 `frontend/*.html` 当成新的产品入口发布。`/video-generator`、`/video-project/:id` 只允许作为 Remotion 工作台服务内的备用调试页面存在，不能成为并行控制面。

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

第三层是 Studio 内嵌前端扩展：

- `npm run dev:video` 会启动 Remotion Studio、生成视频 API、Studio 代理。
- 访问 `http://127.0.0.1:3057`。
- 代理会把 `frontend/remotion-studio-plugin.js` 注入 Studio 页面。
- Remotion 原生 `渲染` 按钮旁边会出现 `生成视频` 按钮，点击后打开右侧生成控制台；控制台打开时按钮自动隐藏。
- Remotion Studio 左侧栏 `合成列表 / 素材` 旁边会出现 `片段` 页签。
- 插件默认模式是“一站式生成视频”：文本 -> 千问 TTS -> 自动片段规划 -> `MultiSceneVideo` -> MP4。
- 插件也保留“单模板”模式：文本 -> 千问 TTS -> 选定 Remotion 模板 -> MP4。
- 插件提交任务到 `http://127.0.0.1:3037/api/jobs`。
- 生成完成后会保存 `.runtime/video-projects/<id>.json`。
- 生成完成后自动把项目加载到 Remotion Studio 中央预览，并打开左侧 `片段` 页签。

第四层是项目编辑能力：

- 片段编辑内嵌在 Remotion Studio 左侧栏，不另起一个主控制台。
- 生成控制台保持在右侧，和片段编辑分离。
- 中央区域复用 Remotion Studio 原生 composition 预览。
- 支持保存字幕/旁白、修改视觉意图、修改模板、修改时间、锁定片段、重配画面、替换画面、总导出。
- `/video-project/:id` 独立页面仍保留为备用调试入口，但主工作流不再依赖它。

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
cd /d "E:\My Project\remotion-project"
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

### 4.1 只打开原生 Remotion Studio

```console
npm run dev
```

Remotion 默认会启动 Studio，用来预览 composition 和编辑 props。

### 4.2 打开带“生成视频”扩展的 Studio

```console
npm run dev:video
```

启动后打开：

```text
http://127.0.0.1:3057
```

这个命令会启动三个进程：

```text
3000  Remotion Studio 原生服务
3037  文本生成视频任务 API
3057  Studio 插件代理入口
```

对应脚本：

- `scripts/studio-with-video-ui.mjs`
- `scripts/video-ui-server.mjs`
- `scripts/studio-plugin-proxy.mjs`

### 4.3 只启动独立生成页面

```console
npm run video-ui
```

打开：

```text
http://127.0.0.1:3037/video-generator
```

这个页面是早期的独立生成页，仍然可用。但推荐主入口是：

```text
http://127.0.0.1:3057
```

因为它自然嵌入 Remotion Studio，不会把控制台放进视频画面。

## 5. 目录结构

关键目录如下：

```text
remotion-project/
  frontend/
    remotion-studio-plugin.js       Studio 内注入的“生成视频”扩展
    video-generator.html            独立文本生成视频页面
    video-project.html              生成后继续微调的项目编辑器

  scripts/
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
    video-ui-server.mjs             本地任务 API 与静态页面服务
    studio-plugin-proxy.mjs         代理 Remotion Studio 并注入插件脚本
    studio-with-video-ui.mjs        一键启动 Studio + API + 插件代理

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
浏览器 Remotion Studio
  |
  | 访问 http://127.0.0.1:3057
  v
Studio 插件代理 scripts/studio-plugin-proxy.mjs
  |
  | 代理 http://127.0.0.1:3000
  | 注入 frontend/remotion-studio-plugin.js
  v
Remotion Studio 页面
  |
  | 点击“生成视频”
  v
本地任务 API scripts/video-ui-server.mjs
  |
  | POST /api/jobs
  v
命令行生成链路 scripts/text-to-video.mjs
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
scripts/text-to-scenes-tts-video.mjs
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
   - `scripts/visual-resolver.mjs` 能识别的新 provider 能力
   - `scripts/scene-planner.mjs` 生成的 `semanticCard / visualContract`
   - `templates` 映射
   - `templateOptions`
   - `frontend/remotion-studio-plugin.js` 的模板下拉
   - `frontend/video-generator.html` 的模板下拉

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
scripts/text-to-video.mjs
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

默认配置在 `scripts/text-to-video.mjs` 顶部的 `defaults` 中。

## 9.1 一站式自动片段生成命令行

主脚本：

```text
scripts/text-to-scenes-tts-video.mjs
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
node scripts/text-to-scenes-tts-video.mjs --caption-bottom=34 --caption-background-color=transparent --caption-font-size=28 --progress-height=34 --progress-padding-x=0
```

默认视频基础设施采用紧凑底部布局：字幕没有黑色底板，默认 `captionBackgroundColor=transparent`；分段进度条贴底且横向全长，默认 `progressLeft=0`、`progressRight=0`、`progressPaddingX=0`；字幕默认放在进度条上方约 4px 的位置。画面字幕只允许单行，渲染层强制 `whiteSpace: nowrap`，并按字幕字数和可用宽度自动压缩字号，不能通过换成两行来撑开。

这些不是一次性生成参数。`MultiSceneVideo`、`GeneratedTemplateVideo`、`NarratedVideo` 都把这些字段作为 composition schema/defaultProps 暴露，生成后可以直接在 Remotion 参数面板实时调整。字幕正文 `captions` 是生成数据，不在参数面板里逐句展开；参数面板只调字幕整体抽象样式和整体布局。项目侧仍可继续在 Studio 插件或项目编辑页修改并保存：

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
  -> scripts/scene-planner.mjs 的 planScenesFromCaptions()
  -> 每条 caption 生成一个或多个 semantic micro-segment，并写入 fromFrame / durationInFrames / audioStartMs / audioEndMs
  -> MultiSceneVideo 按音频真实时间切镜头
```

也就是说，一站式生成时如果没有跳过字幕，`scenes.length` 必须大于或等于 `captions.length`。每个父 caption 至少要有一个 scene 覆盖；如果被切成多个 micro-segment，第一段的 `audioStartMs` 等于父 caption 的 `startMs`，最后一段的 `audioEndMs` 等于父 caption 的 `endMs`，中间时间按文本 token 比例估算，并写入 `estimatedTiming: true`。当前实现依赖 `/srt` 返回的句段时间戳；后续如果接本地 Whisper/faster-whisper，只需要让它输出同样的 captions/SRT 结构即可。

生成脚本里有硬校验：有 captions 时如果 `scenes.length < captions.length`，任一 caption 没有对应 scene，父 caption 时间没有被 scene 覆盖，或任一 scene 缺少文本，任务必须失败，不能继续输出错位项目。

## 13. Web 任务 API

本地任务服务：

```text
scripts/video-ui-server.mjs
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

## 14. Studio 插件注入机制

Remotion 官方 Studio 当前没有稳定的插件 API，所以本项目使用代理注入。

流程：

```text
浏览器访问 3057
  -> studio-plugin-proxy 请求 3000 的 Remotion Studio HTML
  -> 在 </body> 前插入：
     <script src="http://127.0.0.1:3037/studio-plugin.js"></script>
  -> 返回给浏览器
```

注入脚本：

```text
frontend/remotion-studio-plugin.js
```

插件做了五件事：

- 在 Remotion 原生 `渲染` 按钮旁边加 `生成视频` 按钮，打开右侧生成控制台；控制台打开时隐藏启动按钮。
- 在 Remotion Studio 左侧栏 `合成列表 / 素材` 旁边加 `片段` 页签。
- 右侧生成控制台负责文案输入、模式选择、TTS 指令、任务提交、进度日志和刷新预览；总导出只保留顶部工作栏一个主入口。
- 左侧片段页签只负责片段列表、当前片段编辑、锁定、画面重配和画面替换。
- 生成成功后调用 `GET /api/projects/:id/props`，把项目写入 Remotion input props override，并切到 `/MultiSceneVideo`，复用中央预览屏幕。
- 用 MutationObserver 把常见 Remotion Studio 英文 UI 替换成中文。

中文化是运行时替换，不改 `node_modules`。这样升级 Remotion 时更安全。

## 15. 前端交互与像素规格

Studio 内嵌扩展前端集中在：

```text
frontend/remotion-studio-plugin.js
```

它是一个运行时注入脚本，不修改 Remotion Studio 源码和 `node_modules`。注意：这不是项目里唯一的前端；它只负责把“生成视频”和“片段编辑”嵌入 Remotion Studio。完整前端还包括 Remotion Studio 原生界面、两个备用独立 HTML 页面，以及 `src/Root.tsx` 注册的 32 个 Composition 画布 UI。

复刻 Studio 内嵌工作流时应保持三个工作区分离：

```text
左侧 Remotion explorer sidebar
  -> 原生 合成列表 / 素材
  -> 注入 片段 tab

中央 Remotion preview canvas
  -> 原生 MultiSceneVideo / 当前 composition 预览

右侧 floating generator console
  -> 生成视频控制台
  -> 进度日志
  -> 刷新预览 / 打开当前成片
```

### 15.1 右侧生成视频控制台

右侧控制台由两个 DOM 节点组成：

```text
button.ttv-generator-launcher
aside.ttv-generator-panel
```

定位和尺寸必须保持：

```css
.ttv-generator-launcher {
  z-index: 2147483000;
  height: 34px;
  padding: 0 12px;
  border-radius: 9px;
}

.ttv-generator-launcher.docked {
  position: static;
  height: 34px;
  margin-left: 8px;
  box-shadow: none;
}

.ttv-generator-launcher.floating {
  position: fixed;
  top: 42px;
  right: 18px;
}

.ttv-generator-panel {
  position: fixed;
  top: 58px;
  right: 18px;
  bottom: 18px;
  width: clamp(340px, 28vw, 390px);
  z-index: 2147483001;
  display: none;
  grid-template-rows: auto 1fr auto;
  border-radius: 14px;
}

.ttv-generator-panel.open {
  display: grid;
}
```

右侧控制台字段：

- 文案
- 生成模式
- 标题
- 副标题
- 视频模板
- 语音指令
- 视觉参数
- 字幕选项
- 生成进度
- 轮询日志
- 生成初版项目
- 刷新 Studio 预览
- 打开当前成片

字段高度和排版：

```css
.ttv-generator-head {
  height: 48px;
  padding: 0 12px 0 14px;
}

.ttv-body {
  padding: 12px;
  gap: 10px;
}

.ttv-grid {
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ttv-input,
.ttv-select {
  height: 32px;
  border-radius: 8px;
  padding: 0 10px;
}

.ttv-textarea {
  min-height: 112px;
  padding: 8px 10px;
  line-height: 1.55;
}

.ttv-button {
  height: 32px;
  border-radius: 8px;
}

.ttv-log {
  overflow: visible;
  padding: 8px;
  border-radius: 8px;
}
```

交互状态：

```js
localStorage["ttv.generatorPanel"] = "open" | "closed";
localStorage["ttv.lastProgress"] = JSON.stringify({ status, log, at });
```

规则：

- `生成视频` 按钮只负责打开右侧控制台。
- `生成视频` 按钮必须优先由 `ensureGeneratorLauncherDocked()` 插入 Remotion 原生 `渲染 / Render` 按钮后面；只有找不到原生渲染按钮时才使用 `.ttv-generator-launcher.floating` 降级到右上角。
- 右侧控制台默认打开，用户关闭后写入 `ttv.generatorPanel=closed`。
- 生成进度和日志必须常驻右侧控制台，不放进左侧片段面板。
- 每次轮询 `GET /api/jobs/:id` 后都要更新 `ttv.lastProgress`，页面跳转到 `/MultiSceneVideo` 后仍能恢复上一轮状态。

### 15.2 左侧片段页签

左侧片段页签由两个 DOM 节点组成：

```text
button.ttv-side-tab
section.ttv-storyboard-panel
```

它必须插入 Remotion Studio 左侧 explorer tabs，也就是 `Compositions / Assets` 或中文化后的 `合成列表 / 素材` 那一行。查找逻辑是：

```js
function findExplorerTabs() {
  for (const el of document.querySelectorAll("div")) {
    const buttons = Array.from(el.children).filter((child) => child.getAttribute("role") === "button");
    const labels = buttons.map((button) => normalize(button.textContent));
    const hasCompositions = labels.some((label) => label.includes("compositions") || label.includes("合成列表"));
    const hasAssets = labels.some((label) => label.includes("assets") || label.includes("素材"));
    if (hasCompositions && hasAssets) return el;
  }
}
```

左侧片段页签尺寸：

```css
.ttv-side-tab {
  flex: 1;
  height: 40px;
  padding: 4px 12px;
  border-top: 2px solid transparent;
}

.ttv-side-tab.active {
  border-top-color: #0f62fe;
}

.ttv-storyboard-panel {
  display: none;
  height: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  grid-template-rows: auto 1fr auto;
}

.ttv-storyboard-panel.open {
  display: grid;
}

.ttv-storyboard-panel .ttv-textarea {
  min-height: 76px;
}

.ttv-understanding {
  display: grid;
  gap: 6px;
  border: 1px solid rgba(79,140,255,.22);
  border-radius: 8px;
  padding: 8px;
  background: #171d2a;
  font-size: 11px;
}

.ttv-understanding-grid {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 4px 8px;
}
```

左侧片段页签只包含：

- 当前项目提示
- 片段列表
- 当前片段旁白 / 字幕
- 当前片段视觉意图
- 当前片段理解：主体、动作、地点、文件、必须展示、禁止展示
- 当前画面解释：provider 类型、provider ID、置信度、命中原因
- 当前片段画面 / 模板
- 当前片段类型
- 开始 / 结束毫秒
- 保存片段
- 锁定 / 解除锁定
- 重配画面
- 替换为候选画面

左侧片段页签不能包含：

- 文案大输入框
- 生成模式选择
- TTS 指令
- 生成按钮
- 生成进度日志

交互状态：

```js
localStorage["ttv.storyboardPanel"] = "storyboard" | "native";
localStorage["ttv.lastProjectId"] = projectId;
```

规则：

- 点击 `片段` 时隐藏左侧原生 explorer 内容，只显示 `ttv-storyboard-panel`。
- 点击 `合成列表` 或 `素材` 时恢复 Remotion 原生左侧内容。
- 右侧 Remotion 原生参数栏不应该被 `片段` 占用。
- 旧版本如果写过 `localStorage["remotion.sidebarPanel"]="storyboard"`，启动时必须改回 `input-props`，避免污染右侧原生栏。

### 15.3 中央预览复用

中央区域不自建播放器。预览只通过 Remotion Studio 原生 composition canvas 完成。

生成成功或点击 `刷新 Studio 预览` 后：

```text
GET /api/projects/:id/props
  -> localStorage["remotion_inputPropsOverride" + window.location.origin] = JSON.stringify(props)
  -> location.href = "/MultiSceneVideo" 或 location.reload()
```

这会让 Remotion 的 `getInputProps()` 返回项目 props，从而让 `MultiSceneVideo` 在中央画布展示最新项目。

切换左侧片段时，如果当前页面已经有 `window.remotion_setFrame`，可以把预览跳到该镜头开始帧：

```js
const frame = Math.round((scene.startMs / 1000) * 30);
window.remotion_setFrame(frame, "MultiSceneVideo", 0);
```

### 15.4 前端 API 链接

页面入口：

```text
http://127.0.0.1:3057                         带插件注入的 Remotion Studio
http://127.0.0.1:3057/MultiSceneVideo         自动片段主预览 composition
http://127.0.0.1:3037/video-generator         备用独立生成页面
http://127.0.0.1:3037/video-project/:id       备用独立项目编辑页
http://127.0.0.1:3037/studio-plugin.js        Studio 注入脚本
```

右侧生成控制台：

```http
POST http://127.0.0.1:3037/api/jobs
GET  http://127.0.0.1:3037/api/jobs/:id
```

顶部项目工作栏：

```http
GET  http://127.0.0.1:3037/api/projects
POST http://127.0.0.1:3037/api/projects
```

左侧片段编辑：

```http
GET   http://127.0.0.1:3037/api/projects/:id
PATCH http://127.0.0.1:3037/api/projects/:id/segments/:segmentId
POST  http://127.0.0.1:3037/api/projects/:id/segments/:segmentId/lock
POST  http://127.0.0.1:3037/api/projects/:id/segments/:segmentId/rematch-visual
POST  http://127.0.0.1:3037/api/projects/:id/segments/:segmentId/replace-visual
```

中央预览和总导出：

```http
GET  http://127.0.0.1:3037/api/projects/:id/props
POST http://127.0.0.1:3037/api/projects/:id/export
GET  http://127.0.0.1:3037/project-files/:id
GET  http://127.0.0.1:3037/files/:id
```

### 15.5 任务流程

默认点击“一站式生成视频”后：

1. 插件 `POST /api/jobs`。
2. 本地任务 API 启动 `scripts/text-to-scenes-tts-video.mjs`。
3. 脚本生成 TTS、自动片段 scenes、`MultiSceneVideo` props 和 MP4。
4. 前端每 2 秒轮询 `GET /api/jobs/:id`。
5. 成功后保存 `.runtime/video-projects/<id>.json`。
6. 插件拉取 `GET /api/projects/:id/props`。
7. 插件把 props 写入 `remotion_inputPropsOverride<studio-origin>`，并切换到 `/MultiSceneVideo`。
8. 中央预览屏幕显示自动片段视频。
9. 左侧自动打开 `片段` 页签继续编辑项目。
10. 右侧继续保留生成进度日志和打开成片入口。

如果把“生成模式”改成“单模板”，则任务 API 会启动旧链路 `scripts/text-to-video.mjs`。

### 15.6 前端扩展原则

后续扩展必须优先复用已有模块：

- 新生成入口复用右侧 `ttv-generator-panel`，不要再新建第二套控制台。
- 新片段操作复用左侧 `ttv-storyboard-panel`，不要把片段编辑塞回右侧。
- 新预览能力复用 Remotion Studio 中央画布和 `MultiSceneVideo`，不要自建 `<video>` 预览替代主预览。
- 新项目数据能力复用 `.runtime/video-projects/<id>.json` 和 `project-store.mjs`，不要另建平行 project store。
- 新视觉资源能力复用 `visual-provider-manifest.json`、`visual-resolver.mjs`、`visualLayer`、`visualCandidates` 和 `decisionTrace`，不要把 provider 选择逻辑散落在前端本地状态。
- 新 footage 素材能力复用 `asset-indexer.mjs`、`asset-matcher.mjs` 和 `asset-index.json`，不要把素材路径散落在前端本地状态。
- 新导出能力复用 `export-video-project.mjs` 和 `projectToMultiSceneProps()`，不要在前端拼 Remotion render 参数。
- 新程序动画能力复用 `visual-provider-manifest.json`、`scene-planner.mjs`、`visual-resolver.mjs` 和 `sceneRegistry.tsx`，不要让前端硬编码模板语义。
- 新状态持久化优先使用现有 localStorage key 命名空间 `ttv.*`，不要写入 Remotion 自有 key，除非明确是 `remotion_inputPropsOverride<origin>`。

前端边界：

- 右侧负责“生成和任务状态”。
- 左侧负责“项目和片段编辑”。
- 中央负责“Remotion 原生预览”。
- 右侧 Remotion 原生参数栏属于 Remotion，不放本项目 UI。

### 15.7 全量前端清单

当前工程能看到的前端一共有 5 类。README 后续新增前端时必须先归入这 5 类之一，除非确实出现新的独立产品面。

```text
1. Remotion Studio 原生前端
2. Remotion Studio 注入插件前端
3. 备用独立生成页 frontend/video-generator.html
4. 备用独立项目编辑页 frontend/video-project.html
5. Remotion Composition / Template 画布前端
```

#### 15.7.1 Remotion Studio 原生前端

入口：

```text
http://127.0.0.1:3000        原生 Remotion Studio
http://127.0.0.1:3057        代理后的 Remotion Studio，带插件注入
```

Remotion Studio 自带的前端不要重写，它是主预览和参数编辑外壳：

- 左侧 explorer：显示 `合成列表 / 素材`。
- 中央 preview canvas：显示当前 Composition 的真实 Remotion 画面。
- 右侧原生 props 面板：读取 `src/Root.tsx` 中每个 `<Composition>` 的 `schema` 和 `defaultProps`，生成可交互参数编辑器。
- 顶部 / 底部 Studio 控件：播放、暂停、帧定位、渲染入口等仍由 Remotion 原生 UI 负责。

本项目只通过 `frontend/studio-plugin-proxy.mjs` 代理 HTML，并注入 `frontend/remotion-studio-plugin.js`。不要改 `node_modules`，不要复制一套 Studio。中文化也是运行时 `MutationObserver` 替换常见英文文案，例如 `Compositions` -> `合成列表`、`Assets` -> `素材`、`Render` -> `渲染`。

参数编辑的真实来源是 `src/Root.tsx`：

```tsx
<Composition
  id="DocumentReveal"
  component={DocumentReveal}
  schema={documentRevealSchema}
  defaultProps={{ ... }}
/>
```

只要某个合成缺少 `schema`，Studio 右侧就不会出现可编辑参数。新增模板时必须在 `Root.tsx` 同时补 `schema`、`defaultProps` 和 `<Composition>` 注册。

#### 15.7.2 Remotion Studio 注入插件前端

文件：

```text
frontend/remotion-studio-plugin.js
```

它只加两块 UI：

- 右侧固定浮层：`button.ttv-generator-launcher` + `aside.ttv-generator-panel`。
- 左侧 explorer 页签：`button.ttv-side-tab` + `section.ttv-storyboard-panel`。

右侧浮层是生成控制台，像素规格见 `15.1`。它的位置必须是：

```css
top: 58px;
right: 18px;
bottom: 18px;
width: 390px;
border-radius: 14px;
z-index: 2147483001;
```

左侧 `片段` 页签插在 Remotion 原生 `合成列表 / 素材` 旁边，像素规格见 `15.2`。它不能放到右侧原生 props 面板，也不能和生成控制台混在一起。用户操作空间应该是：

```text
左侧：合成列表 / 素材 / 片段
中央：Remotion 原生预览画布
右侧：本项目生成控制台浮层 + Remotion 原生 props 面板各自保留
```

插件状态全部在 `ttv.*` 命名空间：

```js
localStorage["ttv.generatorPanel"];
localStorage["ttv.storyboardPanel"];
localStorage["ttv.lastProjectId"];
localStorage["ttv.lastProgress"];
```

唯一允许写入 Remotion 命名空间的是预览 props override：

```js
localStorage["remotion_inputPropsOverride" + window.location.origin] = JSON.stringify(props);
```

#### 15.7.3 备用独立生成页

文件：

```text
frontend/video-generator.html
```

入口：

```text
http://127.0.0.1:3037/video-generator
```

这是一个备用独立页面，不是主入口。主入口已经是 `http://127.0.0.1:3057` 的 Remotion Studio 插件。保留它的目的：

- API 调试。
- 不打开 Studio 时快速生成视频。
- 作为右侧生成控制台的完整页面参考。

复刻布局：

```css
.page {
  width: min(100% - 36px, 1260px);
  margin: 0 auto;
  padding: 28px 0;
  display: grid;
  gap: 16px;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(560px, 1fr) minmax(390px, 470px);
  gap: 16px;
  align-items: start;
}

.panel {
  border: 1px solid #ded8ce;
  border-radius: 18px;
  background: rgba(255,255,255,0.88);
  box-shadow: 0 18px 60px rgba(0,0,0,0.06);
}
```

页面结构：

- 顶部 header：左侧标题 `文本生成视频`，右侧状态 pill。
- 左侧 panel：文案 textarea、生成模式、模板、标题、副标题、TTS 指令、视觉参数、字幕选项、生成按钮。
- 右侧 sticky output：`video` 预览、状态块、打开视频 / 打开项目 / 下载视频链接、日志。

关键尺寸：

- textarea 高 `260px`，行高 `1.75`。
- input / select 高 `40px`，圆角 `10px`。
- button 高 `42px`，圆角 `10px`。
- video `aspect-ratio: 16 / 9`，圆角 `12px`。
- log `max-height: 260px`。
- 右侧 output `position: sticky; top: 18px`。
- 小于 `1020px` 时 `.workspace` 变成单列；小于 `620px` 时 page 宽度变为 `min(100% - 24px, 1260px)`。

交互：

```http
POST /api/jobs
GET  /api/jobs/:id
```

成功后更新 `video.src`、打开视频链接、项目编辑链接和下载链接。这个页面可以打开 `/video-project/:id`，但在 Studio 主工作流里应改为把项目载入左侧 `片段` 页签。

#### 15.7.4 备用独立项目编辑页

文件：

```text
frontend/video-project.html
```

入口：

```text
http://127.0.0.1:3037/video-project/:id
```

这是备用项目编辑器，不是 Studio 主编辑器。主编辑器是 Remotion Studio 左侧的 `片段` 页签。保留它的目的：

- 调试 `.runtime/video-projects/<id>.json`。
- Studio 插件加载失败时仍能编辑项目。
- 为左侧 `片段` 页签提供交互参考。

复刻布局：

```css
.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

header {
  height: 58px;
  padding: 0 18px;
  border-bottom: 1px solid #deded9;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(12px);
}

.main {
  display: grid;
  grid-template-columns: 290px minmax(360px, 1fr) 340px;
  gap: 12px;
  padding: 12px;
}

.panel {
  border: 1px solid #dfdfda;
  border-radius: 12px;
  background: #fff;
}
```

页面结构：

- 顶部 header：项目标题、状态、打开视频、总导出。
- 左列 `290px`：片段列表，`.scenes` 高 `calc(100vh - 174px)`。
- 中列：预览 panel，`.preview` margin `12px`、圆角 `12px`、黑底、最小高 `360px`；有导出视频时显示 `<video controls>`。
- 右列 `340px`：当前片段表单，`.form` 高 `calc(100vh - 174px)`。
- 底部 footer：片段条高 `58px`，每个 `.block` 最小宽 `82px`。

交互：

```http
GET   /api/projects/:id
PATCH /api/projects/:id/segments/:segmentId
POST  /api/projects/:id/segments/:segmentId/lock
POST  /api/projects/:id/segments/:segmentId/rematch-visual
POST  /api/projects/:id/segments/:segmentId/replace-visual
POST  /api/projects/:id/reorder
POST  /api/projects/:id/export
```

可编辑字段必须和 Studio 左侧 `片段` 页签一致：旁白、字幕、视觉意图、模板 ID、场景类型、开始 / 结束毫秒、锁定、画面候选、替换画面。不要在这个备用页面新增只有它有、Studio 内嵌编辑器没有的核心能力。旧 `/scenes/*` 和 `*-material` 接口只作为兼容入口保留。

#### 15.7.5 Composition / Template 画布前端

文件入口：

```text
src/Root.tsx
src/templates/*.tsx
src/historical-globe/compositions/*.tsx
```

这是项目真正的视频画布前端。每个 Composition 都是一个可预览、可渲染、可通过 schema 编辑参数的 React UI。它们显示在 Remotion Studio 左侧 `合成列表`，画面显示在中央 preview canvas，参数显示在右侧原生 props 面板。

当前 `src/Root.tsx` 注册 32 个合成：

自动视频 / 片段系统：

```text
DocumentReveal
QuoteReveal
PortraitFocus
ConceptDiagram
MetaphorVisual
FootageScene
MixkitReveal
RemotionLabShowcaseAsset
MultiSceneVideo
GeneratedTemplateVideo
NarratedVideo
```

动态图形模板：

```text
ClaudeTyper
SpotlightReveal
ProceduralFish
RulerProgress
SvgAssembly
Wechat2D
ThreeDTicker
VinylPlayer
```

提示词动态图形：

```text
PromptTextRotation
PromptProgressBar
PromptHistogram
PromptAnimatedShapes
```

三维模板：

```text
ThreeProductStage
ThreeBouncingSpheres
ThreeParticleNebula
ThreeCardCascade
```

地图 / 地球 / 历史模板：

```text
MapRouteFlyover
AtlasMapFlyover
EarthGlobe
HistoricalGlobeTexture1938
SinoJapaneseWarDemo
```

复刻规则：

- `MultiSceneVideo` 是自动片段主合成；它读取 `scenes`、`audioSrc`、`captions`，用 `Sequence` 拼接多个镜头。
- `GeneratedTemplateVideo` 是单模板包装器；它读取 `templateId`、`audioSrc`、`captions` 和时长。
- `DocumentReveal`、`QuoteReveal`、`PortraitFocus`、`ConceptDiagram`、`MetaphorVisual`、`AtlasMapFlyover`、`MapRouteFlyover`、`HistoricalGlobeTexture1938`、`SvgAssembly`、`PromptHistogram`、`RulerProgress`、`PromptTextRotation`、`MixkitReveal` 都可以作为 `programmatic` provider 被自动片段调度。
- `RemotionLabShowcaseAsset` 是素材库预览合成：左侧只注册一个入口，右侧用 `assetId` 选择 263 个 RemotionLab showcase 素材，避免把 263 个条目直接堆进合成列表。
- `FootageScene` 是 footage provider 的渲染壳，只有 `visual-resolver.mjs` 或手动替换素材给出真实 `asset.path` 时使用。
- 地图、历史和程序动画模板应通过 `sceneRegistry.tsx` 和 `visual-provider-manifest.json` 接入自动片段，不要让前端下拉框硬编码“文本里有某词就选某模板”。
- 所有画布 UI 的细颗粒参数都放在 Remotion 原生 props 面板，不要在右侧生成控制台或左侧片段重复实现完整模板参数编辑器。

#### 15.7.6 前端复用原则

以后扩展前端时按这个优先级复用：

1. 需要预览视频：复用 Remotion Studio 中央 canvas 和 `MultiSceneVideo`。
2. 需要改 Composition 参数：复用 `Root.tsx` 的 `schema/defaultProps` 和 Remotion 右侧原生 props 面板。
3. 需要创建视频项目：复用右侧 `ttv-generator-panel` 和 `/api/jobs`。
4. 需要改片段：复用左侧 `ttv-storyboard-panel` 和 `/api/projects/:id` 系列接口。
5. 需要备用独立页面：才使用 `video-generator.html` 或 `video-project.html`，但不能让它们成为能力唯一来源。
6. 需要新增模板或程序动画 provider：先补 `src/templates/*`、`Root.tsx`、`sceneRegistry.tsx`、`visual-provider-manifest.json`，再决定是否在生成控制台的模板下拉中暴露。

禁止的重复建设：

- 不再另起一个主控制台。
- 不把生成控制台塞进中央视频预览框。
- 不把片段编辑塞进右侧生成控制台。
- 不占用 Remotion 原生右侧 props 面板承载项目片段。
- 不自建主预览播放器替代 Remotion Studio 画布。
- 不创建第二套 project store 或第二套素材匹配状态。

### 15.8 Segment-based 项目工作流

新一层工作台能力已经落在 `frontend/remotion-studio-plugin.js`，不是新建入口页。主方向不是自由剪辑软件，而是花生 AI 一类的 Segment-based Video Editor：

```text
一句/一段话 = 一个片段 = 一个画面 = 一个可管理单元
```

一个片段只绑定一个主画面。用户主要管理“这句话用什么画面解释”，而不是管理自由素材轨、字幕轨、音频轨。

```text
顶部 VideoLab 工作栏
  -> 项目切换 / 新建项目 / 收纳 / 导出

左侧 片段 页签
  -> 片段列表 / 当前片段文本 / 当前片段画面 / 画面候选

中央 Remotion Studio 预览
  -> 仍然复用 MultiSceneVideo composition

底部 Remotion 原生时间线
  -> 原生 timeline + 紧凑片段条

右侧 生成视频 控制台
  -> 文案输入 / 任务进度 / 刷新预览 / 打开当前成片
```

主结构是 `segments`。当前仍保留 `scenes` 字段兼容 Remotion 渲染和旧 API，但前端主交互必须以 `segments` 为准：

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
  voice: {
    instruction?: string;
    audioSrc?: string;
  };
  visual: {
    source: "template" | "footage";
    templateId?: string;
    materialId?: string;
    src?: string;
    props?: Record<string, unknown>;
    confidence?: number;
    reason?: string;
  };
  alternatives: MaterialCandidate[];
  status: "ok" | "missing_visual" | "low_confidence" | "needs_review";
  locked: boolean;
};
```

#### 15.8.1 顶部项目工作栏

DOM：

```text
div.ttv-workbar
button#ttv-project-toggle
div#ttv-project-menu
button#ttv-create-project
button#ttv-quick-create
button#ttv-workbar-compact
button#ttv-workbar-export
```

像素规格：

```css
.ttv-workbar {
  height: 28px;
  min-width: 0;
  padding: 0 6px;
  border-radius: 9px;
  background: rgba(15,17,21,.94);
  z-index: 2147482999;
}

.ttv-workbar.docked {
  position: static;
  width: auto;
  max-width: min(520px, calc(100vw - 380px));
  margin-left: 8px;
}

.ttv-workbar.docked .ttv-workbar-status,
.ttv-workbar.docked #ttv-workbar-compact,
.ttv-workbar.docked .ttv-brand {
  display: none;
}

.ttv-workbar.floating {
  position: fixed;
  top: 42px;
  left: clamp(84px, 22vw, 304px);
  right: 126px;
  height: 40px;
  padding: 0 10px;
  border-radius: 13px;
}
```

交互：

- 点击项目名展开最近项目菜单。
- 最近项目来自 `GET /api/projects`，数据源是 `.runtime/video-projects/*.json`。
- 点击项目调用 `GET /api/projects/:id`，再调用 `GET /api/projects/:id/props` 写入 Remotion input props override。
- dock 模式不显示独立 `+`；菜单里的 `+ 新建项目` 调用 `POST /api/projects`，只创建空工作空间。floating fallback 可以保留独立 `+`。
- `导出` 调用 `POST /api/projects/:id/export`。
- `收纳` 写入 `localStorage["ttv.workbar"] = "collapsed" | "expanded"`。
- 顶部栏优先用 `ensureWorkbarDocked()` 插入 Remotion 原生 `Help / 帮助` 菜单后面，成为原生顶栏的一部分。
- dock 到 Help 后面的版本必须是紧凑条：隐藏品牌、状态、收纳按钮和独立 `+`，只保留项目切换和导出；新建项目放在项目下拉菜单里，避免重复按钮和挤压 Remotion 中央标题。
- 只有找不到原生 Help 菜单时才使用 `.ttv-workbar.floating` 降级浮层。

项目切换逻辑：

```js
async function switchProject(projectId) {
  const project = await loadProject(projectId);
  if (project.scenes?.length) {
    setStoryboardOpen(true);
    await applyProjectToStudioPreview(projectId);
  }
}
```

这保证“切项目 = 切整个视频工作空间”，而不是只换一个下拉值。

#### 15.8.1.1 布局审查硬规则

这次布局审查发现过的错误以后不能回退：

- 顶部项目栏不能 `left: 50% + transform` 居中悬浮，否则会压住 Remotion 原生顶栏和右侧按钮。
- 顶部项目栏不能同时写死 `min-width` 和依赖右侧控制台的 `max-width: calc(100vw - 460px)`，窄屏会互相打架。
- 顶部项目栏默认必须 dock 到 Remotion 原生 `Help / 帮助` 后面；悬浮只允许作为找不到原生菜单时的 fallback。
- 右侧生成控制台不能让 `生成视频` 启动按钮继续漂在画面中央边缘；启动按钮必须优先并列在 Remotion 原生 `渲染` 按钮旁边，控制台打开时必须隐藏。
- 左侧片段不能完全依赖 Remotion explorer 是否可见；如果原生左栏在窄屏下消失，必须出现 `button.ttv-storyboard-launcher` 作为 fallback。
- 左侧片段不能是“长列表后面接时间线再接编辑器”。当前固定顺序是：操作条 -> 片段列表 -> 当前片段编辑器。
- 底部不能暴露旁白/素材/镜头/字幕四轨。底部只允许一个紧凑片段条：`[01 3.2s][02 4.8s][03 5.1s]`。
- 左侧双按钮不能在窄栏里用普通 flex 横排硬挤，必须用 `grid-template-columns: 1fr 1fr` 或上下堆叠。
- 任何主面板里不能出现滚轮套滚轮。左侧片段只允许 `.ttv-body` 一个滚动容器；片段列表和当前编辑器都不再单独滚动，底部片段条也不能再塞回左侧滚动区。
- 同一个动作只能保留一个主入口：总导出只在顶部工作栏；右侧生成控制台不再放第二个“总导出”；左侧片段不再放“打开生成控制台”。
- `tracks/clips` 只能作为内部兼容或未来高级模式，不能作为默认主交互。

#### 15.8.2 片段条

服务端在 `scripts/project-store.mjs` 中提供：

```js
projectToSegments(project)
```

它把现有 `scenes[]` 转成主交互使用的 `segments[]`。`publicProject(project)` 会同时返回 `segments` 和兼容用的 `tracks`，但默认前端只渲染 `segments`。

底部原生时间线区域只渲染片段条：

```text
section.ttv-native-timeline-dock
div.ttv-segment-strip
div.ttv-segment-strip-head
div.ttv-segment-lane
div.ttv-segment-block
```

像素规格：

```css
.ttv-segment-strip {
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: #121212;
}

.ttv-native-timeline-dock.docked {
  width: 100%;
  flex: 0 0 34px;
  min-height: 34px;
  order: 2147483000;
  padding: 4px 16px 6px;
  border-top: 1px solid rgba(255,255,255,.08);
  background: #111;
}

.ttv-native-timeline-dock.docked .ttv-segment-strip {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.ttv-native-timeline-dock.docked .ttv-segment-strip-head {
  display: none;
}

.ttv-native-timeline-dock.floating {
  position: fixed;
  left: 360px;
  right: 420px;
  bottom: 12px;
  max-height: 218px;
  overflow: hidden;
}

.ttv-segment-lane {
  position: relative;
  height: 34px;
}

.ttv-segment-block {
  position: absolute;
  top: 4px;
  height: 26px;
  border-radius: 6px;
  font-size: 10px;
}

.ttv-segment-block.dense {
  padding: 0;
  color: transparent;
}
```

当前已实现的片段交互：

- 点击片段块选中片段，并把中央 Remotion 预览跳到该片段开始帧。
- 拖动片段块只做片段排序，落点后调用 `POST /api/projects/:id/reorder`。
- 片段块颜色表达状态：模板画面、素材画面、低置信度、缺画面、已锁定、当前选中。
- 已锁定片段不允许拖拽排序。
- 原生 Remotion 左侧栏不可用时，`body.ttv-storyboard-undocked` 会把片段面板挂到 `document.body`，并显示左侧 fallback 按钮。
- 底部片段条由 `ensureTimelineDocked()` 优先查找 Remotion Studio 原生 `.__remotion-horizontal-scrollbar`，并插入它的 flex-column 父容器，成为原生 timeline 区域里的底部一行。只有找不到原生底部时间线时才使用 `.ttv-native-timeline-dock.floating` 降级显示。
- 短片段宽度不足 `7%` 时使用 `.dense` 隐藏文本，避免小屏互相压字。

剪辑能力作为高级能力收在当前片段编辑器里：开始/结束毫秒、素材内偏移、转场等可以存在，但不能放到底部主交互里，也不能把产品变成自由剪辑软件。

#### 15.8.3 关于 React / Tailwind / dnd-kit / wavesurfer

建议里的 React/Tailwind 组件、Zustand store、`dnd-kit` 和 `wavesurfer.js` 是后续“独立专业编辑器”路线的合适技术栈，但当前主前端是运行时注入到 Remotion Studio 的单文件 vanilla 插件：

```text
frontend/remotion-studio-plugin.js
```

所以当前源码没有引入一套平行 React 编辑器，也没有安装未使用依赖。等未来需要独立编辑器时，落地方式应该是：

```text
src/editor/store/useSegmentStore.ts
src/editor/components/TopBar.tsx
src/editor/components/SegmentStrip.tsx
src/editor/components/SegmentList.tsx
src/editor/components/Inspector.tsx
```

但这些 React 组件必须复用现有后端和数据模型：

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id/segments/:segmentId`
- `POST /api/projects/:id/segments/:segmentId/rematch-visual`
- `POST /api/projects/:id/segments/:segmentId/replace-visual`
- `POST /api/projects/:id/reorder`
- `POST /api/projects/:id/export`
- `segments`
- `projectToSegments(project)`
- `projectToMultiSceneProps(project)`

禁止 React 编辑器重新定义一套 project JSON、画面候选结构或导出链路。`tracks/clips` 只能在未来高级模式里复用，不得作为默认主交互。

## 16. 一站式自动片段入口验证

启动：

```console
npm run dev:video
```

打开：

```text
http://127.0.0.1:3057
```

确认右侧“生成视频”面板里有：

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

自动片段模式不使用这个下拉选择的单一模板，而是由 `scripts/scene-planner.mjs` 根据文本内容自动选择多个镜头模板。

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
frontend/video-project.html
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

6. 写 `scripts/text-to-video.mjs`：

```text
解析 CLI 参数
调用 TTS API
下载音频
ffmpeg 转 MP3
ffprobe 读时长
写 props JSON
调用 Remotion CLI render
```

7. 写 `scripts/scene-planner.mjs` 和 `scripts/text-to-scenes-tts-video.mjs`：

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

9. 写 `src/templates/visual-provider-manifest.json` 和 `scripts/visual-resolver.mjs`：

```text
把程序动画、兜底模板、footage 统一登记为 VisualProvider
为每个 provider 写 accepts / rejectIf / capabilities / propMapping / score / duration
resolver 对 Programmatic / Template / Footage 三类 provider 做硬过滤、打分、填参和决策追踪
每个 scene 输出 providerType / visualProviderId / visualCandidates / decisionTrace
```

10. 写 `scripts/asset-indexer.mjs`、`scripts/asset-matcher.mjs` 和 `scripts/scene-asset-planner.mjs`：

```text
扫描 public/footage
生成 public/generated/asset-index.json
给 resolver 提供 footage 候选
兼容旧流程：给已有 scenes 单独追加 visualLayer
```

11. 写 `scripts/project-store.mjs` 和 `scripts/export-video-project.mjs`：

```text
把生成结果转成 VideoProject
保存 .runtime/video-projects/<id>.json
支持 scene patch / lock / reorder / replace material
把项目重新转换成 MultiSceneVideo props
调用 Remotion 总导出
```

12. 写 `scripts/video-ui-server.mjs`：

```text
GET /video-generator
GET /video-project/:id
GET /studio-plugin.js
POST /api/jobs
GET /api/jobs/:id
GET /api/projects/:id
PATCH /api/projects/:id/segments/:segmentId
POST /api/projects/:id/segments/:segmentId/rematch-visual
POST /api/projects/:id/segments/:segmentId/replace-visual
POST /api/projects/:id/export
GET /files/:id
```

12. 写 `frontend/remotion-studio-plugin.js` 和 `frontend/video-project.html`：

```text
右侧生成视频按钮
右侧固定生成控制台
左侧 explorer 片段 tab
提交任务 POST /api/jobs
每 2 秒轮询 GET /api/jobs/:id
生成进度持久化到 ttv.lastProgress
项目 ID 持久化到 ttv.lastProjectId
GET /api/projects/:id/props 写入 Remotion input props override
中央 Remotion Studio 预览 MultiSceneVideo
左侧片段列表 / 当前片段属性 / 画面候选
备用项目编辑器 frontend/video-project.html
Studio 中文化替换
```

13. 写 `scripts/studio-plugin-proxy.mjs`：

```text
代理 Remotion Studio
注入 studio-plugin.js
```

14. 写 `scripts/studio-with-video-ui.mjs`：

```text
同时启动 video-ui-server
启动 remotion studio
启动 studio-plugin-proxy
```

15. 在 `package.json` 增加：

```json
{
  "scripts": {
    "dev": "remotion studio",
    "dev:video": "node scripts/studio-with-video-ui.mjs",
    "plan-scenes": "node scripts/scene-planner.mjs",
    "text-to-scenes-video": "node scripts/text-to-scenes-video.mjs",
    "text-to-scenes-tts-video": "node scripts/text-to-scenes-tts-video.mjs",
    "index-assets": "node scripts/asset-indexer.mjs",
    "match-assets": "node scripts/scene-asset-planner.mjs",
    "export-project": "node scripts/export-video-project.mjs",
    "text-to-video": "node scripts/text-to-video.mjs",
    "video-ui": "node scripts/video-ui-server.mjs",
    "lint": "eslint src && tsc"
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
http://127.0.0.1:3057
```

确认：

- Remotion Studio 能打开。
- Remotion 原生“渲染”按钮旁边有“生成视频”按钮，控制台打开时该按钮隐藏。
- 点击后右侧出现 `一站式生成视频` 控制台，宽度约 390px。
- 左侧 `合成列表 / 素材` 旁边有 `片段` 页签。
- 点击 `片段` 后左侧只显示片段列表和当前片段编辑，不显示生成表单。
- 选择任意合成，右侧能看到 props 编辑区。
- 生成视频任务能进入运行状态。

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
3037 文本生成视频 API
3057 Studio 插件代理
```

Windows 查看端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,3037,3057
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
  -> scripts/scene-planner.mjs 拆句
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

- `scripts/scene-planner.mjs`：文本拆块、caption 驱动片段生成、关键词提取、语义卡、视觉合约、调用 Visual Resolver 生成 scene。
- `scripts/visual-resolver.mjs`：统一调度 `VisualProvider`，按 `programmatic / footage / static / fallback` 四类资源执行握手、打分、填参和决策追踪。
- `scripts/sound-resolver.mjs`：根据 `visualContract.kind`、事件动作和叙事角色生成 `soundDesign` 元数据。
- `scripts/timeline-aligner.mjs`：旧兼容工具；新一站式生成不再用它把 captions 按文本长度分组到 scenes。
- `scripts/asset-indexer.mjs`：扫描 `public/footage/`，生成素材索引草稿。
- `scripts/asset-matcher.mjs`：旧兼容工具，给已有 scenes 单独追加 footage 候选；一站式生成主链路优先走 `visual-resolver.mjs`。
- `scripts/scene-asset-planner.mjs`：给已有 scenes JSON 追加 `visualLayer`。
- `scripts/text-to-scenes-video.mjs`：生成 scenes/props，并可直接渲染 `MultiSceneVideo`。
- `scripts/import-mixkit-reveal.mjs`：抓取 Mixkit Reveal 分类两页，解析 26 个详情页、下载 AE zip/preview/poster，并写入可追踪 manifest。
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

校验器在 `scripts/animation-contracts.mjs`。它会读取 `visual-provider-manifest.json`，并检查：

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
scripts/evidence-resolver.mjs
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

项目编辑器入口：

```text
http://127.0.0.1:3037/video-project/:id
```

主入口现在是 Remotion Studio：

```text
http://127.0.0.1:3057/MultiSceneVideo
```

生成完成后，Studio 插件会自动加载项目 props 并切到 `MultiSceneVideo`。`/video-project/:id` 仍保留为备用调试页面，但它不是主工作流。当前内嵌编辑闭环：

- 右侧浮层：文案生成、生成模式、TTS 指令、生成进度、刷新预览、打开当前成片。
- 左侧 `片段` 页签：片段列表、当前片段属性、片段理解、画面候选。
- 中央画布：Remotion Studio 原生 `MultiSceneVideo` 预览。
- 底部原生时间线：原生播放头和刻度 + 紧凑片段条，不暴露旁白/素材/镜头/字幕多轨。
- 支持：修改旁白/字幕、修改起止时间、修改模板 ID、锁定片段、重配画面、替换画面、总导出。
- 修改片段后点击右侧控制台的“刷新 Studio 预览”，插件会重新写入 Remotion input props override 并刷新 Studio。

核心文件：

```text
frontend/video-project.html
frontend/remotion-studio-plugin.js
scripts/project-store.mjs
scripts/export-video-project.mjs
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

`scene-planner.mjs` 不再直接用 `chooseTemplate()` 决定画面，主链路改为调用 `scripts/visual-resolver.mjs`。Resolver 的输入是 `SegmentSemanticCard + VisualContract`，输出是统一的 `VisualProvider` 决策：

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

`scripts/text-to-scenes-tts-video.mjs` 在生成 SRT 成功后会调用 `planScenesFromCaptions()`。caption 仍是父时间轴，但 planner 会继续做 semantic micro-segment：如果 caption 里超过 22 个有效汉字，或同时出现多个实体、地点、文件名、人物名、隐喻、转折词，就尝试切成更小片段。每个 micro-segment 都有 `parentCaptionId`、`parentCaptionIndex` 和 `estimatedTiming`，时间按文本 token 比例分配在父 caption 内。这样仍满足“一段话、一段音频、一个画面”，但不会把一句里三件事塞进一个画面。

scene 的时间来自 caption 或父 caption 内的 micro-segment 分配，scene 的语义文本优先来自原始文案：当原始句子数和 caption 数不一致时，用 caption 文本在原文中找锚点切片，避免 ASR 错字污染画面匹配。禁止再用旁白文本长度把多个 captions 分组到旧 scenes；那会造成画面和声音错位。只有在跳过字幕或字幕接口失败时，才使用文本拆句估算并按音频总时长拉伸。

项目持久层也必须执行同一条规则，不能只在生成脚本里校验。`scripts/project-store.mjs#repairProjectTimeline()` 是统一闸门：

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

白布写字、纯字幕卡、白底大字这类素材不能进入真实 footage 池。`scripts/asset-quality.mjs` 统一计算 `qualityGate`：

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

Studio 插件入口：

```console
npm run dev:video
```

然后打开：

```text
http://127.0.0.1:3057
```

右侧点 `生成视频` 会打开右侧生成控制台。默认生成模式是 `自动片段`，流程是文本 -> 语音 -> 片段 -> 成片；如果只想套一个固定模板，把 `生成模式` 切到 `单模板`。生成完成后左侧 `片段` 页签会载入项目，用来继续改片段画面。

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
