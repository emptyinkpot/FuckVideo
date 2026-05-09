(function () {
  const API = "http://127.0.0.1:3037";
  const templates = [
    ["DocumentReveal", "历史文件揭示"],
    ["QuoteReveal", "引文揭示"],
    ["PortraitFocus", "人物身份卡"],
    ["ConceptDiagram", "概念关系图"],
    ["MetaphorVisual", "隐喻可视化"],
    ["FootageScene", "本地素材片段"],
    ["MixkitReveal", "Mixkit 揭示预设"],
    ["RemotionLabShowcaseAsset", "RemotionLab 素材库"],
    ["SinoJapaneseWarDemo", "中日战争历史地球"],
    ["HistoricalGlobeTexture1938", "1938 历史地球纹理"],
    ["AtlasMapFlyover", "世界地图飞越"],
    ["MapRouteFlyover", "路线地图飞越"],
    ["ThreeProductStage", "三维产品舞台"],
    ["ThreeParticleNebula", "三维粒子星云"],
    ["ThreeCardCascade", "三维卡片级联"],
    ["ThreeBouncingSpheres", "三维弹跳球"],
    ["ClaudeTyper", "命令行打字机"],
    ["SpotlightReveal", "聚光灯揭示"],
    ["ProceduralFish", "程序鱼群"],
    ["RulerProgress", "进度尺"],
    ["SvgAssembly", "SVG 组装"],
    ["Wechat2D", "微信对话"],
    ["ThreeDTicker", "三维色块滚动"],
    ["VinylPlayer", "黑胶播放器"],
    ["PromptTextRotation", "提示词文本轮播"],
    ["PromptProgressBar", "提示词进度条"],
    ["PromptHistogram", "提示词柱状图"],
    ["PromptAnimatedShapes", "提示词动态图形"],
  ];

  if (window.__textToVideoPluginMounted) return;
  window.__textToVideoPluginMounted = true;
  document.documentElement.lang = "zh-CN";
  document.title = "Remotion 视频工作台";

  const studioTextMap = new Map([
    ["Render", "渲染"],
    ["Rendering", "正在渲染"],
    ["Composition", "合成"],
    ["Compositions", "合成列表"],
    ["Assets", "素材"],
    ["Preview", "预览"],
    ["Timeline", "时间线"],
    ["Console", "控制台"],
    ["Settings", "设置"],
    ["Output", "输出"],
    ["Search", "搜索"],
    ["Search...", "搜索..."],
    ["Loading", "加载中"],
    ["Error", "错误"],
    ["Errors", "错误"],
    ["Warning", "警告"],
    ["Warnings", "警告"],
    ["Open in editor", "在编辑器中打开"],
    ["Restart the studio", "重启工作台"],
    ["No composition selected", "未选择合成"],
    ["Render queue", "渲染队列"],
    ["Props", "参数"],
    ["Renders", "渲染"],
    ["Save", "保存"],
    ["Cancel", "取消"],
    ["Copy", "复制"],
    ["Download", "下载"],
    ["Refresh", "刷新"],
    ["Frames", "帧"],
    ["Frame", "帧"],
    ["Duration", "时长"],
    ["Width", "宽度"],
    ["Height", "高度"],
    ["Codec", "编码"],
    ["Quality", "质量"],
    ["Start render", "开始渲染"],
    ["Render video", "渲染视频"],
    ["Render still", "渲染单帧"],
    ["The studio server has disconnected.", "工作台服务已断开连接。"],
  ]);

  const generatorPanelStorageKey = "ttv.generatorPanel";
  const progressStorageKey = "ttv.lastProgress";
  const workbarStorageKey = "ttv.workbar";
  const pendingSceneStorageKey = "ttv.pendingSceneId";

  if (localStorage.getItem("remotion.sidebarPanel") === "storyboard") {
    localStorage.setItem("remotion.sidebarPanel", "input-props");
  }

  const state = {
    jobId: "",
    timer: 0,
    project: null,
    projects: [],
    selectedSceneId: "",
    workbarCollapsed: localStorage.getItem(workbarStorageKey) === "collapsed",
    projectMenuOpen: false,
    playheadMs: 0,
    timelineDragSceneId: "",
    compositionTreeKey: "",
  };

  const style = document.createElement("style");
  style.textContent = `
    .ttv-workbar {
      z-index: 2147482999;
      height: 28px;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 6px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 9px;
      background: rgba(15,17,21,.94);
      color: #e5e7eb;
      box-shadow: 0 10px 28px rgba(0,0,0,.26);
      backdrop-filter: blur(14px);
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
      transition: height .16s ease, opacity .16s ease;
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
    .ttv-workbar.docked,
    .ttv-workbar.docked .ttv-workbar-left,
    .ttv-workbar.docked .ttv-workbar-right {
      gap: 4px;
    }
    .ttv-workbar.docked .ttv-project-button {
      max-width: 118px;
    }
    .ttv-workbar.docked #ttv-quick-create {
      display: none;
    }
    .ttv-workbar.docked #ttv-workbar-export {
      width: 42px;
      padding: 0;
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
    body.ttv-generator-open .ttv-workbar.floating {
      right: 426px;
    }
    .ttv-workbar.compact {
      opacity: .86;
    }
    .ttv-workbar.compact:hover {
      opacity: 1;
    }
    .ttv-workbar-left,
    .ttv-workbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .ttv-brand {
      font-size: 12px;
      font-weight: 820;
      color: white;
      padding: 0 4px;
      white-space: nowrap;
    }
    .ttv-project-switcher {
      position: relative;
      min-width: 0;
    }
    .ttv-project-button {
      max-width: 170px;
      min-width: 0;
      height: 24px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: #171b24;
      color: #f5f5f5;
      padding: 0 10px;
      font: 700 11px Inter, "Microsoft YaHei", system-ui, sans-serif;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ttv-project-menu {
      position: absolute;
      top: 32px;
      left: 0;
      width: 280px;
      max-height: 360px;
      display: none;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px;
      background: #161a22;
      box-shadow: 0 18px 54px rgba(0,0,0,.42);
      overflow: hidden;
      color: #e5e7eb;
    }
    .ttv-project-menu.open { display: block; }
    .ttv-menu-head {
      height: 34px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: #9ca3af;
      font-size: 11px;
      border-bottom: 1px solid rgba(255,255,255,.09);
    }
    .ttv-project-list {
      max-height: 236px;
      overflow: auto;
      padding: 6px;
    }
    .ttv-project-item {
      width: 100%;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: #d1d5db;
      padding: 8px;
      text-align: left;
      cursor: pointer;
      font: 12px/1.35 Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-project-item:hover,
    .ttv-project-item.active {
      background: #1f2937;
      color: white;
    }
    .ttv-project-meta {
      margin-top: 3px;
      color: #8b949e;
      font-size: 10px;
    }
    .ttv-menu-action {
      width: 100%;
      height: 34px;
      border: 0;
      border-top: 1px solid rgba(255,255,255,.09);
      background: transparent;
      color: #e5e7eb;
      text-align: left;
      padding: 0 12px;
      cursor: pointer;
      font: 700 12px Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-menu-action:hover { background: #1f2937; }
    .ttv-composition-tree {
      display: none;
      margin: 2px 8px 8px 24px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background: #11151d;
      color: #d1d5db;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
      overflow: hidden;
    }
    .ttv-composition-tree.open { display: block; }
    .ttv-composition-tree-head {
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 9px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      color: #f8fafc;
      font-size: 11px;
      font-weight: 850;
    }
    .ttv-composition-tree-body {
      padding: 6px;
      display: grid;
      gap: 3px;
      overflow: visible;
    }
    .ttv-comp-node,
    .ttv-scene-node {
      width: 100%;
      min-height: 34px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #d1d5db;
      cursor: pointer;
      font: 12px/1.25 Inter, "Microsoft YaHei", system-ui, sans-serif;
      text-align: left;
    }
    .ttv-comp-node {
      padding: 6px 8px;
      color: #f8fafc;
      background: rgba(79,140,255,.12);
      font-weight: 850;
    }
    .ttv-scene-node {
      padding: 8px 8px 8px 24px;
      position: relative;
    }
    .ttv-scene-node::before {
      content: "";
      position: absolute;
      left: 11px;
      top: 0;
      bottom: 50%;
      width: 9px;
      border-left: 1px solid rgba(148,163,184,.42);
      border-bottom: 1px solid rgba(148,163,184,.42);
    }
    .ttv-scene-node:hover,
    .ttv-scene-node.active,
    .ttv-comp-node:hover {
      background: #1f2937;
      color: white;
    }
    .ttv-node-meta {
      margin-top: 2px;
      color: #8b949e;
      font-size: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ttv-workbar-button {
      height: 24px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: #171b24;
      color: #e5e7eb;
      padding: 0 8px;
      cursor: pointer;
      font: 750 11px Inter, "Microsoft YaHei", system-ui, sans-serif;
      white-space: nowrap;
    }
    .ttv-workbar-button.primary {
      border-color: transparent;
      background: #4f8cff;
      color: white;
    }
    .ttv-workbar-status {
      color: #9ca3af;
      font-size: 11px;
      max-width: 96px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ttv-native-timeline-dock {
      display: none;
      min-width: 0;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-native-timeline-dock.open {
      display: block;
    }
    .ttv-native-timeline-dock.docked {
      width: 100%;
      flex: 0 0 34px;
      min-height: 34px;
      order: 2147483000;
      box-sizing: border-box;
      padding: 4px 16px 6px;
      border-top: 1px solid rgba(255,255,255,.08);
      background: #111;
    }
    .ttv-native-timeline-dock.docked .ttv-segment-strip {
      gap: 3px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .ttv-native-timeline-dock.floating {
      position: fixed;
      left: 360px;
      right: 420px;
      bottom: 12px;
      z-index: 2147482998;
      max-height: 218px;
      overflow: hidden;
    }
    .ttv-generator-launcher {
      z-index: 2147483000;
      height: 34px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 9px;
      padding: 0 12px;
      background: #0f62fe;
      color: white;
      font: 600 13px Inter, "Microsoft YaHei", system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 14px 34px rgba(0,0,0,.28);
    }
    .ttv-generator-launcher.docked {
      position: static;
      height: 34px;
      margin-left: 8px;
      box-shadow: none;
      flex: 0 0 auto;
    }
    .ttv-generator-launcher.floating {
      position: fixed;
      top: 42px;
      right: 18px;
    }
    body.ttv-generator-open .ttv-generator-launcher { display: none; }
    .ttv-generator-panel {
      position: fixed;
      top: 58px;
      right: 18px;
      bottom: 18px;
      width: clamp(340px, 28vw, 390px);
      z-index: 2147483001;
      display: none;
      grid-template-rows: auto 1fr auto;
      background: #171717;
      color: #f5f5f5;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 14px;
      box-shadow: 0 28px 80px rgba(0,0,0,.48);
      overflow: hidden;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-generator-panel.open { display: grid; }
    .ttv-head {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }
    .ttv-generator-head {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px 0 14px;
      border-bottom: 1px solid rgba(255,255,255,.1);
      font-size: 14px;
      font-weight: 750;
    }
    .ttv-close {
      border: 0;
      background: transparent;
      color: #aaa;
      cursor: pointer;
      font-size: 18px;
    }
    .ttv-title { font-size: 14px; font-weight: 750; }
    .ttv-sub { color: #9b9b9b; font-size: 11px; line-height: 1.45; }
    .ttv-body {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .ttv-label {
      display: grid;
      gap: 6px;
      color: #aaa;
      font-size: 12px;
    }
    .ttv-input,
    .ttv-select,
    .ttv-textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      background: #232323;
      color: #fff;
      outline: none;
      padding: 0 10px;
      font: 12px Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-input,
    .ttv-select { height: 32px; }
    .ttv-textarea {
      min-height: 112px;
      resize: vertical;
      padding: 8px 10px;
      line-height: 1.55;
    }
    .ttv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ttv-row { display: flex; gap: 8px; align-items: center; }
    .ttv-row-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ttv-actions {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.1);
      display: grid;
      gap: 8px;
      background: #171717;
    }
    .ttv-progress-title {
      color: #bdbdbd;
      font-size: 11px;
      font-weight: 750;
    }
    .ttv-button {
      height: 32px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 8px;
      background: #262626;
      color: white;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .ttv-button.primary { border-color: transparent; background: #0f62fe; }
    .ttv-button:disabled { opacity: .55; cursor: not-allowed; }
    .ttv-status {
      min-height: 32px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #222;
      color: #c7c7c7;
      font-size: 11px;
      line-height: 1.45;
    }
    .ttv-log {
      overflow: visible;
      white-space: pre-wrap;
      margin: 0;
      color: #909090;
      font: 10px/1.5 Consolas, monospace;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px;
      padding: 8px;
      background: #111;
    }
    .ttv-segment-strip {
      display: grid;
      gap: 6px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 10px;
      background: #121212;
    }
    .ttv-segment-lane {
      position: relative;
      height: 34px;
      border-radius: 7px;
      background: rgba(255,255,255,.045);
      overflow: hidden;
      cursor: pointer;
    }
    .ttv-segment-block {
      position: absolute;
      top: 4px;
      height: 26px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px;
      background: #242424;
      color: #e5e7eb;
      padding: 0 7px;
      font: 750 10px/24px Inter, "Microsoft YaHei", system-ui, sans-serif;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      cursor: pointer;
      user-select: none;
    }
    .ttv-segment-block.programmatic { background: #243044; border-color: rgba(79,140,255,.28); }
    .ttv-segment-block.template { background: #2a2d39; border-color: rgba(156,163,175,.24); }
    .ttv-segment-block.footage { background: #22372d; border-color: rgba(62,180,137,.28); }
    .ttv-segment-block.low_confidence { background: #3a321d; border-color: rgba(245,158,11,.55); }
    .ttv-segment-block.missing_visual { background: #3b2020; border-color: rgba(239,68,68,.55); }
    .ttv-segment-block.locked { box-shadow: inset 0 -2px 0 rgba(80,200,120,.75); }
    .ttv-segment-block.active { outline: 2px solid rgba(79,140,255,.95); }
    .ttv-segment-block.dense { padding: 0; color: transparent; }
    .ttv-native-timeline-dock.docked .ttv-segment-lane {
      height: 24px;
      border-radius: 5px;
      background: rgba(255,255,255,.035);
    }
    .ttv-native-timeline-dock.docked .ttv-segment-block {
      top: 3px;
      height: 18px;
      line-height: 16px;
      border-radius: 4px;
      font-size: 9px;
      padding: 0 5px;
    }
    @media (max-width: 1180px) {
      .ttv-workbar.floating {
        left: 252px;
      }
      body.ttv-generator-open .ttv-workbar.floating {
        right: 374px;
      }
      .ttv-workbar-status {
        display: none;
      }
    }
    @media (max-width: 1060px) {
      .ttv-workbar.floating {
        left: 252px;
        right: 118px;
      }
      body.ttv-generator-open .ttv-workbar.floating {
        right: 18px;
      }
      body.ttv-generator-open .ttv-generator-panel {
        top: 88px;
        right: 12px;
        bottom: 12px;
        width: min(360px, calc(100vw - 24px));
      }
      .ttv-workbar-button#ttv-workbar-compact {
        display: none;
      }
    }
    @media (max-width: 760px) {
      .ttv-workbar.floating {
        left: 12px;
        right: 12px;
      }
      .ttv-brand,
      .ttv-workbar-status {
        display: none;
      }
      .ttv-project-button {
        max-width: 180px;
      }
    }
  `;
  document.head.appendChild(style);

  const workbar = document.createElement("div");
  workbar.className = "ttv-workbar";
  workbar.innerHTML = `
    <div class="ttv-workbar-left">
      <div class="ttv-brand">VideoLab</div>
      <div class="ttv-project-switcher">
        <button class="ttv-project-button" id="ttv-project-toggle" type="button">未载入项目 ▼</button>
        <div class="ttv-project-menu" id="ttv-project-menu">
          <div class="ttv-menu-head">最近项目</div>
          <div class="ttv-project-list" id="ttv-project-list"></div>
          <button class="ttv-menu-action" id="ttv-create-project" type="button">+ 新建项目</button>
          <button class="ttv-menu-action" id="ttv-reload-projects" type="button">刷新项目列表</button>
        </div>
      </div>
      <button class="ttv-workbar-button" id="ttv-quick-create" type="button">+</button>
    </div>
    <div class="ttv-workbar-right">
      <div class="ttv-workbar-status" id="ttv-workbar-status">自动保存</div>
      <button class="ttv-workbar-button" id="ttv-workbar-compact" type="button">收纳</button>
      <button class="ttv-workbar-button primary" id="ttv-workbar-export" type="button">导出</button>
    </div>
  `;
  document.body.appendChild(workbar);

  const generatorLauncher = document.createElement("button");
  generatorLauncher.className = "ttv-generator-launcher";
  generatorLauncher.type = "button";
  generatorLauncher.textContent = "生成视频";
  document.body.appendChild(generatorLauncher);

  const generatorPanel = document.createElement("aside");
  generatorPanel.className = "ttv-generator-panel";
  generatorPanel.innerHTML = `
    <div class="ttv-generator-head">
      <span>一站式生成视频</span>
      <button class="ttv-close" id="ttv-close-generator" type="button">×</button>
    </div>
    <div class="ttv-body">
      <label class="ttv-label">文案
        <textarea class="ttv-textarea" id="ttv-text">旅顺港的海风吹进东京霞关，战争的尾声并没有带来平静。新的铁路和港口，正在改变东亚的权力地图。</textarea>
      </label>
      <div class="ttv-grid">
        <label class="ttv-label">生成模式
          <select class="ttv-select" id="ttv-mode">
            <option value="auto-scenes">自动片段</option>
            <option value="single-template">单模板</option>
          </select>
        </label>
        <label class="ttv-label">标题
          <input class="ttv-input" id="ttv-title" value="南满铁路的开端" />
        </label>
      </div>
      <div class="ttv-grid">
        <label class="ttv-label">副标题
          <input class="ttv-input" id="ttv-subtitle" value="Remotion 模板 + 千问语音" />
        </label>
        <label class="ttv-label">视频模板
          <select class="ttv-select" id="ttv-template">
            ${templates.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="ttv-label">语音指令
        <input class="ttv-input" id="ttv-instruction" value="标准播音风格，吐字清晰，语速平稳，停顿自然" />
      </label>
      <div class="ttv-grid">
        <label class="ttv-label">视觉参数
          <select class="ttv-select" id="ttv-theme">
            <option value="historical">历史地图</option>
            <option value="clean">干净浅色</option>
          </select>
        </label>
        <label class="ttv-label">字幕
          <select class="ttv-select" id="ttv-srt">
            <option value="false">生成字幕</option>
            <option value="true">跳过字幕</option>
          </select>
        </label>
      </div>
      <div class="ttv-progress-title">生成进度</div>
      <div class="ttv-status" id="ttv-status">生成后会自动加载到 MultiSceneVideo，使用现有 Remotion 预览屏幕查看。</div>
      <pre class="ttv-log" id="ttv-log">等待任务。</pre>
    </div>
    <div class="ttv-actions">
      <button class="ttv-button primary" id="ttv-generate" type="button">生成初版项目</button>
      <button class="ttv-button" id="ttv-preview" type="button">刷新 Studio 预览</button>
      <a class="ttv-button" id="ttv-open-video" target="_blank" rel="noreferrer">打开当前成片</a>
    </div>
  `;
  document.body.appendChild(generatorPanel);

  const compositionTree = document.createElement("section");
  compositionTree.className = "ttv-composition-tree";
  compositionTree.setAttribute("aria-label", "项目合成树");
  compositionTree.innerHTML = `<div class="ttv-composition-tree-head"><span>项目合成树</span><span>未载入</span></div>`;

  const timelineDock = document.createElement("section");
  timelineDock.className = "ttv-native-timeline-dock";
  timelineDock.setAttribute("aria-label", "片段条");
  document.body.appendChild(timelineDock);

  const g = (selector) => generatorPanel.querySelector(selector);
  const w = (selector) => workbar.querySelector(selector);

  compositionTree.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const sceneNode = target.closest("[data-scene-node]");
      const compNode = target.closest("[data-comp-node]");
      if (!sceneNode && !compNode) return;
      event.preventDefault();
      event.stopPropagation();
      if (sceneNode) {
        openProjectSceneFromTree(sceneNode.dataset.sceneNode || "").catch((error) => setStatus(error.message || String(error)));
        return;
      }
      openProjectCompositionFromTree().catch((error) => setStatus(error.message || String(error)));
    },
    { capture: true },
  );

  function setGeneratorOpen(open) {
    generatorPanel.classList.toggle("open", open);
    document.body.classList.toggle("ttv-generator-open", open);
    localStorage.setItem(generatorPanelStorageKey, open ? "open" : "closed");
  }

  generatorLauncher.onclick = () => setGeneratorOpen(true);
  g("#ttv-close-generator").onclick = () => setGeneratorOpen(false);
  setGeneratorOpen(localStorage.getItem(generatorPanelStorageKey) !== "closed");

  w("#ttv-project-toggle").onclick = async () => {
    state.projectMenuOpen = !state.projectMenuOpen;
    if (state.projectMenuOpen) {
      await loadProjects().catch((error) => setStatus(error.message || String(error)));
    }
    renderWorkbar();
  };
  w("#ttv-create-project").onclick = () => createProject().catch((error) => setStatus(error.message || String(error)));
  w("#ttv-quick-create").onclick = () => createProject().catch((error) => setStatus(error.message || String(error)));
  w("#ttv-reload-projects").onclick = () => loadProjects().catch((error) => setStatus(error.message || String(error)));
  w("#ttv-workbar-export").onclick = () => exportCurrentProject().catch((error) => setStatus(error.message || String(error)));
  w("#ttv-workbar-compact").onclick = () => {
    state.workbarCollapsed = !state.workbarCollapsed;
    localStorage.setItem(workbarStorageKey, state.workbarCollapsed ? "collapsed" : "expanded");
    renderWorkbar();
  };
  document.addEventListener("click", (event) => {
    if (!workbar.contains(event.target) && state.projectMenuOpen) {
      state.projectMenuOpen = false;
      renderWorkbar();
    }
  });

  function setStatus(text) {
    g("#ttv-status").textContent = text;
    persistProgress();
  }

  function setLog(text) {
    g("#ttv-log").textContent = text || "等待日志。";
    g("#ttv-log").scrollTop = g("#ttv-log").scrollHeight;
    persistProgress();
  }

  function persistProgress() {
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({
        status: g("#ttv-status").textContent,
        log: g("#ttv-log").textContent,
        at: Date.now(),
      }),
    );
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressStorageKey) || "null");
      if (!saved) return;
      if (saved.status) g("#ttv-status").textContent = saved.status;
      if (saved.log) g("#ttv-log").textContent = saved.log;
    } catch {
      localStorage.removeItem(progressStorageKey);
    }
  }

  function translateValue(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return value;
    return studioTextMap.get(trimmed) || value;
  }

  function translateStudioUi() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (generatorPanel.contains(node.parentElement) || compositionTree.contains(node.parentElement)) continue;
      const next = translateValue(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    for (const element of document.querySelectorAll("input, textarea, button, [aria-label], [title]")) {
      if (generatorPanel.contains(element) || compositionTree.contains(element)) continue;
      if (element.placeholder) element.placeholder = translateValue(element.placeholder);
      if (element.getAttribute("aria-label")) element.setAttribute("aria-label", translateValue(element.getAttribute("aria-label")));
      if (element.getAttribute("title")) element.setAttribute("title", translateValue(element.getAttribute("title")));
      if (element.value && element.tagName === "INPUT") element.value = translateValue(element.value);
    }
  }

  function findExplorerTabs() {
    for (const el of document.querySelectorAll("div")) {
      const buttons = Array.from(el.children).filter((child) => child.getAttribute("role") === "button");
      if (buttons.length < 2) continue;
      const labels = buttons.map((button) => normalize(button.textContent));
      const hasCompositions = labels.some((label) => label.includes("compositions") || label.includes("合成列表"));
      const hasAssets = labels.some((label) => label.includes("assets") || label.includes("素材"));
      if (hasCompositions && hasAssets) {
        return el;
      }
    }
    return null;
  }

  function findHelpMenuItem() {
    const candidates = Array.from(document.querySelectorAll("button, a, div, span")).filter((el) => {
      if (workbar.contains(el) || generatorPanel.contains(el) || timelineDock.contains(el) || compositionTree.contains(el)) return false;
      return normalize(el.textContent) === "help" || normalize(el.textContent) === "帮助";
    });
    return candidates.find((el) => {
      const parentText = normalize(el.parentElement?.textContent || "");
      return parentText.includes("file") && parentText.includes("view") && parentText.includes("help");
    }) || candidates[0] || null;
  }

  function ensureWorkbarDocked() {
    const help = findHelpMenuItem();
    if (!help?.parentElement) {
      if (workbar.parentElement !== document.body) document.body.appendChild(workbar);
      workbar.classList.remove("docked");
      workbar.classList.add("floating");
      return;
    }
    const host = help.parentElement;
    if (workbar.parentElement !== host || help.nextElementSibling !== workbar) {
      help.insertAdjacentElement("afterend", workbar);
    }
    workbar.classList.add("docked");
    workbar.classList.remove("floating");
  }

  function findNativeRenderButton() {
    const candidates = Array.from(document.querySelectorAll("button, [role='button']")).filter((el) => {
      if (workbar.contains(el) || generatorLauncher.contains(el) || generatorPanel.contains(el) || timelineDock.contains(el) || compositionTree.contains(el)) return false;
      const text = normalize(el.textContent);
      return text === "render" || text === "渲染";
    });
    return candidates.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || candidates[0] || null;
  }

  function ensureGeneratorLauncherDocked() {
    const renderButton = findNativeRenderButton();
    if (!renderButton?.parentElement) {
      if (generatorLauncher.parentElement !== document.body) document.body.appendChild(generatorLauncher);
      generatorLauncher.classList.remove("docked");
      generatorLauncher.classList.add("floating");
      return;
    }
    if (generatorLauncher.parentElement !== renderButton.parentElement || renderButton.nextElementSibling !== generatorLauncher) {
      renderButton.insertAdjacentElement("afterend", generatorLauncher);
    }
    generatorLauncher.classList.add("docked");
    generatorLauncher.classList.remove("floating");
  }

  function findNativeTimelinePanel() {
    const horizontalScrollbar = document.querySelector(".__remotion-horizontal-scrollbar");
    if (horizontalScrollbar?.parentElement) {
      const rect = horizontalScrollbar.getBoundingClientRect();
      if (rect.width > Math.min(520, window.innerWidth * 0.45) && rect.height > 0 && rect.top > window.innerHeight * 0.42) {
        return horizontalScrollbar.parentElement;
      }
    }

    const verticalScrollbar = document.querySelector(".__remotion-vertical-scrollbar");
    if (verticalScrollbar) {
      const rect = verticalScrollbar.getBoundingClientRect();
      if (rect.width > Math.min(520, window.innerWidth * 0.45) && rect.height > 0 && rect.top > window.innerHeight * 0.42) {
        return verticalScrollbar;
      }
    }

    const labels = Array.from(document.querySelectorAll("button, [role='button'], div, span")).filter((el) => {
      if (workbar.contains(el) || generatorPanel.contains(el) || timelineDock.contains(el) || compositionTree.contains(el)) return false;
      const text = normalize(el.textContent);
      if (text !== "timeline" && text !== "时间线") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top > window.innerHeight * 0.45;
    });
    for (const label of labels) {
      let node = label.parentElement;
      for (let depth = 0; node && depth < 7; depth += 1) {
        const rect = node.getBoundingClientRect();
        if (rect.width > Math.min(520, window.innerWidth * 0.45) && rect.top > window.innerHeight * 0.42) {
          return node;
        }
        node = node.parentElement;
      }
    }
    return null;
  }

  function ensureTimelineDocked() {
    if (!state.project) {
      timelineDock.classList.remove("open", "docked", "floating");
      timelineDock.innerHTML = "";
      return;
    }
    const nativeTimeline = findNativeTimelinePanel();
    if (!nativeTimeline) {
      if (timelineDock.parentElement !== document.body) document.body.appendChild(timelineDock);
      timelineDock.classList.add("open", "floating");
      timelineDock.classList.remove("docked");
      return;
    }
    if (timelineDock.parentElement !== nativeTimeline) {
      nativeTimeline.appendChild(timelineDock);
    }
    timelineDock.classList.add("open", "docked");
    timelineDock.classList.remove("floating");
  }

  function ensureCompositionTreeDocked() {
    const listHost = findCompositionListHost();
    if (!listHost) {
      compositionTree.classList.remove("open");
      return;
    }
    const multiSceneRow = Array.from(listHost.querySelectorAll(".__remotion-composition"))
      .find((item) => item.getAttribute("data-compname") === "MultiSceneVideo");
    if (compositionTree.parentElement !== listHost) {
      if (multiSceneRow?.parentElement === listHost) {
        multiSceneRow.insertAdjacentElement("afterend", compositionTree);
      } else {
        listHost.insertBefore(compositionTree, listHost.firstChild);
      }
    } else if (multiSceneRow?.nextElementSibling !== compositionTree && multiSceneRow.parentElement === listHost) {
      multiSceneRow.insertAdjacentElement("afterend", compositionTree);
    }
    renderCompositionTree(false);
  }

  function findCompositionListHost() {
    const compositionRows = Array.from(document.querySelectorAll(".__remotion-composition"));
    if (!compositionRows.length) return null;
    const visibleRows = compositionRows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !compositionTree.contains(row);
    });
    const row = visibleRows.find((item) => item.getAttribute("data-compname") === "MultiSceneVideo") || visibleRows[0];
    let node = row?.parentElement || null;
    while (node && node !== document.body) {
      const rowsInside = node.querySelectorAll(".__remotion-composition").length;
      const rect = node.getBoundingClientRect();
      if (rowsInside >= Math.min(3, visibleRows.length) && rect.height > 80) {
        return node;
      }
      node = node.parentElement;
    }
    return row?.parentElement || null;
  }

  function renderCompositionTree(force = true) {
    const project = state.project;
    if (!project) {
      if (!force && state.compositionTreeKey === "empty") return;
      state.compositionTreeKey = "empty";
      compositionTree.classList.remove("open");
      compositionTree.innerHTML = `<div class="ttv-composition-tree-head"><span>项目合成树</span><span>未载入</span></div>`;
      return;
    }
    const segments = projectSegments(project);
    const durationMs = Math.max(Number(project.durationMs || 0), ...segments.map((segment) => Number(segment.endMs || 0)), 0);
    const key = [
      project.id || "",
      project.updatedAt || "",
      state.selectedSceneId || "",
      segments.length,
      ...segments.map((segment) => `${segment.id}:${segment.startMs}:${segment.endMs}:${segment.visual?.templateId || segment.visual?.materialId || ""}:${segment.status || ""}`),
    ].join("|");
    if (!force && state.compositionTreeKey === key) {
      compositionTree.classList.add("open");
      return;
    }
    state.compositionTreeKey = key;
    compositionTree.classList.add("open");
    compositionTree.innerHTML = `
      <div class="ttv-composition-tree-head">
        <span>项目合成树</span>
        <span>${segments.length} 片段</span>
      </div>
      <div class="ttv-composition-tree-body">
        <button class="ttv-comp-node" data-comp-node="MultiSceneVideo" type="button">
          ▾ MultiSceneVideo
          <div class="ttv-node-meta">${escapeHtml(project.title || "当前项目")} · ${Math.round(durationMs / 100) / 10}s</div>
        </button>
        ${segments.map((segment, index) => renderCompositionTreeScene(segment, index)).join("")}
      </div>
    `;
  }

  function renderCompositionTreeScene(segment, index) {
    const active = segment.id === state.selectedSceneId;
    const visualSource = segment.visual?.providerType || segment.visual?.source || "template";
    const title = String(segment.visual?.templateId || segment.visual?.materialId || segment.sceneType || "片段");
    const text = String(segment.subtitleText || segment.text || title).replace(/\s+/g, " ").trim();
    return `
      <button class="ttv-scene-node ${active ? "active" : ""}" data-scene-node="${escapeHtml(segment.id)}" type="button">
        ${String(index + 1).padStart(2, "0")} ${escapeHtml(text.slice(0, 34) || title)}
        <div class="ttv-node-meta">${escapeHtml(title)} · ${Math.round(Number(segment.durationMs || 0) / 100) / 10}s · ${escapeHtml(visualSource)}</div>
      </button>
    `;
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function ensureDocked() {
    ensureCompositionTreeDocked();
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.error || `HTTP ${res.status}`);
    return payload.data;
  }

  async function loadProjects() {
    state.projects = await fetchJson(`${API}/api/projects`);
    renderWorkbar();
    return state.projects;
  }

  function currentProjectMeta() {
    return state.projects.find((project) => project.id === state.project?.id) || null;
  }

  function renderWorkbar() {
    workbar.classList.toggle("compact", state.workbarCollapsed);
    const current = currentProjectMeta();
    const title = state.project?.title || current?.title || "未载入项目";
    w("#ttv-project-toggle").textContent = `${title} ▼`;
    w("#ttv-project-menu").classList.toggle("open", state.projectMenuOpen);
    w("#ttv-workbar-status").textContent = state.project?.id
      ? `${projectSegments().length || 0} 片段 · 自动保存`
      : "未载入项目";
    w("#ttv-workbar-compact").textContent = state.workbarCollapsed ? "展开" : "收纳";
    w("#ttv-project-list").innerHTML = state.projects.length
      ? state.projects
          .map(
            (project) => `
              <button class="ttv-project-item ${project.id === state.project?.id ? "active" : ""}" data-project="${escapeHtml(project.id)}" type="button">
                ${project.id === state.project?.id ? "✓ " : ""}${escapeHtml(project.title || "未命名项目")}
                <div class="ttv-project-meta">${project.sceneCount || 0} 片段 · ${formatTime(project.updatedAt)}</div>
              </button>
            `,
          )
          .join("")
      : `<div class="ttv-project-meta" style="padding:8px;">还没有项目。点“新建项目”或用右侧生成控制台生成。</div>`;
    for (const button of workbar.querySelectorAll("[data-project]")) {
      button.onclick = () => switchProject(button.dataset.project);
    }
    renderCompositionTree(false);
  }

  async function switchProject(projectId) {
    if (!projectId) return;
    state.projectMenuOpen = false;
    const project = await loadProject(projectId);
    if (project?.scenes?.length) {
      await applyProjectToStudioPreview(projectId);
    } else {
      setStatus("已切换到空项目。可以用右侧控制台生成内容，或继续选择已有项目。");
    }
  }

  async function createProject() {
    const title = window.prompt("新项目名称", "未命名视频项目") || "";
    const project = await fetchJson(`${API}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await loadProjects();
    await switchProject(project.id);
  }

  async function exportCurrentProject() {
    if (!state.project?.id) {
      setStatus("还没有可导出的项目。");
      return;
    }
    setStatus("正在总导出。");
    state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(state.project.id)}/export`, { method: "POST" });
    await loadProjects();
    setStatus("导出完成。");
    renderProject();
    renderWorkbar();
  }

  function selectedScene() {
    return state.project?.scenes.find((scene) => scene.id === state.selectedSceneId) || state.project?.scenes[0] || null;
  }

  function projectSegments(project = state.project) {
    const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
    const fromApi = Array.isArray(project?.segments) ? project.segments : [];
    return scenes.map((scene, index) => {
      const segment = fromApi.find((item) => item.id === scene.id) || {};
      const visual = segment.visual || {};
      return {
        ...segment,
        id: scene.id,
        order: Number(scene.order ?? segment.order ?? index),
        text: segment.text || scene.voiceText || scene.subtitle || "",
        subtitleText: segment.subtitleText || scene.subtitle || scene.voiceText || "",
        startMs: Number(segment.startMs ?? scene.startMs ?? 0),
        endMs: Number(segment.endMs ?? scene.endMs ?? 0),
        durationMs: Number(segment.durationMs ?? (Number(scene.endMs || 0) - Number(scene.startMs || 0))),
        visual: {
          source: visual.source || scene.providerType || scene.visualLayer?.providerType || (scene.visualLayer?.type === "footage" ? "footage" : "template"),
          templateId: visual.templateId || scene.templateId || scene.visualLayer?.templateId || "",
          materialId: visual.materialId || scene.visualLayer?.clipId || "",
          confidence: Number(visual.confidence || scene.visualLayer?.confidence || 0),
          reason: visual.reason || scene.visualLayer?.reason || scene.decisionReason || "",
          providerType: visual.providerType || scene.providerType || scene.visualLayer?.providerType || "",
        },
        semanticCard: segment.semanticCard || scene.semanticCard || {},
        visualContract: segment.visualContract || scene.visualContract || {},
        visualGrounding: segment.visualGrounding || scene.visualGrounding || {},
        visualCandidates: segment.visualCandidates || scene.visualCandidates || [],
        decisionTrace: segment.decisionTrace || scene.decisionTrace || {},
        status: segment.status || (!scene.visualLayer ? "missing_visual" : "ok"),
        locked: Boolean(scene.locked),
      };
    });
  }

  async function loadProject(projectId) {
    state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(projectId)}`);
    state.selectedSceneId = selectedScene()?.id || "";
    localStorage.setItem("ttv.lastProjectId", projectId);
    state.playheadMs = selectedScene()?.startMs || 0;
    renderProject();
    renderWorkbar();
    return state.project;
  }

  async function applyProjectToStudioPreview(projectId) {
    await fetchJson(`${API}/api/projects/${encodeURIComponent(projectId)}/studio-default-props`, {
      method: "POST",
    });
    clearStudioPropsOverride();
    setStatus("已写入 MultiSceneVideo defaultProps，正在切换到可编辑参数面板。");
    if (window.location.pathname !== "/MultiSceneVideo") {
      window.location.href = "/MultiSceneVideo";
    } else {
      window.location.reload();
    }
  }

  function restorePreviewAudioOverride() {
    clearStudioPropsOverride();
  }

  function clearStudioPropsOverride() {
    const key = `remotion_inputPropsOverride${window.location.origin}`;
    localStorage.removeItem(key);
  }

  function seekPreview(scene) {
    const frame = Math.max(0, Math.round((Number(scene.startMs || 0) / 1000) * 30));
    if (typeof window.remotion_setFrame === "function") {
      window.remotion_setFrame(frame, "MultiSceneVideo", 0);
      return;
    }
    seekPreviewViaFrameInput(frame);
  }

  function seekPreviewViaFrameInput(frame) {
    const eventInit = {
      key: "g",
      code: "KeyG",
      bubbles: true,
      cancelable: true,
    };
    document.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    window.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    window.setTimeout(() => {
      const input = document.activeElement;
      if (!(input instanceof HTMLInputElement)) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, String(frame));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", bubbles: true }));
      input.blur();
    }, 60);
  }

  async function openProjectCompositionFromTree() {
    if (!state.project?.id) return;
    await applyProjectToStudioPreview(state.project.id);
  }

  async function openProjectSceneFromTree(sceneId) {
    if (!state.project?.id || !sceneId) return;
    const scene = state.project.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    state.selectedSceneId = sceneId;
    state.playheadMs = Number(scene.startMs || 0);
    localStorage.setItem(pendingSceneStorageKey, sceneId);
    renderCompositionTree(false);
    if (window.location.pathname !== "/MultiSceneVideo") {
      await fetchJson(`${API}/api/projects/${encodeURIComponent(state.project.id)}/studio-default-props`, { method: "POST" });
      clearStudioPropsOverride();
      window.location.href = "/MultiSceneVideo";
      return;
    }
    localStorage.removeItem(pendingSceneStorageKey);
    seekPreview(scene);
  }

  function applyPendingSceneSelection() {
    const sceneId = localStorage.getItem(pendingSceneStorageKey);
    if (!sceneId || !state.project?.scenes?.length) return;
    const scene = state.project.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      localStorage.removeItem(pendingSceneStorageKey);
      return;
    }
    state.selectedSceneId = sceneId;
    state.playheadMs = Number(scene.startMs || 0);
    localStorage.removeItem(pendingSceneStorageKey);
    window.setTimeout(() => seekPreview(scene), 120);
  }

  function renderProject() {
    const project = state.project;
    if (!project) {
      g("#ttv-open-video").removeAttribute("href");
      renderSegmentStripDock();
      renderCompositionTree(false);
      return;
    }
    applyPendingSceneSelection();
    g("#ttv-open-video").href = project.videoUrl ? `${API}${project.videoUrl}` : "#";
    renderSegmentStripDock();
    renderCompositionTree(false);
  }

  function renderSegmentStripDock() {
    ensureTimelineDocked();
    if (!state.project) return;
    timelineDock.innerHTML = renderSegmentStrip(state.project);
    bindSegmentStrip(state.project);
  }

  function renderSegmentStrip(project) {
    const segments = projectSegments(project);
    const durationMs = Math.max(Number(project.durationMs || 0), ...segments.map((segment) => Number(segment.endMs || 0)));
    if (!durationMs) {
      return `<div class="ttv-segment-strip"></div>`;
    }
    return `
      <div class="ttv-segment-strip">
        <div class="ttv-segment-lane" data-segment-lane="true">
          ${segments.map((segment, index) => renderSegmentBlock(segment, index, durationMs)).join("")}
        </div>
      </div>
    `;
  }

  function renderSegmentBlock(segment, index, durationMs) {
    const left = clamp((Number(segment.startMs || 0) / durationMs) * 100, 0, 100);
    const width = Math.max(2, clamp((Number(segment.durationMs || 0) / durationMs) * 100, 0, 100 - left));
    const selected = segment.id === state.selectedSceneId;
    const dense = width < 7;
    const visualSource = segment.visual?.providerType || segment.visual?.source || "template";
    const sourceLabel = visualSource === "footage" ? "素材" : visualSource === "programmatic" ? "程序" : "模板";
    const label = `${String(index + 1).padStart(2, "0")} ${Math.round(Number(segment.durationMs || 0) / 100) / 10}s · ${sourceLabel}`;
    return `
      <div
        class="ttv-segment-block ${escapeHtml(visualSource)} ${escapeHtml(segment.status || "ok")} ${segment.locked ? "locked" : ""} ${selected ? "active" : ""} ${dense ? "dense" : ""}"
        data-segment="${escapeHtml(segment.id)}"
        draggable="${segment.locked ? "false" : "true"}"
        title="${escapeHtml(segment.subtitleText || segment.text || label)}"
        style="left:${left}%;width:${width}%"
      >
        ${dense ? "" : escapeHtml(label)}
      </div>
    `;
  }

  function bindSegmentStrip(project) {
    const strip = timelineDock.querySelector(".ttv-segment-strip");
    if (!strip) return;
    const segments = projectSegments(project);
    for (const el of strip.querySelectorAll("[data-segment]")) {
      el.onclick = (event) => {
        const sceneId = el.dataset.segment;
        if (!sceneId) return;
        const scene = project.scenes.find((item) => item.id === sceneId);
        if (!scene) return;
        state.selectedSceneId = sceneId;
        state.playheadMs = scene.startMs || 0;
        renderProject();
        seekPreview(scene);
      };
    }
    const lane = strip.querySelector("[data-segment-lane]");
    if (lane) {
      lane.ondragover = (event) => event.preventDefault();
      lane.ondrop = async (event) => {
        event.preventDefault();
        const dragged = state.timelineDragSceneId;
        if (!dragged) return;
        const rect = lane.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const scenes = [...project.scenes];
        const from = scenes.findIndex((scene) => scene.id === dragged);
        if (from < 0) return;
        const to = Math.max(0, Math.min(scenes.length - 1, Math.floor(ratio * segments.length)));
        const [item] = scenes.splice(from, 1);
        scenes.splice(to, 0, item);
        state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(project.id)}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneIds: scenes.map((scene) => scene.id) }),
        });
        state.timelineDragSceneId = "";
        await loadProjects();
        setStatus("片段顺序已更新。需要看画面时点“刷新 Studio 预览”。");
        renderProject();
      };
    }
    for (const block of strip.querySelectorAll(".ttv-segment-block")) {
      block.ondragstart = () => {
        state.timelineDragSceneId = block.dataset.segment || "";
      };
      block.ondragend = () => {
        state.timelineDragSceneId = "";
      };
    }
    if (lane) {
      lane.onclick = (event) => {
        if (event.target.closest("[data-segment]")) return;
        const rect = lane.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const index = Math.max(0, Math.min(segments.length - 1, Math.floor(ratio * segments.length)));
        const scene = project.scenes.find((item) => item.id === segments[index]?.id);
        if (scene) {
          state.selectedSceneId = scene.id;
          state.playheadMs = scene.startMs || 0;
          seekPreview(scene);
        }
        renderProject();
      };
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  }

  function formatTime(value) {
    const date = new Date(Number(value || 0));
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return "未知时间";
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  g("#ttv-mode").onchange = () => {
    const auto = g("#ttv-mode").value === "auto-scenes";
    g("#ttv-template").disabled = auto;
    g("#ttv-generate").textContent = auto ? "生成初版项目" : "生成单模板视频";
  };
  g("#ttv-mode").onchange();

  g("#ttv-generate").onclick = async () => {
    const text = g("#ttv-text").value.trim();
    if (!text) {
      setStatus("请输入文案。");
      return;
    }
    g("#ttv-generate").disabled = true;
    setStatus("提交任务中。");
    setLog("提交任务中，等待服务端返回任务 ID。");
    try {
      const data = await fetchJson(`${API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: g("#ttv-title").value.trim(),
          subtitle: g("#ttv-subtitle").value.trim(),
          instruction: g("#ttv-instruction").value.trim(),
          mode: g("#ttv-mode").value,
          template: g("#ttv-template").value,
          theme: g("#ttv-theme").value,
          skipSrt: g("#ttv-srt").value === "true",
        }),
      });
      state.jobId = data.id;
      await poll();
      state.timer = window.setInterval(poll, 2000);
    } catch (error) {
      g("#ttv-generate").disabled = false;
      setStatus(error.message || String(error));
    }
  };

  g("#ttv-preview").onclick = async () => {
    if (!state.project?.id) {
      setStatus("还没有可预览的项目。");
      return;
    }
    await applyProjectToStudioPreview(state.project.id);
  };

  async function poll() {
    if (!state.jobId) return;
    try {
      const job = await fetchJson(`${API}/api/jobs/${encodeURIComponent(state.jobId)}`);
      setStatus(job.error || job.progress || job.status);
      setLog((job.logs || []).join("\n") || "等待日志。");
      if (job.status === "succeeded") {
        window.clearInterval(state.timer);
        g("#ttv-generate").disabled = false;
        if (job.result?.projectId) {
          const project = await loadProject(job.result.projectId);
          await loadProjects().catch(() => {});
          if (project.scenes?.length) {
            await applyProjectToStudioPreview(job.result.projectId);
          } else {
            setStatus("单模板视频已生成；片段预览仅用于 MultiSceneVideo 项目。");
          }
        } else {
          setStatus("视频已生成，但没有项目数据。");
        }
      }
      if (job.status === "failed") {
        window.clearInterval(state.timer);
        g("#ttv-generate").disabled = false;
      }
    } catch (error) {
      window.clearInterval(state.timer);
      g("#ttv-generate").disabled = false;
      setStatus(error.message || String(error));
    }
  }

  restoreProgress();
  restorePreviewAudioOverride();
  translateStudioUi();
  ensureWorkbarDocked();
  ensureGeneratorLauncherDocked();
  ensureTimelineDocked();
  ensureDocked();
  renderWorkbar();
  renderProject();
  loadProjects().catch((error) => setStatus(error.message || String(error)));
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      translateStudioUi();
      ensureWorkbarDocked();
      ensureGeneratorLauncherDocked();
      ensureTimelineDocked();
      ensureDocked();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const lastProjectId = localStorage.getItem("ttv.lastProjectId");
  if (lastProjectId) {
    loadProject(lastProjectId).catch(() => localStorage.removeItem("ttv.lastProjectId"));
  }
})();
