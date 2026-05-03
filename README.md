# Remotion 视频工作台与文本生成视频系统

GitHub 仓库地址：`https://github.com/emptyinkpot/FuckVideo`

这是一个本地 Remotion 工程，核心能力是：

```text
Remotion Studio 模板预览与参数编辑
  + 右侧“生成视频”控制台
  + 左侧“分镜”扩展页签
  + 千问 TTS 旁白生成
  + 自动镜头规划
  + 现有 Remotion 模板复用
  + 自动音频格式标准化
  + 音频驱动镜头时间轴
  + 可选字幕文件
  + 本地素材库检索与素材镜头混合
  + 生成可编辑 video project
  + Studio 内嵌分镜微调与总导出
  + 一键渲染 MP4
```

它不是一个单独的控制台页面，也不是把控制面板塞进视频画面里。当前做法是：保留 Remotion Studio 原有工作流，右侧用浮层控制台负责“生成视频”，左侧在 `合成列表 / 素材` 旁边注入 `分镜` 页签负责镜头微调；中央画布仍然使用 Remotion Studio 原生预览屏幕。生成成功后，插件会把项目转换成 `MultiSceneVideo` props，写入 Remotion 的 input props override，并切到 `MultiSceneVideo` composition 预览。

本文档按“给一个不了解项目的人复现出近似工程”的标准编写，包含运行环境、目录结构、端口、数据流、模板系统、参数系统、API 合约、排障和验证方式。

## 1. 项目能力概览

本项目目前包含三层能力：

第一层是 Remotion 模板工程：

- `src/Root.tsx` 注册全部 Remotion compositions。
- 每个 composition 都有 `schema` 和 `defaultProps`。
- Remotion Studio 中 30 个合成都能显示 props 编辑区。
- 多数模板参数会真实影响画面，不是只挂一个空 schema。

第二层是文本生成视频链路：

- 输入文案。
- 调用千问 TTS 服务生成旁白。
- 下载 TTS 音频。
- 用 `ffmpeg` 转成 Remotion Studio 更稳定识别的标准 MP3。
- 根据音频时长计算视频时长。
- 可选调用字幕接口生成 SRT。
- 如果存在 SRT/captions，自动镜头会按音频真实时间重新分配 `fromFrame` 和 `durationInFrames`。
- 如果存在 `public/generated/asset-index.json`，自动镜头会尝试匹配 `public/footage/` 下的素材。
- 使用 `GeneratedTemplateVideo` 包装已有模板并叠加音频/字幕。
- 或使用 `MultiSceneVideo` 自动拼接多个镜头模板。
- 调用 Remotion CLI 渲染 MP4。

第三层是 Studio 内嵌前端扩展：

- `npm run dev:video` 会启动 Remotion Studio、生成视频 API、Studio 代理。
- 访问 `http://127.0.0.1:3057`。
- 代理会把 `frontend/remotion-studio-plugin.js` 注入 Studio 页面。
- Remotion 原生 `渲染` 按钮旁边会出现 `生成视频` 按钮，点击后打开右侧生成控制台；控制台打开时按钮自动隐藏。
- Remotion Studio 左侧栏 `合成列表 / 素材` 旁边会出现 `分镜` 页签。
- 插件默认模式是“一站式生成视频”：文本 -> 千问 TTS -> 自动镜头规划 -> `MultiSceneVideo` -> MP4。
- 插件也保留“单模板”模式：文本 -> 千问 TTS -> 选定 Remotion 模板 -> MP4。
- 插件提交任务到 `http://127.0.0.1:3037/api/jobs`。
- 生成完成后会保存 `.runtime/video-projects/<id>.json`。
- 生成完成后自动把项目加载到 Remotion Studio 中央预览，并打开左侧 `分镜` 页签。

第四层是项目编辑能力：

- 分镜编辑内嵌在 Remotion Studio 左侧栏，不另起一个主控制台。
- 生成控制台保持在右侧，和分镜编辑分离。
- 中央区域复用 Remotion Studio 原生 composition 预览。
- 支持保存字幕/旁白、修改视觉意图、修改模板、修改时间、锁定分镜、重配素材、替换素材、总导出。
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
    scene-planner.mjs               文本拆块、关键词提取、镜头模板匹配
    timeline-aligner.mjs            用 SRT/captions 把镜头贴到音频真实时间轴
    asset-indexer.mjs               扫描 public/footage 生成素材索引草稿
    asset-matcher.mjs               根据 sceneType、visualIntent、tags 匹配素材
    scene-asset-planner.mjs         给已有 scenes JSON 补充 visualLayer 素材信息
    project-store.mjs               VideoProject 读写、scene patch、素材替换、props 转换
    export-video-project.mjs        project.json -> MultiSceneVideo props -> MP4
    text-to-scenes-video.mjs        只生成/渲染多镜头视频，不调用 TTS
    text-to-scenes-tts-video.mjs    一站式：TTS + 自动镜头 + Remotion 渲染
    video-ui-server.mjs             本地任务 API 与静态页面服务
    studio-plugin-proxy.mjs         代理 Remotion Studio 并注入插件脚本
    studio-with-video-ui.mjs        一键启动 Studio + API + 插件代理

  src/
    Root.tsx                        所有 Composition 注册、schema、defaultProps
    index.ts                        Remotion root 入口
    templates/
      GeneratedTemplateVideo.tsx    生成视频包装器：现有模板 + 音频 + 字幕
      MultiSceneVideo.tsx           多镜头视频容器：Sequence 时间轴拼接
      DocumentReveal.tsx            条约/文件/档案类镜头模板
      AutoSceneTemplates.tsx        人物、引文、概念、隐喻四类解释型镜头模板
      FootageScene.tsx              本地素材片段镜头模板
      sceneRegistry.tsx             自动镜头 templateId -> Remotion 组件映射
      template-manifest.json        模板语义说明书，供 planner 理解模板用途
      NarratedVideo.tsx             通用旁白视频模板
      MapTemplates.tsx              地图飞越模板
      MotionTemplates.tsx           二维动态图形模板
      PromptMotionExamples.tsx      提示词动态图形模板
      ThreeDTemplates.tsx           Three.js / 三维模板
      EarthGlobeTemplate.tsx        三维地球模板
      HistoricalMapTemplates.tsx    历史地图模板

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

自动镜头生成时，任务 API 会调用：

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
30 个 Composition
30 个 schema
30 个 defaultProps
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

用途：历史文件、条约、策论、档案类镜头。自动镜头系统遇到“条约/和约/协定/策论/转让/租借地”等文本时会优先使用它。

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

用途：播放 `public/footage/` 下的本地素材片段。自动镜头系统匹配到高相关素材时，会通过 `visualLayer.type = "footage"` 调用它。

主要参数：

- `src`
- `title`
- `subtitle`
- `fit`
- `darken`
- `zoom`
- `showTitle`

`MultiSceneVideo`

用途：一站式自动镜头视频的主合成。它不代表单个模板，而是根据 `scenes` 数组用 Remotion `Sequence` 串联多个镜头。

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
   - `scripts/scene-planner.mjs` 的模板匹配规则
   - `src/templates/template-manifest.json` 的模板语义说明
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

## 9.1 一站式自动镜头生成命令行

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
npm run text-to-scenes-tts-video -- --text "条约上用词谨慎，所谓转让遮住了更复杂的权力关系。" --title "自动镜头测试" --output out/auto.mp4 --skip-srt=true
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
--max-chars        每个镜头块的目标最大字符数，默认 130
--skip-srt         是否跳过字幕
--match-assets     是否匹配 public/generated/asset-index.json，默认 true
--asset-index      素材索引路径，默认 public/generated/asset-index.json
--no-render        只生成音频/镜头/props，不渲染视频
--output           输出 MP4 路径
--json             是否输出 TEXT_TO_VIDEO_RESULT
```

## 10. 千问 TTS 接入方式

默认 TTS API：

```text
https://<private-tts-relay>/api/qwen3-tts
```

这是当前工程可用的服务地址。复刻工程时，你必须满足二选一：

- 继续使用兼容这个合约的服务。
- 修改 `scripts/text-to-video.mjs` 和 `scripts/text-to-scenes-tts-video.mjs` 顶部 `defaults.apiBase`。

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
POST /custom-voice
```

长文本接口：

```text
POST /custom-voice/long
```

当前判断逻辑：

```text
文本去空白后长度 > 800 走 /custom-voice/long
否则走 /custom-voice
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

自动镜头模式会优先使用字幕时间轴对齐画面：

```text
TTS 音频
  -> SRT/captions
  -> scripts/timeline-aligner.mjs
  -> 重新计算每个 scene 的 fromFrame / durationInFrames
  -> MultiSceneVideo 按音频真实时间切镜头
```

也就是说，一站式生成时如果没有跳过字幕，画面时长不再只按文本长度估算，而是尽量贴着语音识别时间走。当前实现依赖 `/srt` 返回的句段时间戳；后续如果接本地 Whisper/faster-whisper，只需要让它输出同样的 captions/SRT 结构即可。

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
auto-scenes       默认。一站式自动镜头：TTS -> scene-planner -> MultiSceneVideo。
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

`projectUrl` 是备用独立编辑页。Studio 主工作流使用 `projectId` 调 `GET /api/projects/:id/props`，然后把项目加载到左侧 `分镜` 页签和中央 `MultiSceneVideo` 预览。

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

返回的项目对象会带多轨道时间线视图：

```ts
type TrackType = "audio" | "scene" | "subtitle" | "material";

type TimelineTrack = {
  id: string;
  type: TrackType;
  name: string;
  clips: TimelineClip[];
};

type TimelineClip = {
  id: string;
  trackId: string;
  type: TrackType;
  startMs: number;
  endMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  title: string;
  text?: string;
  src?: string;
  templateId?: string;
  sceneId?: string;
  locked?: boolean;
};
```

`tracks` 由服务端 `projectToTracks(project)` 根据 `audioSrc / scenes / captions / visualLayer` 计算，前端不重复推导时间线。

把项目转换成 Remotion `MultiSceneVideo` props：

```http
GET /api/projects/:id/props
```

这个接口供 Studio 内嵌前端刷新中央预览使用：右侧生成控制台触发刷新，左侧分镜提供项目编辑数据。

更新单个分镜：

```http
PATCH /api/projects/:id/scenes/:sceneId
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

锁定分镜：

```http
POST /api/projects/:id/scenes/:sceneId/lock
Content-Type: application/json

{
  "locked": true
}
```

重配当前分镜素材：

```http
POST /api/projects/:id/scenes/:sceneId/rematch-material
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

替换当前分镜素材：

```http
POST /api/projects/:id/scenes/:sceneId/replace-material
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

重排分镜：

```http
POST /api/projects/:id/reorder
Content-Type: application/json

{
  "sceneIds": ["scene-002", "scene-001"]
}
```

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
- 在 Remotion Studio 左侧栏 `合成列表 / 素材` 旁边加 `分镜` 页签。
- 右侧生成控制台负责文案输入、模式选择、TTS 指令、任务提交、进度日志和刷新预览；总导出只保留顶部工作栏一个主入口。
- 左侧分镜页签只负责分镜列表、当前镜头编辑、锁定、素材重配和素材替换。
- 生成成功后调用 `GET /api/projects/:id/props`，把项目写入 Remotion input props override，并切到 `/MultiSceneVideo`，复用中央预览屏幕。
- 用 MutationObserver 把常见 Remotion Studio 英文 UI 替换成中文。

中文化是运行时替换，不改 `node_modules`。这样升级 Remotion 时更安全。

## 15. 前端交互与像素规格

Studio 内嵌扩展前端集中在：

```text
frontend/remotion-studio-plugin.js
```

它是一个运行时注入脚本，不修改 Remotion Studio 源码和 `node_modules`。注意：这不是项目里唯一的前端；它只负责把“生成视频”和“分镜编辑”嵌入 Remotion Studio。完整前端还包括 Remotion Studio 原生界面、两个备用独立 HTML 页面，以及 `src/Root.tsx` 注册的 30 个 Composition 画布 UI。

复刻 Studio 内嵌工作流时应保持三个工作区分离：

```text
左侧 Remotion explorer sidebar
  -> 原生 合成列表 / 素材
  -> 注入 分镜 tab

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
- 生成进度和日志必须常驻右侧控制台，不放进左侧分镜。
- 每次轮询 `GET /api/jobs/:id` 后都要更新 `ttv.lastProgress`，页面跳转到 `/MultiSceneVideo` 后仍能恢复上一轮状态。

### 15.2 左侧分镜页签

左侧分镜由两个 DOM 节点组成：

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

左侧分镜页签尺寸：

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
```

左侧分镜只包含：

- 当前项目提示
- 分镜列表
- 当前分镜旁白 / 字幕
- 当前分镜视觉意图
- 当前分镜模板
- 当前分镜类型
- 开始 / 结束毫秒
- 保存分镜
- 锁定 / 解除锁定
- 重配素材
- 替换为候选素材

左侧分镜不能包含：

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

- 点击 `分镜` 时隐藏左侧原生 explorer 内容，只显示 `ttv-storyboard-panel`。
- 点击 `合成列表` 或 `素材` 时恢复 Remotion 原生左侧内容。
- 右侧 Remotion 原生参数栏不应该被 `分镜` 占用。
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

切换左侧分镜时，如果当前页面已经有 `window.remotion_setFrame`，可以把预览跳到该镜头开始帧：

```js
const frame = Math.round((scene.startMs / 1000) * 30);
window.remotion_setFrame(frame, "MultiSceneVideo", 0);
```

### 15.4 前端 API 链接

页面入口：

```text
http://127.0.0.1:3057                         带插件注入的 Remotion Studio
http://127.0.0.1:3057/MultiSceneVideo         自动分镜主预览 composition
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

左侧分镜编辑：

```http
GET   http://127.0.0.1:3037/api/projects/:id
PATCH http://127.0.0.1:3037/api/projects/:id/scenes/:sceneId
POST  http://127.0.0.1:3037/api/projects/:id/scenes/:sceneId/lock
POST  http://127.0.0.1:3037/api/projects/:id/scenes/:sceneId/rematch-material
POST  http://127.0.0.1:3037/api/projects/:id/scenes/:sceneId/replace-material
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
3. 脚本生成 TTS、自动镜头 scenes、`MultiSceneVideo` props 和 MP4。
4. 前端每 2 秒轮询 `GET /api/jobs/:id`。
5. 成功后保存 `.runtime/video-projects/<id>.json`。
6. 插件拉取 `GET /api/projects/:id/props`。
7. 插件把 props 写入 `remotion_inputPropsOverride<studio-origin>`，并切换到 `/MultiSceneVideo`。
8. 中央预览屏幕显示自动分镜视频。
9. 左侧自动打开 `分镜` 页签继续编辑项目。
10. 右侧继续保留生成进度日志和导出控制。

如果把“生成模式”改成“单模板”，则任务 API 会启动旧链路 `scripts/text-to-video.mjs`。

### 15.6 前端扩展原则

后续扩展必须优先复用已有模块：

- 新生成入口复用右侧 `ttv-generator-panel`，不要再新建第二套控制台。
- 新分镜操作复用左侧 `ttv-storyboard-panel`，不要把镜头编辑塞回右侧。
- 新预览能力复用 Remotion Studio 中央画布和 `MultiSceneVideo`，不要自建 `<video>` 预览替代主预览。
- 新项目数据能力复用 `.runtime/video-projects/<id>.json` 和 `project-store.mjs`，不要另建平行 project store。
- 新素材能力复用 `asset-indexer.mjs`、`asset-matcher.mjs`、`visualLayer` 和 `alternatives`，不要把素材路径散落在前端本地状态。
- 新导出能力复用 `export-video-project.mjs` 和 `projectToMultiSceneProps()`，不要在前端拼 Remotion render 参数。
- 新模板能力复用 `template-manifest.json`、`scene-planner.mjs` 和 `sceneRegistry.tsx`，不要让前端硬编码模板语义。
- 新状态持久化优先使用现有 localStorage key 命名空间 `ttv.*`，不要写入 Remotion 自有 key，除非明确是 `remotion_inputPropsOverride<origin>`。

前端边界：

- 右侧负责“生成和任务状态”。
- 左侧负责“项目和分镜编辑”。
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

左侧 `分镜` 页签插在 Remotion 原生 `合成列表 / 素材` 旁边，像素规格见 `15.2`。它不能放到右侧原生 props 面板，也不能和生成控制台混在一起。用户操作空间应该是：

```text
左侧：合成列表 / 素材 / 分镜
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

成功后更新 `video.src`、打开视频链接、项目编辑链接和下载链接。这个页面可以打开 `/video-project/:id`，但在 Studio 主工作流里应改为把项目载入左侧 `分镜` 页签。

#### 15.7.4 备用独立项目编辑页

文件：

```text
frontend/video-project.html
```

入口：

```text
http://127.0.0.1:3037/video-project/:id
```

这是备用项目编辑器，不是 Studio 主编辑器。主编辑器是 Remotion Studio 左侧的 `分镜` 页签。保留它的目的：

- 调试 `.runtime/video-projects/<id>.json`。
- Studio 插件加载失败时仍能编辑项目。
- 为左侧 `分镜` 页签提供交互参考。

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
- 左列 `290px`：分镜列表，`.scenes` 高 `calc(100vh - 174px)`。
- 中列：预览 panel，`.preview` margin `12px`、圆角 `12px`、黑底、最小高 `360px`；有导出视频时显示 `<video controls>`。
- 右列 `340px`：当前分镜表单，`.form` 高 `calc(100vh - 174px)`。
- 底部 footer：timeline 高 `58px`，每个 `.block` 最小宽 `82px`。

交互：

```http
GET   /api/projects/:id
PATCH /api/projects/:id/scenes/:sceneId
POST  /api/projects/:id/scenes/:sceneId/lock
POST  /api/projects/:id/scenes/:sceneId/rematch-material
POST  /api/projects/:id/scenes/:sceneId/replace-material
POST  /api/projects/:id/reorder
POST  /api/projects/:id/export
```

可编辑字段必须和 Studio 左侧 `分镜` 页签一致：旁白、字幕、视觉意图、模板 ID、场景类型、开始 / 结束毫秒、锁定、素材候选、替换素材。不要在这个备用页面新增只有它有、Studio 内嵌编辑器没有的核心能力。

#### 15.7.5 Composition / Template 画布前端

文件入口：

```text
src/Root.tsx
src/templates/*.tsx
src/historical-globe/compositions/*.tsx
```

这是项目真正的视频画布前端。每个 Composition 都是一个可预览、可渲染、可通过 schema 编辑参数的 React UI。它们显示在 Remotion Studio 左侧 `合成列表`，画面显示在中央 preview canvas，参数显示在右侧原生 props 面板。

当前 `src/Root.tsx` 注册 30 个合成：

自动视频 / 分镜系统：

```text
DocumentReveal
QuoteReveal
PortraitFocus
ConceptDiagram
MetaphorVisual
FootageScene
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

- `MultiSceneVideo` 是自动镜头主合成；它读取 `scenes`、`audioSrc`、`captions`，用 `Sequence` 拼接多个镜头。
- `GeneratedTemplateVideo` 是单模板包装器；它读取 `templateId`、`audioSrc`、`captions` 和时长。
- `DocumentReveal`、`QuoteReveal`、`PortraitFocus`、`ConceptDiagram`、`MetaphorVisual`、`FootageScene` 是自动镜头可调度的基础模板。
- 地图和历史模板应通过 `sceneRegistry.tsx` 和 `template-manifest.json` 接入自动镜头，不要让前端下拉框硬编码“文本里有某词就选某模板”。
- 所有画布 UI 的细颗粒参数都放在 Remotion 原生 props 面板，不要在右侧生成控制台或左侧分镜重复实现完整模板参数编辑器。

#### 15.7.6 前端复用原则

以后扩展前端时按这个优先级复用：

1. 需要预览视频：复用 Remotion Studio 中央 canvas 和 `MultiSceneVideo`。
2. 需要改 Composition 参数：复用 `Root.tsx` 的 `schema/defaultProps` 和 Remotion 右侧原生 props 面板。
3. 需要创建视频项目：复用右侧 `ttv-generator-panel` 和 `/api/jobs`。
4. 需要改分镜：复用左侧 `ttv-storyboard-panel` 和 `/api/projects/:id` 系列接口。
5. 需要备用独立页面：才使用 `video-generator.html` 或 `video-project.html`，但不能让它们成为能力唯一来源。
6. 需要新增模板：先补 `src/templates/*`、`Root.tsx`、`template-manifest.json`、`sceneRegistry.tsx`，再决定是否在生成控制台的模板下拉中暴露。

禁止的重复建设：

- 不再另起一个主控制台。
- 不把生成控制台塞进中央视频预览框。
- 不把分镜编辑塞进右侧生成控制台。
- 不占用 Remotion 原生右侧 props 面板承载项目分镜。
- 不自建主预览播放器替代 Remotion Studio 画布。
- 不创建第二套 project store 或第二套素材匹配状态。

### 15.8 IDE 项目工作流与剪辑时间线

新一层工作台能力已经落在 `frontend/remotion-studio-plugin.js`，不是新建入口页。它把产品从“一次性生成工具”推进到“IDE 式多项目视频工作台”：

```text
顶部 VideoLab 工作栏
  -> 项目切换 / 新建项目 / 收纳 / 导出

左侧 分镜 页签
  -> 分镜列表 / 当前分镜属性 / 素材候选 / 多轨道时间线

中央 Remotion Studio 预览
  -> 仍然复用 MultiSceneVideo composition

右侧 生成视频 控制台
  -> 文案输入 / 任务进度 / 刷新预览 / 打开当前成片
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
- 左侧分镜不能完全依赖 Remotion explorer 是否可见；如果原生左栏在窄屏下消失，必须出现 `button.ttv-storyboard-launcher` 作为 fallback。
- 左侧分镜不能是“长列表后面接时间线再接编辑器”。当前固定顺序是：操作条 -> 分镜列表 -> 时间线 -> 当前分镜编辑器。
- 左侧双按钮不能在窄栏里用普通 flex 横排硬挤，必须用 `grid-template-columns: 1fr 1fr` 或上下堆叠。
- 任何主面板里不能出现滚轮套滚轮。左侧分镜只允许 `.ttv-body` 一个滚动容器；分镜列表、时间线、当前编辑器都不再单独滚动。
- 同一个动作只能保留一个主入口：总导出只在顶部工作栏；右侧生成控制台不再放第二个“总导出”；左侧分镜不再放“打开生成控制台”。

#### 15.8.2 多轨道时间线

服务端在 `scripts/project-store.mjs` 中提供：

```js
projectToTracks(project)
```

返回四类轨道：

```text
audio     旁白音频
material  素材片段
scene     镜头片段
subtitle  字幕片段
```

左侧分镜页签会渲染：

```text
div.ttv-project-shell
div.ttv-row-actions
div.ttv-scene-list.compact
div.ttv-timeline
div.ttv-timebar
div.ttv-track
div.ttv-track-lane
div.ttv-clip
span.ttv-trim.left/right
```

像素规格：

```css
.ttv-timeline {
  display: grid;
  gap: 7px;
  padding: 8px;
  border-radius: 10px;
  background: #121212;
}

.ttv-project-shell {
  display: grid;
  gap: 10px;
}

.ttv-scene-list.compact {
  padding-right: 2px;
}

.ttv-timebar {
  height: 22px;
  border-radius: 6px;
}

.ttv-track {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 6px;
}

.ttv-track-lane {
  position: relative;
  height: 28px;
}

.ttv-clip {
  position: absolute;
  top: 3px;
  height: 22px;
  border-radius: 5px;
  font-size: 10px;
}

.ttv-clip.dense {
  padding: 0;
  color: transparent;
}
```

当前已实现的剪辑交互：

- 点击时间条移动播放头。
- 点击镜头 clip 选中分镜，并把中央 Remotion 预览跳到该镜头开始帧。
- 拖动 `scene` 轨道 clip 可重排镜头，落点后调用 `POST /api/projects/:id/reorder`。
- 拖动镜头 clip 左右裁剪手柄会修改 `startMs/endMs`，松手后调用 `PATCH /api/projects/:id/scenes/:sceneId` 保存。
- 已锁定分镜不允许裁剪和拖拽。
- 原生 Remotion 左侧栏不可用时，`body.ttv-storyboard-undocked` 会把分镜面板挂到 `document.body`，并显示左侧 fallback 按钮。
- 短 clip 宽度不足 `7%` 时使用 `.dense` 隐藏文本，避免小屏时间线互相压字。

这不是完整剪映时间线，但已经把数据层从 `scenes[]` 升级为 `tracks/clips`。后续加波形、吸附、快捷键、撤销重做时必须复用这个结构。

#### 15.8.3 关于 React / Tailwind / dnd-kit / wavesurfer

建议里的 React/Tailwind 组件、Zustand store、`dnd-kit` 和 `wavesurfer.js` 是后续“独立专业编辑器”路线的合适技术栈，但当前主前端是运行时注入到 Remotion Studio 的单文件 vanilla 插件：

```text
frontend/remotion-studio-plugin.js
```

所以当前源码没有引入一套平行 React 编辑器，也没有安装未使用依赖。等未来需要独立编辑器时，落地方式应该是：

```text
src/editor/store/useTimelineStore.ts
src/editor/components/TopBar.tsx
src/editor/components/TimelineEditor.tsx
src/editor/components/SceneList.tsx
src/editor/components/Inspector.tsx
```

但这些 React 组件必须复用现有后端和数据模型：

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id/scenes/:sceneId`
- `POST /api/projects/:id/reorder`
- `POST /api/projects/:id/export`
- `tracks/clips`
- `projectToMultiSceneProps(project)`

禁止 React 编辑器重新定义一套 project JSON、素材候选结构或导出链路。

## 16. 一站式自动镜头入口验证

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
自动镜头
生成初版项目
生成进度
```

也可以直接验证 API：

```powershell
$body = @{
  text = "条约上用词谨慎，所谓转让遮住了更复杂的权力关系。南满铁路成为新的利益轴线。"
  title = "一站式自动镜头测试"
  instruction = "标准播音风格，吐字清晰，语速平稳，停顿自然"
  mode = "auto-scenes"
  skipSrt = $true
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3037/api/jobs" -ContentType "application/json" -Body $body
```

任务成功日志中应看到：

```text
[1/6] 正在生成千问 TTS 旁白音频...
[4/6] 正在规划自动镜头...
[5/6] 正在渲染 Remotion 自动镜头视频...
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

自动镜头模式不使用这个下拉选择的单一模板，而是由 `scripts/scene-planner.mjs` 根据文本内容自动选择多个镜头模板。

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
src/templates/template-manifest.json
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
分句
提取关键词
匹配模板
生成 scenes JSON
把 TTS 音频、字幕和 scenes 送入 MultiSceneVideo
```

8. 写 `scripts/timeline-aligner.mjs`：

```text
读取 captions/SRT
按旁白文本长度把 captions 分组到 scenes
用字幕 start/end 重新计算 fromFrame 和 durationInFrames
没有 captions 时才使用文本估算时长
```

9. 写 `scripts/asset-indexer.mjs`、`scripts/asset-matcher.mjs` 和 `scripts/scene-asset-planner.mjs`：

```text
扫描 public/footage
生成 public/generated/asset-index.json
用 sceneType / visualIntent / keywords / tags / bestFor 给 scenes 追加 visualLayer
```

10. 写 `scripts/project-store.mjs` 和 `scripts/export-video-project.mjs`：

```text
把生成结果转成 VideoProject
保存 .runtime/video-projects/<id>.json
支持 scene patch / lock / reorder / replace material
把项目重新转换成 MultiSceneVideo props
调用 Remotion 总导出
```

11. 写 `scripts/video-ui-server.mjs`：

```text
GET /video-generator
GET /video-project/:id
GET /studio-plugin.js
POST /api/jobs
GET /api/jobs/:id
GET /api/projects/:id
PATCH /api/projects/:id/scenes/:sceneId
POST /api/projects/:id/scenes/:sceneId/rematch-material
POST /api/projects/:id/scenes/:sceneId/replace-material
POST /api/projects/:id/export
GET /files/:id
```

12. 写 `frontend/remotion-studio-plugin.js` 和 `frontend/video-project.html`：

```text
右侧生成视频按钮
右侧固定生成控制台
左侧 explorer 分镜 tab
提交任务 POST /api/jobs
每 2 秒轮询 GET /api/jobs/:id
生成进度持久化到 ttv.lastProgress
项目 ID 持久化到 ttv.lastProjectId
GET /api/projects/:id/props 写入 Remotion input props override
中央 Remotion Studio 预览 MultiSceneVideo
左侧分镜列表 / 当前分镜属性 / 素材候选
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

预期能看到 30 个合成。

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
- 左侧 `合成列表 / 素材` 旁边有 `分镜` 页签。
- 点击 `分镜` 后左侧只显示分镜列表和当前镜头编辑，不显示生成表单。
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
- 生成视频扩展已集成到 Studio 页面：原生“渲染”按钮旁边是生成入口，右侧浮层是生成控制台，左侧 explorer 是分镜页签。
- 右侧 Remotion 原生参数栏保持给 `schema/defaultProps` 编辑使用，不承载本项目分镜 UI。
- 30 个合成都已注册 schema 和 defaultProps。
- 文本生成视频默认使用 `GeneratedTemplateVideo`。
- 自动镜头系统使用 `MultiSceneVideo`，可以把长文拆成多镜头时间轴。
- 自动镜头系统会在有 captions/SRT 时使用音频真实时间轴对齐镜头。
- 素材检索系统可以扫描 `public/footage/`，并把匹配到的素材写入 scene 的 `visualLayer`。
- TTS 音频会统一转成标准 MP3。
- 可选 SRT 字幕。
- 输出视频落到 `out/`。
- 临时素材落到 `public/generated/` 和 `.runtime/text-to-video/`。

最后一次应运行的验证命令：

```console
npm run lint
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
```

## 23. 自动镜头系统

自动镜头系统解决的是“长文案如何变成有镜头切换的视频”，而不是只给整段文本套一个模板。

当前链路：

```text
文本 + TTS 音频
  -> scripts/scene-planner.mjs 拆句
  -> semanticBlocks
  -> visualBeats
  -> template-manifest.json 召回候选模板
  -> manifest 打分与模板轮换
  -> captions/SRT 可选对齐到音频真实时间轴
  -> asset-index.json 可选检索本地素材
  -> scenes JSON
  -> MultiSceneVideo
  -> Remotion Sequence 按时间轴拼接多个模板
```

新增文件：

- `scripts/scene-planner.mjs`：文本拆块、关键词提取、视觉意图生成、manifest 打分、模板轮换、scene props 生成。
- `scripts/timeline-aligner.mjs`：用 captions/SRT 把 scene 的 `fromFrame` 和 `durationInFrames` 改成音频驱动。
- `scripts/asset-indexer.mjs`：扫描 `public/footage/`，生成素材索引草稿。
- `scripts/asset-matcher.mjs`：用 sceneType、visualIntent、keywords、tags、bestFor 给 scene 匹配素材。
- `scripts/scene-asset-planner.mjs`：给已有 scenes JSON 追加 `visualLayer`。
- `scripts/text-to-scenes-video.mjs`：生成 scenes/props，并可直接渲染 `MultiSceneVideo`。
- `src/templates/DocumentReveal.tsx`：条约、文件、策论、档案类镜头模板。
- `src/templates/AutoSceneTemplates.tsx`：`PortraitFocus`、`QuoteReveal`、`ConceptDiagram`、`MetaphorVisual` 四类解释型镜头模板。
- `src/templates/FootageScene.tsx`：本地素材片段模板。
- `src/templates/sceneRegistry.tsx`：把 `templateId` 映射到现有 Remotion 模板。
- `src/templates/MultiSceneVideo.tsx`：多镜头容器，使用 Remotion `Sequence` 拼接时间轴。
- `src/templates/template-manifest.json`：模板说明书，记录每个模板的适用场景、避免场景、视觉隐喻、必需 props、时长范围和镜头角色。

### 23.1 模板说明书

`template-manifest.json` 是 planner 理解模板库的根，不再只看模板名猜用途。每个模板至少包含：

```json
{
  "id": "DocumentReveal",
  "displayName": "历史文件揭示",
  "category": "document",
  "bestFor": ["条约", "和约", "协定", "策论", "文件", "转让"],
  "avoidFor": ["战争过程", "人物身份介绍", "地理路线"],
  "visualMetaphor": "一张旧纸文件展开，展示标题、正文、高亮词和印章",
  "requiredProps": {
    "title": "文件标题",
    "body": "纸上显示的核心内容",
    "highlightWords": "需要强调的词"
  },
  "durationRangeSec": [4, 8],
  "sceneRole": ["evidence", "document", "quote"]
}
```

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

分镜结构：

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
  visualLayer: {
    type: "template" | "footage" | "template_with_footage_hint";
    clipId?: string;
    path?: string;
    startMs?: number;
    endMs?: number;
    reason?: string;
    confidence?: number;
  };
  alternatives: MaterialCandidate[];
  locked: boolean;
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

- 右侧浮层：文案生成、生成模式、TTS 指令、生成进度、刷新预览、总导出。
- 左侧 `分镜` 页签：分镜列表、当前分镜属性、素材候选。
- 中央画布：Remotion Studio 原生 `MultiSceneVideo` 预览。
- 支持：修改旁白/字幕、修改起止时间、修改模板 ID、锁定分镜、重配素材、替换素材、总导出。
- 修改分镜后点击右侧控制台的“刷新 Studio 预览”，插件会重新写入 Remotion input props override 并刷新 Studio。

核心文件：

```text
frontend/video-project.html
frontend/remotion-studio-plugin.js
scripts/project-store.mjs
scripts/export-video-project.mjs
```

`locked` 是给后续 AI 微调预留的边界。后续做“重新生成当前项目”时，应该跳过 `locked: true` 的分镜。

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

自动镜头模板统一吃一组通用字段，再由 `sceneRegistry.tsx` 适配到具体模板：

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

- `DocumentReveal` 使用 `title/body/highlightWords/tone`。
- `AtlasMapFlyover` 使用 `title/subtitle/keywords/visualFocus`。
- `QuoteReveal` 使用 `body/highlightWords/source`。
- `ConceptDiagram` 使用 `title/body/keywords` 生成节点关系。

### 24.2 镜头语言结构

planner 输出的 scene 不再只是 `{ templateId, props }`，而是包含视觉意图：

```json
{
  "id": "scene-005",
  "sceneType": "document_evidence",
  "narrationText": "这“牛”，便是被《朴茨茅斯和约》悄然易手的关东州租借地与南满铁路。",
  "visualIntent": "用文件/条约视觉呈现证据，突出关键措辞：朴茨茅斯和约、关东州、南满铁路",
  "visualIntentData": {
    "type": "document_evidence",
    "action": "show_evidence",
    "evidenceType": "document",
    "highlightWords": ["朴茨茅斯和约", "关东州", "南满铁路"]
  },
  "templateId": "DocumentReveal",
  "durationSec": 6,
  "decisionReason": "历史文件揭示: 一张旧纸文件展开，展示标题、正文、高亮词和印章",
  "props": {
    "title": "朴茨茅斯和约",
    "body": "关东州租借地与南满铁路权益转让",
    "highlightWords": ["关东州", "南满铁路", "转让"]
  }
}
```

`visualIntent` 给人看，`visualIntentData` 给机器继续匹配模板或素材。比如隐喻镜头会写出 `action: "transfer"`、`from: "俄国"`、`to: "日本"`；地图镜头会写出 `action: "route"` 或 `action: "locate"`。

### 24.3 模板轮换策略

`scene-planner.mjs` 当前实现了确定性轮换和平滑：

- 从 `template-manifest.json` 读取全部模板。
- 根据 `bestFor`、`avoidFor`、`sceneRole`、`category`、当前 `sceneType` 计算分数。
- 连续镜头如果命中同一个模板，会优先选择分数接近但不同的候选模板。
- 同类别镜头连续出现会扣分，避免全片只用文件或只用地图。
- 长历史叙事默认偏向这类节奏：

```text
establishing map -> portrait/person -> document evidence -> quote -> concept explain -> map route -> metaphor visual -> narrated fallback
```

当前 `sceneType` 识别与 manifest 召回线索：

```text
条约/和约/协定/策论/转让/租借地 -> document_evidence -> DocumentReveal 候选
引用/原文/圈点/写道 -> quote_evidence -> QuoteReveal 候选
人物/官员/将领/课长/太郎/参谋 -> character_focus -> PortraitFocus 候选
利权/铁路附属地/势力范围/控制结构 -> concept_explain -> ConceptDiagram 候选
像/仿佛/犹如/怀表/衣袋/新得之刃 -> metaphor_visual -> MetaphorVisual 候选
港/铁路/关东州/南满/旅顺/大连/黄海 -> geo_context -> AtlasMapFlyover / MapRouteFlyover 候选
战争/战役/硝烟/作战/占领 -> establishing_map -> HistoricalGlobeTexture1938 候选
其他文本 -> narration_bridge -> NarratedScene 候选
```

### 24.4 音频驱动时间轴

图文错位的根因是只用文本长度估算镜头时长。当前一站式链路改成：

```text
TTS -> SRT/captions -> timeline-aligner -> scenes[fromFrame,durationInFrames]
```

`scripts/text-to-scenes-tts-video.mjs` 在生成 SRT 成功后会调用 `alignScenesToCaptions()`，把字幕时间分组到每个 scene。这样画面切换以语音时间为主。只有在跳过字幕或字幕接口失败时，才使用文本长度估算并按音频总时长拉伸。

独立多镜头命令也支持同样的对齐：

```console
npm run text-to-scenes-video -- --text-file input.txt --audio-src generated/tts-xxxx.mp3 --captions-file public/generated/tts-xxxx.srt --output out/aligned.mp4
```

### 24.5 素材检索系统

素材检索系统解决“讲到战争、条约、港口、铁路时能不能调本地素材”的问题。当前实现是本地素材库优先，不引入外部素材搜索。

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

给已有 scenes 匹配素材：

```console
npm run match-assets -- --scenes=public/generated/scenes-demo.json --output=public/generated/scenes-with-assets.json
```

一站式链路默认会在 `asset-index.json` 存在时自动匹配素材；没有素材索引时不会中断，会继续使用模板镜头。

scene 匹配素材后会多出 `visualLayer`：

```json
{
  "visualLayer": {
    "type": "footage",
    "clipId": "war-smoke-001",
    "path": "footage/war-smoke-001.mp4",
    "confidence": 37,
    "reason": "命中：战争、硝烟、establishing_map",
    "fallbackTemplateId": "HistoricalGlobeTexture1938"
  }
}
```

`sceneRegistry.tsx` 看到 `visualLayer.type === "footage"` 时会直接渲染 `FootageScene`。如果是 `template_with_footage_hint`，当前仍主用模板，同时把匹配素材保留在 scene 里，后续可以让具体模板把素材当背景。

目前素材匹配使用本地标签/描述打分：

```text
sceneType + visualIntent + keywords
  -> tags / description / bestFor / avoidFor
  -> top match
  -> visualLayer
```

`asset-matcher.mjs` 已保留 `optionalEmbeddingRerank()` 接口。素材库少于几百条时，先用标签和描述更稳；素材库变大后，可以接 OpenAI、DashScope 或本地 embedding 做 rerank。

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

右侧点 `生成视频` 会打开右侧生成控制台。默认生成模式是 `自动镜头`，流程是文本 -> 语音 -> 镜头 -> 成片；如果只想套一个固定模板，把 `生成模式` 切到 `单模板`。生成完成后左侧 `分镜` 页签会载入项目，用来继续改镜头。

如果已有旁白音频和字幕，可以把它们传给多镜头视频：

```console
npm run text-to-scenes-video -- --text-file input.txt --audio-src generated/tts-xxxx.mp3 --captions-file public/generated/tts-xxxx.srt --output out/auto-scenes-video.mp4
```

`audio-src` 必须是 `public/` 下的相对路径，例如 `generated/tts-xxxx.mp3`。字幕文件可以传本地路径。

`MultiSceneVideo` 的 props 结构：

```json
{
  "title": "自动镜头视频",
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
      "visualLayer": {
        "type": "template_with_footage_hint",
        "clipId": "treaty-paper-001",
        "path": "footage/treaty-paper-001.mp4",
        "confidence": 24,
        "reason": "主用模板，素材作备选：命中：条约、文件、document_evidence"
      },
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
