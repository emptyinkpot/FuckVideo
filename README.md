# Remotion 视频工作台与文本生成视频系统

GitHub 仓库地址：`https://github.com/emptyinkpot/FuckVideo`

这是一个本地 Remotion 工程，核心能力是：

```text
Remotion Studio 模板预览与参数编辑
  + 右上角“生成视频”扩展
  + 千问 TTS 旁白生成
  + 自动镜头规划
  + 现有 Remotion 模板复用
  + 自动音频格式标准化
  + 可选字幕文件
  + 一键渲染 MP4
```

它不是一个单独的控制台页面，也不是把控制面板塞进视频画面里。当前做法是：保留 Remotion Studio 原有工作流，在 Studio 页面右上角注入一个“生成视频”扩展按钮；视频预览区仍然只显示视频，生成控制作为 Studio 外层扩展存在。

本文档按“给一个不了解项目的人复现出近似工程”的标准编写，包含运行环境、目录结构、端口、数据流、模板系统、参数系统、API 合约、排障和验证方式。

## 1. 项目能力概览

本项目目前包含三层能力：

第一层是 Remotion 模板工程：

- `src/Root.tsx` 注册全部 Remotion compositions。
- 每个 composition 都有 `schema` 和 `defaultProps`。
- Remotion Studio 中 25 个合成都能显示 props 编辑区。
- 多数模板参数会真实影响画面，不是只挂一个空 schema。

第二层是文本生成视频链路：

- 输入文案。
- 调用千问 TTS 服务生成旁白。
- 下载 TTS 音频。
- 用 `ffmpeg` 转成 Remotion Studio 更稳定识别的标准 MP3。
- 根据音频时长计算视频时长。
- 可选调用字幕接口生成 SRT。
- 使用 `GeneratedTemplateVideo` 包装已有模板并叠加音频/字幕。
- 或使用 `MultiSceneVideo` 自动拼接多个镜头模板。
- 调用 Remotion CLI 渲染 MP4。

第三层是 Studio 内嵌扩展：

- `npm run dev:video` 会启动 Remotion Studio、生成视频 API、Studio 代理。
- 访问 `http://127.0.0.1:3057`。
- 代理会把 `frontend/remotion-studio-plugin.js` 注入 Studio 页面。
- 页面右上角出现“生成视频”按钮。
- 插件默认模式是“一站式生成视频”：文本 -> 千问 TTS -> 自动镜头规划 -> `MultiSceneVideo` -> MP4。
- 插件也保留“单模板”模式：文本 -> 千问 TTS -> 选定 Remotion 模板 -> MP4。
- 插件提交任务到 `http://127.0.0.1:3037/api/jobs`。

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

  scripts/
    text-to-video.mjs               命令行生成视频主链路
    scene-planner.mjs               文本拆块、关键词提取、镜头模板匹配
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
      sceneRegistry.tsx             自动镜头 templateId -> Remotion 组件映射
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
    geojson/                        历史地球 GeoJSON 数据
    maps/                           地图纹理

  asset-source/
    historical-basemaps/            历史底图源数据、SVG、GeoJSON、示例素材
    natural-earth/                  Natural Earth 原始下载与解压素材

  .runtime/
    text-to-video/
      jobs/                         Web 任务临时文本
      raw-audio/                    TTS 原始音频缓存

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
25 个 Composition
25 个 schema
25 个 defaultProps
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
    "videoUrl": "/files/任务 ID"
  }
}
```

### 13.3 获取视频文件

```http
GET /files/:id
```

返回 `video/mp4`。

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

插件做了三件事：

- 在右上角加“生成视频”按钮。
- 展开一个生成视频抽屉。
- 用 MutationObserver 把常见 Remotion Studio 英文 UI 替换成中文。

中文化是运行时替换，不改 `node_modules`。这样升级 Remotion 时更安全。

## 15. 生成视频扩展 UI

扩展包含这些字段：

- 文案
- 生成模式
- 标题
- 副标题
- 视频模板
- 语音指令
- 视觉参数
- 字幕选项

默认点击“一站式生成视频”后：

1. 插件 `POST /api/jobs`。
2. 本地任务 API 启动 `scripts/text-to-scenes-tts-video.mjs`。
3. 脚本生成 TTS、自动镜头 scenes、`MultiSceneVideo` props 和 MP4。
4. 前端每 2 秒轮询 `GET /api/jobs/:id`。
5. 成功后显示“打开视频”和“下载视频”。

如果把“生成模式”改成“单模板”，则任务 API 会启动旧链路 `scripts/text-to-video.mjs`。

## 15.1 一站式自动镜头入口验证

启动：

```console
npm run dev:video
```

打开：

```text
http://127.0.0.1:3057
```

确认右上角“生成视频”面板里有：

```text
生成模式
自动镜头：文本 -> 语音 -> 镜头 -> 成片
一站式生成视频
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

## 16. 当前可选择模板

生成视频扩展可以选择：

```text
DocumentReveal                历史文件揭示
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

## 17. 从零复现近似工程的步骤

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
src/templates/sceneRegistry.tsx
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

8. 写 `scripts/video-ui-server.mjs`：

```text
GET /video-generator
GET /studio-plugin.js
POST /api/jobs
GET /api/jobs/:id
GET /files/:id
```

9. 写 `frontend/remotion-studio-plugin.js`：

```text
生成视频按钮
抽屉表单
提交任务
轮询状态
展示下载链接
Studio 中文化替换
```

10. 写 `scripts/studio-plugin-proxy.mjs`：

```text
代理 Remotion Studio
注入 studio-plugin.js
```

11. 写 `scripts/studio-with-video-ui.mjs`：

```text
同时启动 video-ui-server
启动 remotion studio
启动 studio-plugin-proxy
```

12. 在 `package.json` 增加：

```json
{
  "scripts": {
    "dev": "remotion studio",
    "dev:video": "node scripts/studio-with-video-ui.mjs",
    "plan-scenes": "node scripts/scene-planner.mjs",
    "text-to-scenes-video": "node scripts/text-to-scenes-video.mjs",
    "text-to-scenes-tts-video": "node scripts/text-to-scenes-tts-video.mjs",
    "text-to-video": "node scripts/text-to-video.mjs",
    "video-ui": "node scripts/video-ui-server.mjs",
    "lint": "eslint src && tsc"
  }
}
```

13. 建立素材目录：

```text
public/generated/
public/maps/
public/geojson/
.runtime/text-to-video/jobs/
.runtime/text-to-video/raw-audio/
out/
```

14. 跑验证：

```console
npm run lint
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
npm run dev:video
```

## 18. 验证方式

代码验证：

```console
npm run lint
```

合成注册验证：

```console
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
```

预期能看到 25 个合成。

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
CompositionTags : 25
SchemaProps     : 25
DefaultProps    : 25
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
- 右上角有“生成视频”按钮。
- 选择任意合成，右侧能看到 props 编辑区。
- 生成视频任务能进入运行状态。

## 19. 常见问题

### 19.1 Studio 里提示没有可编辑参数

原因通常是 `<Composition>` 没有传 `schema`。

本项目当前要求：

```text
每个 Composition 都必须有 schema 和 defaultProps
```

如果新增模板后忘记写 schema，Studio 会提示：

```text
Make the props of this composition interactively editable by adding a schema prop to the <Composition> component.
```

### 19.2 `UnsupportedInputFormatError`

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

### 19.3 `Unexpected token '<'`

说明某个接口返回了 HTML 错误页，而不是 JSON。

检查：

- TTS API 地址是否正确。
- 服务是否登录/鉴权有效。
- 代理是否返回 502/404。
- `postJson()` 报错里剥离出的文本。

### 19.4 端口被占用

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

### 19.5 生成任务成功但页面打不开视频

检查：

- `out/` 下是否有 `text-to-video-*.mp4`。
- `GET /api/jobs/:id` 是否返回 `result.videoUrl`。
- `GET /files/:id` 是否返回 `video/mp4`。

## 20. 安全注意

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

## 21. 当前状态

当前工程状态：

- Remotion Studio 可运行。
- 生成视频扩展已集成到 Studio 页面。
- 25 个合成都已注册 schema 和 defaultProps。
- 文本生成视频默认使用 `GeneratedTemplateVideo`。
- 自动镜头系统使用 `MultiSceneVideo`，可以把长文拆成多镜头时间轴。
- TTS 音频会统一转成标准 MP3。
- 可选 SRT 字幕。
- 输出视频落到 `out/`。
- 临时素材落到 `public/generated/` 和 `.runtime/text-to-video/`。

最后一次应运行的验证命令：

```console
npm run lint
cmd /c node_modules\.bin\remotion.cmd compositions src/index.ts
```

## 22. 自动镜头系统

自动镜头系统解决的是“长文案如何变成有镜头切换的视频”，而不是只给整段文本套一个模板。

当前链路：

```text
文本
  -> scripts/scene-planner.mjs 拆句与模板匹配
  -> scenes JSON
  -> MultiSceneVideo
  -> Remotion Sequence 按时间轴拼接多个模板
```

新增文件：

- `scripts/scene-planner.mjs`：文本拆块、关键词提取、规则式模板匹配、scene props 生成。
- `scripts/text-to-scenes-video.mjs`：生成 scenes/props，并可直接渲染 `MultiSceneVideo`。
- `src/templates/DocumentReveal.tsx`：条约、文件、策论、档案类镜头模板。
- `src/templates/sceneRegistry.tsx`：把 `templateId` 映射到现有 Remotion 模板。
- `src/templates/MultiSceneVideo.tsx`：多镜头容器，使用 Remotion `Sequence` 拼接时间轴。

目前规则式匹配：

```text
条约/和约/协定/策论/转让/租借地 -> DocumentReveal
港/铁路/关东州/南满/旅顺/大连/黄海 -> AtlasMapFlyover
战争/战役/硝烟/参谋/作战/占领 -> HistoricalGlobeTexture1938
本质/犹如/仿佛/关键/逻辑 -> PromptTextRotation
其他文本 -> NarratedScene
```

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

右上角点“生成视频”，默认就是“自动镜头：文本 -> 语音 -> 镜头 -> 成片”。如果只想套一个固定模板，把“生成模式”切到“单模板”。

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
      "templateId": "DocumentReveal",
      "fromFrame": 0,
      "durationInFrames": 180,
      "keywords": ["朴茨茅斯和约", "转让"],
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
