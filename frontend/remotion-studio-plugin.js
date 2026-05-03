(function () {
  const API = "http://127.0.0.1:3037";
  const templates = [
    ["DocumentReveal", "历史文件揭示"],
    ["QuoteReveal", "引文揭示"],
    ["PortraitFocus", "人物身份卡"],
    ["ConceptDiagram", "概念关系图"],
    ["MetaphorVisual", "隐喻可视化"],
    ["FootageScene", "本地素材片段"],
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

  const storyboardPanelStorageKey = "ttv.storyboardPanel";
  const generatorPanelStorageKey = "ttv.generatorPanel";
  const progressStorageKey = "ttv.lastProgress";
  const workbarStorageKey = "ttv.workbar";

  if (localStorage.getItem("remotion.sidebarPanel") === "storyboard") {
    localStorage.setItem("remotion.sidebarPanel", "input-props");
  }

  const state = {
    storyboardOpen: localStorage.getItem(storyboardPanelStorageKey) === "storyboard",
    jobId: "",
    timer: 0,
    project: null,
    projects: [],
    selectedSceneId: "",
    candidates: [],
    workbarCollapsed: localStorage.getItem(workbarStorageKey) === "collapsed",
    projectMenuOpen: false,
    playheadMs: 0,
    timelineDragSceneId: "",
  };

  const style = document.createElement("style");
  style.textContent = `
    .ttv-workbar {
      position: fixed;
      top: 42px;
      left: clamp(84px, 22vw, 304px);
      right: 126px;
      z-index: 2147482999;
      height: 40px;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 0 10px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 13px;
      background: rgba(15,17,21,.94);
      color: #e5e7eb;
      box-shadow: 0 18px 50px rgba(0,0,0,.34);
      backdrop-filter: blur(14px);
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
      transition: height .16s ease, opacity .16s ease, left .16s ease, right .16s ease;
    }
    body.ttv-generator-open .ttv-workbar {
      right: 426px;
    }
    .ttv-workbar.compact {
      height: 30px;
      opacity: .86;
    }
    .ttv-workbar.compact:hover {
      height: 40px;
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
      font-size: 13px;
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
      max-width: 240px;
      min-width: 0;
      height: 30px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: #171b24;
      color: #f5f5f5;
      padding: 0 10px;
      font: 700 12px Inter, "Microsoft YaHei", system-ui, sans-serif;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ttv-project-menu {
      position: absolute;
      top: 38px;
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
    .ttv-workbar-button {
      height: 30px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: #171b24;
      color: #e5e7eb;
      padding: 0 10px;
      cursor: pointer;
      font: 750 12px Inter, "Microsoft YaHei", system-ui, sans-serif;
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
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ttv-side-tab {
      border: 0;
      flex: 1;
      height: 40px;
      padding: 4px 12px;
      background: #232323;
      color: #b8b8b8;
      font: 600 14px Inter, "Microsoft YaHei", system-ui, sans-serif;
      cursor: default;
      border-top: 2px solid transparent;
    }
    .ttv-side-tab.active {
      background: #171717;
      color: white;
      border-top-color: #0f62fe;
    }
    .ttv-storyboard-panel {
      display: none;
      height: 100%;
      min-height: 0;
      flex: 1;
      overflow: hidden;
      background: #171717;
      color: #f5f5f5;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-storyboard-panel.open { display: grid; grid-template-rows: auto 1fr; }
    .ttv-generator-launcher {
      position: fixed;
      top: 42px;
      right: 18px;
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
    .ttv-storyboard-panel .ttv-textarea { min-height: 76px; }
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
    .ttv-scene-list { display: grid; gap: 6px; }
    .ttv-project-shell {
      display: grid;
      gap: 10px;
      min-height: 0;
    }
    .ttv-scene-list.compact {
      padding-right: 2px;
    }
    .ttv-scene-editor {
      display: grid;
      gap: 10px;
      min-height: 0;
    }
    .ttv-scene {
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background: #202020;
      color: #d8d8d8;
      padding: 8px;
      text-align: left;
      cursor: pointer;
      font-size: 11px;
      line-height: 1.45;
    }
    .ttv-scene.active { border-color: rgba(15,98,254,.85); background: #1b2540; }
    .ttv-pill { color: #8f8f8f; font-size: 10px; margin-top: 4px; }
    .ttv-candidate {
      display: grid;
      gap: 4px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      padding: 8px;
      background: #202020;
      font-size: 11px;
    }
    .ttv-timeline {
      display: grid;
      gap: 7px;
      padding: 8px;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 10px;
      background: #121212;
    }
    .ttv-timeline-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: #aaa;
      font-size: 11px;
      font-weight: 750;
    }
    .ttv-timeline-head span:last-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .ttv-timebar {
      position: relative;
      height: 22px;
      border-radius: 6px;
      background: #1f1f1f;
      overflow: hidden;
      cursor: pointer;
    }
    .ttv-playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #4f8cff;
      box-shadow: 0 0 0 1px rgba(79,140,255,.25);
    }
    .ttv-track {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 6px;
      align-items: center;
    }
    .ttv-track-name {
      color: #858585;
      font-size: 10px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .ttv-track-lane {
      position: relative;
      height: 28px;
      border-radius: 6px;
      background: #1b1b1b;
      overflow: hidden;
    }
    .ttv-clip {
      position: absolute;
      top: 3px;
      height: 22px;
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 5px;
      padding: 0 5px;
      color: #e5e7eb;
      font-size: 10px;
      line-height: 20px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
    }
    .ttv-clip.scene { background: #22304a; border-color: #4f8cff; }
    .ttv-clip.material { background: #263347; border-color: #40506a; }
    .ttv-clip.subtitle { background: #332c18; border-color: #7c6a2a; }
    .ttv-clip.audio { background: #173326; border-color: #2d8a61; }
    .ttv-clip.selected { box-shadow: 0 0 0 2px rgba(79,140,255,.72); }
    .ttv-clip.dense {
      padding: 0;
      color: transparent;
    }
    .ttv-trim {
      position: absolute;
      top: 0;
      width: 6px;
      height: 100%;
      background: rgba(255,255,255,.16);
      cursor: ew-resize;
    }
    .ttv-trim.left { left: 0; }
    .ttv-trim.right { right: 0; }
    .ttv-storyboard-launcher {
      display: none;
      position: fixed;
      left: 12px;
      top: 84px;
      z-index: 2147483000;
      height: 32px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 8px;
      padding: 0 11px;
      background: #1f2937;
      color: white;
      font: 700 12px Inter, "Microsoft YaHei", system-ui, sans-serif;
      box-shadow: 0 14px 34px rgba(0,0,0,.28);
      cursor: pointer;
    }
    body.ttv-storyboard-undocked .ttv-storyboard-launcher { display: inline-flex; align-items: center; }
    body.ttv-storyboard-undocked .ttv-storyboard-panel.open {
      position: fixed;
      left: 12px;
      top: 122px;
      bottom: 18px;
      width: min(340px, calc(100vw - 24px));
      z-index: 2147483001;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      box-shadow: 0 24px 70px rgba(0,0,0,.46);
    }
    @media (max-width: 1180px) {
      .ttv-workbar {
        left: 252px;
      }
      body.ttv-generator-open .ttv-workbar {
        right: 374px;
      }
      .ttv-workbar-status {
        display: none;
      }
    }
    @media (max-width: 1060px) {
      .ttv-workbar {
        left: 252px;
        right: 118px;
      }
      body.ttv-generator-open .ttv-workbar {
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
      .ttv-workbar {
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
            <option value="auto-scenes">自动镜头</option>
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

  const storyboardLauncher = document.createElement("button");
  storyboardLauncher.className = "ttv-storyboard-launcher";
  storyboardLauncher.type = "button";
  storyboardLauncher.textContent = "分镜";
  storyboardLauncher.onclick = () => setStoryboardOpen(true);
  document.body.appendChild(storyboardLauncher);

  const storyboardPanel = document.createElement("section");
  storyboardPanel.className = "ttv-storyboard-panel";
  storyboardPanel.innerHTML = `
    <div class="ttv-head">
      <div class="ttv-title">分镜</div>
      <div class="ttv-sub">只编辑镜头、字幕和素材；生成控制台在右侧。</div>
    </div>
    <div class="ttv-body">
      <div id="ttv-project"></div>
    </div>
  `;

  const sideTab = document.createElement("button");
  sideTab.type = "button";
  sideTab.className = "ttv-side-tab";
  sideTab.textContent = "分镜";
  sideTab.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setStoryboardOpen(true);
  };

  const g = (selector) => generatorPanel.querySelector(selector);
  const s = (selector) => storyboardPanel.querySelector(selector);
  const w = (selector) => workbar.querySelector(selector);

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
      if (storyboardPanel.contains(node.parentElement) || generatorPanel.contains(node.parentElement)) continue;
      const next = translateValue(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    for (const element of document.querySelectorAll("input, textarea, button, [aria-label], [title]")) {
      if (storyboardPanel.contains(element) || generatorPanel.contains(element)) continue;
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

  function normalize(value) {
    return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function ensureDocked() {
    const tabs = findExplorerTabs();
    if (!tabs) {
      setStoryboardUndocked(true);
      return;
    }
    const root = tabs.parentElement?.parentElement;
    if (!root) {
      setStoryboardUndocked(true);
      return;
    }
    setStoryboardUndocked(false);
    if (!tabs.contains(sideTab)) {
      tabs.appendChild(sideTab);
    }
    if (!tabs.dataset.ttvBound) {
      tabs.dataset.ttvBound = "true";
      tabs.addEventListener("click", (event) => {
        if (!event.target.closest(".ttv-side-tab")) setStoryboardOpen(false);
      });
    }
    if (storyboardPanel.parentElement !== root) {
      root.appendChild(storyboardPanel);
    }
    syncStoryboardVisibility(root);
  }

  function setStoryboardUndocked(undocked) {
    document.body.classList.toggle("ttv-storyboard-undocked", undocked);
    if (undocked && storyboardPanel.parentElement !== document.body) {
      document.body.appendChild(storyboardPanel);
    }
    sideTab.classList.toggle("active", state.storyboardOpen);
    storyboardPanel.classList.toggle("open", state.storyboardOpen);
  }

  function syncStoryboardVisibility(root) {
    sideTab.classList.toggle("active", state.storyboardOpen);
    storyboardPanel.classList.toggle("open", state.storyboardOpen);
    for (const child of Array.from(root.children)) {
      if (child === storyboardPanel || child.contains(sideTab)) continue;
      child.style.display = state.storyboardOpen ? "none" : "";
    }
  }

  function setStoryboardOpen(open) {
    state.storyboardOpen = open;
    localStorage.setItem(storyboardPanelStorageKey, open ? "storyboard" : "native");
    ensureDocked();
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
      ? `${state.project.scenes?.length || 0} 镜头 · 自动保存`
      : "未载入项目";
    w("#ttv-workbar-compact").textContent = state.workbarCollapsed ? "展开" : "收纳";
    w("#ttv-project-list").innerHTML = state.projects.length
      ? state.projects
          .map(
            (project) => `
              <button class="ttv-project-item ${project.id === state.project?.id ? "active" : ""}" data-project="${escapeHtml(project.id)}" type="button">
                ${project.id === state.project?.id ? "✓ " : ""}${escapeHtml(project.title || "未命名项目")}
                <div class="ttv-project-meta">${project.sceneCount || 0} 镜头 · ${formatTime(project.updatedAt)}</div>
              </button>
            `,
          )
          .join("")
      : `<div class="ttv-project-meta" style="padding:8px;">还没有项目。点“新建项目”或用右侧生成控制台生成。</div>`;
    for (const button of workbar.querySelectorAll("[data-project]")) {
      button.onclick = () => switchProject(button.dataset.project);
    }
  }

  async function switchProject(projectId) {
    if (!projectId) return;
    state.projectMenuOpen = false;
    const project = await loadProject(projectId);
    if (project?.scenes?.length) {
      setStoryboardOpen(true);
      await applyProjectToStudioPreview(projectId);
    } else {
      setStatus("已切换到空项目。可以用右侧控制台生成内容，或继续选择已有项目。");
      setStoryboardOpen(true);
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
    const props = await fetchJson(`${API}/api/projects/${encodeURIComponent(projectId)}/props`);
    localStorage.setItem(`remotion_inputPropsOverride${window.location.origin}`, JSON.stringify(props));
    setStatus("已写入 Studio 预览参数，正在切换到 MultiSceneVideo。");
    if (window.location.pathname !== "/MultiSceneVideo") {
      window.location.href = "/MultiSceneVideo";
    } else {
      window.location.reload();
    }
  }

  function seekPreview(scene) {
    const frame = Math.max(0, Math.round((Number(scene.startMs || 0) / 1000) * 30));
    if (typeof window.remotion_setFrame === "function") {
      window.remotion_setFrame(frame, "MultiSceneVideo", 0);
    }
  }

  function renderProject() {
    const wrap = s("#ttv-project");
    const project = state.project;
    if (!project) {
      wrap.innerHTML = `<div class="ttv-status">还没有项目。先用右侧生成控制台生成初版视频。</div>`;
      g("#ttv-open-video").removeAttribute("href");
      return;
    }
    const scene = selectedScene();
    g("#ttv-open-video").href = project.videoUrl ? `${API}${project.videoUrl}` : "#";
    wrap.innerHTML = `
      <div class="ttv-project-shell">
        <div class="ttv-row-actions">
          <button class="ttv-button" id="ttv-new-draft" type="button">清空草稿</button>
          <button class="ttv-button" id="ttv-lock" type="button">${scene?.locked ? "解除锁定" : "锁定分镜"}</button>
        </div>
        <div class="ttv-scene-list compact">
          ${project.scenes
            .map(
              (item, index) => `
                <button class="ttv-scene ${item.id === state.selectedSceneId ? "active" : ""}" data-scene="${item.id}" type="button">
                  ${index + 1}. ${escapeHtml(item.subtitle || item.voiceText).slice(0, 70)}
                  <div class="ttv-pill">${escapeHtml(item.templateId)} · ${Math.round((item.endMs - item.startMs) / 100) / 10}s${item.locked ? " · 已锁定" : ""}</div>
                </button>
              `,
            )
            .join("")}
        </div>
        ${renderTimeline(project)}
        <div class="ttv-scene-editor">
          ${scene ? renderSceneEditor(scene) : ""}
        </div>
      </div>
    `;
    for (const button of wrap.querySelectorAll("[data-scene]")) {
      button.onclick = () => {
        state.selectedSceneId = button.dataset.scene;
        state.candidates = [];
        state.playheadMs = selectedScene()?.startMs || 0;
        renderProject();
        const next = selectedScene();
        if (next) seekPreview(next);
      };
    }
    s("#ttv-new-draft").onclick = () => {
      state.project = null;
      state.selectedSceneId = "";
      state.candidates = [];
      renderProject();
    };
    if (scene) bindSceneEditor(scene);
    bindTimeline(project);
  }

  function renderTimeline(project) {
    const tracks = project.tracks || [];
    const durationMs = Math.max(Number(project.durationMs || 0), ...tracks.flatMap((track) => track.clips.map((clip) => Number(clip.endMs || 0))));
    if (!durationMs) {
      return `<div class="ttv-timeline"><div class="ttv-status">时间线会在项目生成旁白和分镜后显示。</div></div>`;
    }
    const playheadLeft = clamp((state.playheadMs / durationMs) * 100, 0, 100);
    return `
      <div class="ttv-timeline">
        <div class="ttv-timeline-head">
          <span>剪辑时间线</span>
          <span>${Math.round(durationMs / 100) / 10}s · 拖镜头排序 / 拉边裁剪</span>
        </div>
        <div class="ttv-timebar" data-timebar="true">
          <div class="ttv-playhead" style="left:${playheadLeft}%"></div>
        </div>
        ${tracks
          .filter((track) => ["audio", "material", "scene", "subtitle"].includes(track.type))
          .map((track) => renderTrack(track, durationMs))
          .join("")}
      </div>
    `;
  }

  function renderTrack(track, durationMs) {
    return `
      <div class="ttv-track" data-track="${escapeHtml(track.id)}">
        <div class="ttv-track-name">${escapeHtml(track.name || track.type)}</div>
        <div class="ttv-track-lane" data-lane="${escapeHtml(track.id)}">
          ${track.clips.map((clip) => renderClip(clip, durationMs)).join("")}
        </div>
      </div>
    `;
  }

  function renderClip(clip, durationMs) {
    const left = clamp((Number(clip.startMs || 0) / durationMs) * 100, 0, 100);
    const width = Math.max(2, clamp(((Number(clip.endMs || 0) - Number(clip.startMs || 0)) / durationMs) * 100, 0, 100 - left));
    const sceneId = clip.sceneId || (clip.type === "scene" ? clip.id : "");
    const selected = sceneId && sceneId === state.selectedSceneId;
    const draggable = clip.type === "scene" && !clip.locked;
    const dense = width < 7;
    return `
      <div
        class="ttv-clip ${escapeHtml(clip.type)} ${selected ? "selected" : ""} ${dense ? "dense" : ""}"
        data-clip="${escapeHtml(clip.id)}"
        data-scene="${escapeHtml(sceneId)}"
        data-type="${escapeHtml(clip.type)}"
        draggable="${draggable ? "true" : "false"}"
        title="${escapeHtml(clip.title || clip.text || clip.type)}"
        style="left:${left}%;width:${width}%"
      >
        ${clip.type === "scene" && !clip.locked ? `<span class="ttv-trim left" data-trim="left" data-scene="${escapeHtml(sceneId)}"></span>` : ""}
        ${dense ? "" : escapeHtml(clip.title || clip.text || clip.type)}
        ${clip.type === "scene" && !clip.locked ? `<span class="ttv-trim right" data-trim="right" data-scene="${escapeHtml(sceneId)}"></span>` : ""}
      </div>
    `;
  }

  function bindTimeline(project) {
    const timeline = s(".ttv-timeline");
    if (!timeline) return;
    const durationMs = Math.max(Number(project.durationMs || 0), ...((project.tracks || []).flatMap((track) => track.clips.map((clip) => Number(clip.endMs || 0)))));
    for (const el of timeline.querySelectorAll("[data-scene]")) {
      el.onclick = (event) => {
        const trim = event.target.closest("[data-trim]");
        if (trim) return;
        const sceneId = el.dataset.scene;
        if (!sceneId) return;
        const scene = project.scenes.find((item) => item.id === sceneId);
        if (!scene) return;
        state.selectedSceneId = sceneId;
        state.playheadMs = scene.startMs || 0;
        state.candidates = [];
        renderProject();
        seekPreview(scene);
      };
    }
    for (const lane of timeline.querySelectorAll("[data-lane='scene']")) {
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
        const to = Math.max(0, Math.min(scenes.length - 1, Math.floor(ratio * scenes.length)));
        const [item] = scenes.splice(from, 1);
        scenes.splice(to, 0, item);
        state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(project.id)}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneIds: scenes.map((scene) => scene.id) }),
        });
        state.timelineDragSceneId = "";
        await loadProjects();
        setStatus("镜头顺序已更新。需要看画面时点“刷新 Studio 预览”。");
        renderProject();
      };
    }
    for (const clip of timeline.querySelectorAll(".ttv-clip.scene")) {
      clip.ondragstart = () => {
        state.timelineDragSceneId = clip.dataset.scene || "";
      };
      clip.ondragend = () => {
        state.timelineDragSceneId = "";
      };
    }
    const timebar = timeline.querySelector("[data-timebar]");
    if (timebar) {
      timebar.onclick = (event) => {
        const rect = timebar.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        state.playheadMs = ratio * durationMs;
        const scene = project.scenes.find((item) => state.playheadMs >= item.startMs && state.playheadMs <= item.endMs);
        if (scene) {
          state.selectedSceneId = scene.id;
          seekPreview(scene);
        }
        renderProject();
      };
    }
    for (const trim of timeline.querySelectorAll("[data-trim]")) {
      trim.onmousedown = (event) => startTrim(event, project, trim.dataset.scene, trim.dataset.trim);
    }
  }

  function startTrim(event, project, sceneId, side) {
    event.preventDefault();
    event.stopPropagation();
    const scene = project.scenes.find((item) => item.id === sceneId);
    if (!scene || scene.locked) return;
    const lane = event.currentTarget.closest(".ttv-track-lane");
    const rect = lane.getBoundingClientRect();
    const durationMs = Math.max(Number(project.durationMs || 0), ...((project.tracks || []).flatMap((track) => track.clips.map((clip) => Number(clip.endMs || 0)))));
    const onMove = (moveEvent) => {
      const ratio = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
      const nextMs = Math.round(ratio * durationMs);
      state.playheadMs = nextMs;
      if (side === "left") {
        s("#ttv-start-ms").value = Math.min(nextMs, Number(s("#ttv-end-ms").value) - 300);
      } else {
        s("#ttv-end-ms").value = Math.max(nextMs, Number(s("#ttv-start-ms").value) + 300);
      }
    };
    const onUp = async () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const patch = {
        startMs: Number(s("#ttv-start-ms").value),
        endMs: Number(s("#ttv-end-ms").value),
      };
      state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(scene.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      await loadProjects();
      setStatus("片段裁剪已保存。需要看画面时点“刷新 Studio 预览”。");
      renderProject();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function renderSceneEditor(scene) {
    return `
      <label class="ttv-label">旁白 / 字幕
        <textarea class="ttv-textarea" id="ttv-scene-text">${escapeHtml(scene.voiceText || "")}</textarea>
      </label>
      <label class="ttv-label">视觉意图
        <textarea class="ttv-textarea" id="ttv-visual-intent">${escapeHtml(scene.visualIntent || "")}</textarea>
      </label>
      <div class="ttv-grid">
        <label class="ttv-label">模板
          <select class="ttv-select" id="ttv-scene-template">
            ${templates.map(([id, label]) => `<option value="${id}" ${scene.templateId === id ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="ttv-label">类型
          <input class="ttv-input" id="ttv-scene-type" value="${escapeHtml(scene.sceneType || "")}" />
        </label>
      </div>
      <div class="ttv-grid">
        <label class="ttv-label">开始 ms
          <input class="ttv-input" id="ttv-start-ms" type="number" value="${Number(scene.startMs || 0)}" />
        </label>
        <label class="ttv-label">结束 ms
          <input class="ttv-input" id="ttv-end-ms" type="number" value="${Number(scene.endMs || 0)}" />
        </label>
      </div>
      <div class="ttv-grid">
        <button class="ttv-button primary" id="ttv-save-scene" type="button">保存分镜</button>
        <button class="ttv-button" id="ttv-rematch" type="button">重配素材</button>
      </div>
      <div id="ttv-candidates">${renderCandidates()}</div>
    `;
  }

  function renderCandidates() {
    if (!state.candidates.length) return "";
    return state.candidates
      .map(
        (item) => `
          <div class="ttv-candidate">
            <strong>${escapeHtml(item.title || item.id)}</strong>
            <span>${escapeHtml(item.reason || "")} · score ${item.score}</span>
            <button class="ttv-button" data-candidate="${escapeHtml(item.id)}" type="button">替换为此素材</button>
          </div>
        `,
      )
      .join("");
  }

  function bindSceneEditor(scene) {
    s("#ttv-save-scene").onclick = async () => {
      const patch = {
        voiceText: s("#ttv-scene-text").value,
        subtitle: s("#ttv-scene-text").value,
        visualIntent: s("#ttv-visual-intent").value,
        templateId: s("#ttv-scene-template").value,
        sceneType: s("#ttv-scene-type").value,
        startMs: Number(s("#ttv-start-ms").value),
        endMs: Number(s("#ttv-end-ms").value),
        props: { body: s("#ttv-scene-text").value },
      };
      state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      setStatus("分镜已保存。需要看画面时点“刷新 Studio 预览”。");
      renderProject();
    };
    s("#ttv-lock").onclick = async () => {
      state.project = await fetchJson(
        `${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}/lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: !scene.locked }),
        },
      );
      renderProject();
    };
    s("#ttv-rematch").onclick = async () => {
      const data = await fetchJson(
        `${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}/rematch-material`,
        { method: "POST" },
      );
      state.candidates = data.candidates || [];
      renderProject();
    };
    for (const button of storyboardPanel.querySelectorAll("[data-candidate]")) {
      button.onclick = async () => {
        const candidate = state.candidates.find((item) => item.id === button.dataset.candidate);
        if (!candidate) return;
        state.project = await fetchJson(
          `${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}/replace-material`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate }),
          },
        );
        setStatus("素材已替换。");
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
            setStoryboardOpen(true);
            await applyProjectToStudioPreview(job.result.projectId);
          } else {
            setStatus("单模板视频已生成；自动分镜预览仅用于 MultiSceneVideo 项目。");
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
  translateStudioUi();
  ensureDocked();
  renderWorkbar();
  renderProject();
  loadProjects().catch((error) => setStatus(error.message || String(error)));
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      translateStudioUi();
      ensureDocked();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const lastProjectId = localStorage.getItem("ttv.lastProjectId");
  if (lastProjectId) {
    loadProject(lastProjectId).catch(() => localStorage.removeItem("ttv.lastProjectId"));
  }
})();
