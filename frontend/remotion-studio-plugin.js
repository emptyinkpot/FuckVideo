(function () {
  const API = "http://127.0.0.1:3037";
  const templates = [
    ["DocumentReveal", "历史文件揭示"],
    ["QuoteReveal", "引文揭示"],
    ["PortraitFocus", "人物身份卡"],
    ["ConceptDiagram", "概念关系图"],
    ["MetaphorVisual", "隐喻可视化"],
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

  if (window.__textToVideoPluginMounted) {
    return;
  }
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

  const translateValue = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return value;
    return studioTextMap.get(trimmed) || value;
  };

  const translateStudioUi = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      const next = translateValue(node.nodeValue);
      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
    }
    for (const element of document.querySelectorAll("input, textarea, button, [aria-label], [title]")) {
      if (element.placeholder) element.placeholder = translateValue(element.placeholder);
      if (element.getAttribute("aria-label")) {
        element.setAttribute("aria-label", translateValue(element.getAttribute("aria-label")));
      }
      if (element.getAttribute("title")) {
        element.setAttribute("title", translateValue(element.getAttribute("title")));
      }
      if (element.value && element.tagName === "INPUT") {
        element.value = translateValue(element.value);
      }
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    .ttv-launcher {
      position: fixed;
      top: 78px;
      right: 18px;
      z-index: 2147483000;
      height: 34px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 9px;
      padding: 0 12px;
      background: #0f62fe;
      color: white;
      font: 600 13px Inter, system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 14px 34px rgba(0,0,0,.28);
    }
    .ttv-panel {
      position: fixed;
      top: 58px;
      right: 18px;
      bottom: 18px;
      width: 390px;
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
    .ttv-panel.open { display: grid; }
    .ttv-head {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px 0 14px;
      border-bottom: 1px solid rgba(255,255,255,.1);
      font-size: 14px;
      font-weight: 700;
    }
    .ttv-close {
      border: 0;
      background: transparent;
      color: #aaa;
      cursor: pointer;
      font-size: 18px;
    }
    .ttv-body {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      display: grid;
      gap: 10px;
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
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      background: #232323;
      color: #fff;
      outline: none;
      padding: 0 10px;
      font: 13px Inter, "Microsoft YaHei", system-ui, sans-serif;
    }
    .ttv-input,
    .ttv-select { height: 34px; }
    .ttv-textarea {
      height: 150px;
      resize: vertical;
      padding: 9px 10px;
      line-height: 1.6;
    }
    .ttv-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ttv-actions {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.1);
      display: grid;
      gap: 8px;
    }
    .ttv-primary {
      height: 38px;
      border: 0;
      border-radius: 8px;
      background: #0f62fe;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    .ttv-primary:disabled {
      opacity: .58;
      cursor: not-allowed;
    }
    .ttv-status {
      min-height: 35px;
      padding: 9px 10px;
      border-radius: 8px;
      background: #222;
      color: #c7c7c7;
      font-size: 12px;
      line-height: 1.45;
    }
    .ttv-links {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ttv-links.show { display: grid; }
    .ttv-link {
      height: 32px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: white;
      text-decoration: none;
      background: #262626;
      font-size: 12px;
      font-weight: 650;
    }
    .ttv-log {
      max-height: 150px;
      overflow: auto;
      white-space: pre-wrap;
      margin: 0;
      color: #9f9f9f;
      font: 11px/1.5 Consolas, monospace;
    }
    .ttv-note {
      color: #8f8f8f;
      font-size: 11px;
      line-height: 1.45;
      margin-top: -2px;
    }
  `;
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.className = "ttv-launcher";
  launcher.type = "button";
  launcher.textContent = "生成视频";
  document.body.appendChild(launcher);

  const panel = document.createElement("aside");
  panel.className = "ttv-panel";
  panel.innerHTML = `
    <div class="ttv-head">
      <span>一站式生成视频</span>
      <button class="ttv-close" type="button">×</button>
    </div>
    <div class="ttv-body">
      <label class="ttv-label">文案
        <textarea class="ttv-textarea" id="ttv-text">旅顺港的海风吹进东京霞关，战争的尾声并没有带来平静。新的铁路和港口，正在改变东亚的权力地图。</textarea>
      </label>
      <div class="ttv-grid">
        <label class="ttv-label">生成模式
          <select class="ttv-select" id="ttv-mode">
            <option value="auto-scenes">自动镜头：文本 → 语音 → 镜头 → 成片</option>
            <option value="single-template">单模板：文本 → 语音 → 当前模板</option>
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
      <div class="ttv-note" id="ttv-mode-note">自动镜头模式会忽略“视频模板”，系统会按文案语义自动选择 DocumentReveal、地图、历史地球等镜头。</div>
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
            <option value="true">跳过字幕，更快</option>
            <option value="false">生成字幕文件</option>
          </select>
        </label>
      </div>
      <div class="ttv-status" id="ttv-status">默认是一站式自动镜头生成，结果会落到项目 out/ 目录。</div>
      <pre class="ttv-log" id="ttv-log">等待任务。</pre>
    </div>
    <div class="ttv-actions">
      <button class="ttv-primary" id="ttv-generate" type="button">一站式生成视频</button>
      <div class="ttv-links" id="ttv-links">
        <a class="ttv-link" id="ttv-open" target="_blank" rel="noreferrer">打开视频</a>
        <a class="ttv-link" id="ttv-download" download>下载视频</a>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (selector) => panel.querySelector(selector);
  let jobId = "";
  let timer = 0;
  translateStudioUi();
  const observer = new MutationObserver(() => window.requestAnimationFrame(translateStudioUi));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  launcher.onclick = () => panel.classList.add("open");
  $(".ttv-close").onclick = () => panel.classList.remove("open");
  $("#ttv-mode").onchange = () => {
    const auto = $("#ttv-mode").value === "auto-scenes";
    $("#ttv-template").disabled = auto;
    $("#ttv-mode-note").textContent = auto
      ? "自动镜头模式会忽略“视频模板”，系统会按文案语义自动选择 DocumentReveal、地图、历史地球等镜头。"
      : "单模板模式会使用下方选中的 Remotion 模板，适合固定视觉风格。";
    $("#ttv-generate").textContent = auto ? "一站式生成视频" : "生成当前模板视频";
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
    $("#ttv-links").classList.remove("show");
    try {
      const res = await fetch(`${API}/api/jobs`, {
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
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      jobId = payload.data.id;
      poll();
      timer = window.setInterval(poll, 2000);
    } catch (error) {
      $("#ttv-generate").disabled = false;
      $("#ttv-status").textContent = error.message || String(error);
    }
  };

  async function poll() {
    if (!jobId) return;
    try {
      const res = await fetch(`${API}/api/jobs/${encodeURIComponent(jobId)}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `HTTP ${res.status}`);
      }
      const job = payload.data;
      $("#ttv-status").textContent = job.error || job.progress || job.status;
      $("#ttv-log").textContent = (job.logs || []).join("\n") || "等待日志。";
      $("#ttv-log").scrollTop = $("#ttv-log").scrollHeight;
      if (job.status === "succeeded") {
        window.clearInterval(timer);
        $("#ttv-generate").disabled = false;
        const url = `${API}${job.result.videoUrl}`;
        $("#ttv-open").href = url;
        $("#ttv-download").href = url;
        $("#ttv-links").classList.add("show");
        $("#ttv-status").textContent = "视频已生成。";
      }
      if (job.status === "failed") {
        window.clearInterval(timer);
        $("#ttv-generate").disabled = false;
      }
    } catch (error) {
      window.clearInterval(timer);
      $("#ttv-generate").disabled = false;
      $("#ttv-status").textContent = error.message || String(error);
    }
  }
})();
