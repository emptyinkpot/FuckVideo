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

  const state = {
    activePanel: localStorage.getItem("remotion.sidebarPanel") === "storyboard" ? "storyboard" : "native",
    jobId: "",
    timer: 0,
    project: null,
    selectedSceneId: "",
    candidates: [],
  };

  const style = document.createElement("style");
  style.textContent = `
    .ttv-panel {
      display: none;
      height: 100%;
      min-height: 0;
      flex: 1;
      overflow: hidden;
      background: #171717;
      color: #f5f5f5;
      font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-panel.open { display: grid; grid-template-rows: auto 1fr auto; }
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
    .ttv-head {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.1);
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
      min-height: 86px;
      resize: vertical;
      padding: 8px 10px;
      line-height: 1.55;
    }
    .ttv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ttv-row { display: flex; gap: 8px; align-items: center; }
    .ttv-actions {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.1);
      display: grid;
      gap: 8px;
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
      max-height: 120px;
      overflow: auto;
      white-space: pre-wrap;
      margin: 0;
      color: #909090;
      font: 10px/1.5 Consolas, monospace;
    }
    .ttv-scene-list { display: grid; gap: 6px; }
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
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.className = "ttv-panel";
  panel.innerHTML = `
    <div class="ttv-head">
      <div class="ttv-title">自动分镜工作台</div>
      <div class="ttv-sub">嵌入 Remotion 右侧栏；中央区域继续使用 Studio 原生预览。</div>
    </div>
    <div class="ttv-body">
      <div id="ttv-generator">
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
      </div>
      <div class="ttv-status" id="ttv-status">生成后会自动加载到 MultiSceneVideo，使用现有 Remotion 预览屏幕查看。</div>
      <pre class="ttv-log" id="ttv-log">等待任务。</pre>
      <div id="ttv-project"></div>
    </div>
    <div class="ttv-actions">
      <button class="ttv-button primary" id="ttv-generate" type="button">生成初版项目</button>
      <div class="ttv-grid">
        <button class="ttv-button" id="ttv-preview" type="button">刷新 Studio 预览</button>
        <button class="ttv-button" id="ttv-export" type="button">总导出</button>
      </div>
      <a class="ttv-button" id="ttv-open-video" target="_blank" rel="noreferrer">打开当前成片</a>
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

  const $ = (selector) => panel.querySelector(selector);

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
      if (panel.contains(node.parentElement)) continue;
      const next = translateValue(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    for (const element of document.querySelectorAll("input, textarea, button, [aria-label], [title]")) {
      if (panel.contains(element)) continue;
      if (element.placeholder) element.placeholder = translateValue(element.placeholder);
      if (element.getAttribute("aria-label")) element.setAttribute("aria-label", translateValue(element.getAttribute("aria-label")));
      if (element.getAttribute("title")) element.setAttribute("title", translateValue(element.getAttribute("title")));
      if (element.value && element.tagName === "INPUT") element.value = translateValue(element.value);
    }
  }

  function findOptionsTabs() {
    for (const el of document.querySelectorAll("div")) {
      const buttons = Array.from(el.children).filter((child) => child.getAttribute("role") === "button");
      if (buttons.length < 2) continue;
      const labels = buttons.map((button) => normalize(button.textContent));
      if (labels.includes("参数") && labels.some((label) => label.includes("渲染") || label.includes("render"))) {
        return el;
      }
    }
    return null;
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function ensureDocked() {
    const tabs = findOptionsTabs();
    if (!tabs) return;
    const root = tabs.parentElement?.parentElement;
    if (!root) return;
    if (!tabs.contains(sideTab)) {
      tabs.appendChild(sideTab);
    }
    if (!tabs.dataset.ttvBound) {
      tabs.dataset.ttvBound = "true";
      tabs.addEventListener("click", (event) => {
        if (!event.target.closest(".ttv-side-tab")) setStoryboardOpen(false);
      });
    }
    if (panel.parentElement !== root) {
      root.appendChild(panel);
    }
    syncPanelVisibility(root);
  }

  function syncPanelVisibility(root) {
    const open = state.activePanel === "storyboard";
    sideTab.classList.toggle("active", open);
    panel.classList.toggle("open", open);
    for (const child of Array.from(root.children)) {
      if (child === panel || child.contains(sideTab)) continue;
      child.style.display = open ? "none" : "";
    }
  }

  function setStoryboardOpen(open) {
    state.activePanel = open ? "storyboard" : "native";
    localStorage.setItem("remotion.sidebarPanel", open ? "storyboard" : "input-props");
    ensureDocked();
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.error || `HTTP ${res.status}`);
    return payload.data;
  }

  function selectedScene() {
    return state.project?.scenes.find((scene) => scene.id === state.selectedSceneId) || state.project?.scenes[0] || null;
  }

  async function loadProject(projectId) {
    state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(projectId)}`);
    state.selectedSceneId = selectedScene()?.id || "";
    localStorage.setItem("ttv.lastProjectId", projectId);
    renderProject();
    return state.project;
  }

  async function applyProjectToStudioPreview(projectId) {
    const props = await fetchJson(`${API}/api/projects/${encodeURIComponent(projectId)}/props`);
    localStorage.setItem(`remotion_inputPropsOverride${window.location.origin}`, JSON.stringify(props));
    $("#ttv-status").textContent = "已写入 Studio 预览参数，正在切换到 MultiSceneVideo。";
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
    const wrap = $("#ttv-project");
    const project = state.project;
    if (!project) {
      wrap.innerHTML = "";
      $("#ttv-open-video").removeAttribute("href");
      return;
    }
    const scene = selectedScene();
    $("#ttv-open-video").href = project.videoUrl ? `${API}${project.videoUrl}` : "#";
    wrap.innerHTML = `
      <div class="ttv-row">
        <button class="ttv-button" id="ttv-new-draft" type="button">新建草稿</button>
        <button class="ttv-button" id="ttv-lock" type="button">${scene?.locked ? "解除锁定" : "锁定分镜"}</button>
      </div>
      <div class="ttv-scene-list">
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
      ${scene ? renderSceneEditor(scene) : ""}
    `;
    for (const button of wrap.querySelectorAll("[data-scene]")) {
      button.onclick = () => {
        state.selectedSceneId = button.dataset.scene;
        state.candidates = [];
        renderProject();
        const next = selectedScene();
        if (next) seekPreview(next);
      };
    }
    $("#ttv-new-draft").onclick = () => {
      state.project = null;
      state.selectedSceneId = "";
      state.candidates = [];
      renderProject();
    };
    if (scene) bindSceneEditor(scene);
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
    $("#ttv-save-scene").onclick = async () => {
      const patch = {
        voiceText: $("#ttv-scene-text").value,
        subtitle: $("#ttv-scene-text").value,
        visualIntent: $("#ttv-visual-intent").value,
        templateId: $("#ttv-scene-template").value,
        sceneType: $("#ttv-scene-type").value,
        startMs: Number($("#ttv-start-ms").value),
        endMs: Number($("#ttv-end-ms").value),
        props: { body: $("#ttv-scene-text").value },
      };
      state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      $("#ttv-status").textContent = "分镜已保存。需要看画面时点“刷新 Studio 预览”。";
      renderProject();
    };
    $("#ttv-lock").onclick = async () => {
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
    $("#ttv-rematch").onclick = async () => {
      const data = await fetchJson(
        `${API}/api/projects/${encodeURIComponent(state.project.id)}/scenes/${encodeURIComponent(scene.id)}/rematch-material`,
        { method: "POST" },
      );
      state.candidates = data.candidates || [];
      renderProject();
    };
    for (const button of panel.querySelectorAll("[data-candidate]")) {
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
        $("#ttv-status").textContent = "素材已替换。";
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

  $("#ttv-mode").onchange = () => {
    const auto = $("#ttv-mode").value === "auto-scenes";
    $("#ttv-template").disabled = auto;
    $("#ttv-generate").textContent = auto ? "生成初版项目" : "生成单模板视频";
  };
  $("#ttv-mode").onchange();

  $("#ttv-generate").onclick = async () => {
    const text = $("#ttv-text").value.trim();
    if (!text) {
      $("#ttv-status").textContent = "请输入文案。";
      return;
    }
    $("#ttv-generate").disabled = true;
    $("#ttv-status").textContent = "提交任务中。";
    $("#ttv-log").textContent = "";
    try {
      const data = await fetchJson(`${API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: $("#ttv-title").value.trim(),
          subtitle: $("#ttv-subtitle").value.trim(),
          instruction: $("#ttv-instruction").value.trim(),
          mode: $("#ttv-mode").value,
          template: $("#ttv-template").value,
          theme: $("#ttv-theme").value,
          skipSrt: $("#ttv-srt").value === "true",
        }),
      });
      state.jobId = data.id;
      await poll();
      state.timer = window.setInterval(poll, 2000);
    } catch (error) {
      $("#ttv-generate").disabled = false;
      $("#ttv-status").textContent = error.message || String(error);
    }
  };

  $("#ttv-preview").onclick = async () => {
    if (!state.project?.id) {
      $("#ttv-status").textContent = "还没有可预览的项目。";
      return;
    }
    await applyProjectToStudioPreview(state.project.id);
  };

  $("#ttv-export").onclick = async () => {
    if (!state.project?.id) {
      $("#ttv-status").textContent = "还没有可导出的项目。";
      return;
    }
    $("#ttv-status").textContent = "正在总导出。";
    state.project = await fetchJson(`${API}/api/projects/${encodeURIComponent(state.project.id)}/export`, { method: "POST" });
    $("#ttv-status").textContent = "导出完成。";
    renderProject();
  };

  async function poll() {
    if (!state.jobId) return;
    try {
      const job = await fetchJson(`${API}/api/jobs/${encodeURIComponent(state.jobId)}`);
      $("#ttv-status").textContent = job.error || job.progress || job.status;
      $("#ttv-log").textContent = (job.logs || []).join("\n") || "等待日志。";
      $("#ttv-log").scrollTop = $("#ttv-log").scrollHeight;
      if (job.status === "succeeded") {
        window.clearInterval(state.timer);
        $("#ttv-generate").disabled = false;
        if (job.result?.projectId) {
          const project = await loadProject(job.result.projectId);
          if (project.scenes?.length) {
            await applyProjectToStudioPreview(job.result.projectId);
          } else {
            $("#ttv-status").textContent = "单模板视频已生成；自动分镜预览仅用于 MultiSceneVideo 项目。";
          }
        } else {
          $("#ttv-status").textContent = "视频已生成，但没有项目数据。";
        }
      }
      if (job.status === "failed") {
        window.clearInterval(state.timer);
        $("#ttv-generate").disabled = false;
      }
    } catch (error) {
      window.clearInterval(state.timer);
      $("#ttv-generate").disabled = false;
      $("#ttv-status").textContent = error.message || String(error);
    }
  }

  translateStudioUi();
  ensureDocked();
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
