// FuckVideo workbench smoke test, run inside the real Remotion Studio page.
//
// Opens http://localhost:3000 in Remotion's bundled headless Chrome (isolated profile) over the
// DevTools protocol and checks: the floating button mounts, the card opens, a project loads and
// Studio switches to MultiSceneVideo, clicking a scene doesn't throw, the Chinese UI toggle
// translates Studio and restores English when switched off, and the page logs no errors.
// Starts `videolab/server/start.mjs` itself if Studio/API aren't running. No screenshots.
//
// Note: loading a project rewrites src/generated/currentMultiSceneDefaultProps.ts, exactly like
// clicking 载入 in the workbench.

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO = "http://localhost:3000";
const API = "http://127.0.0.1:3037/api/projects";
const chrome = path.join(root, "node_modules", ".remotion", "chrome-headless-shell", "win64", "chrome-headless-shell-win64", "chrome-headless-shell.exe");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
};

let services = null;
if (!(await up(STUDIO)) || !(await up(API))) {
  services = spawn(process.execPath, [path.join(root, "videolab", "server", "start.mjs")], { cwd: root, stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 180 && !((await up(STUDIO)) && (await up(API))); i++) await sleep(500);
}

const profile = mkdtempSync(path.join(tmpdir(), "fv-smoke-"));
const port = 9300 + Math.floor(Math.random() * 500);
const browser = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--mute-audio", "--window-size=1600,900", "about:blank"], { stdio: "ignore", windowsHide: true });

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`FAIL ${msg}`);
};

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {}
  }
  if (!target) throw new Error("headless Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.once("open", r));
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
  });
  const send = (method, params = {}) => new Promise((r) => {
    const id = ++nextId;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const waitFor = async (expression, timeoutMs = 20000) => {
    for (let t = 0; t < timeoutMs; t += 300) {
      const v = await evaluate(expression);
      if (v) return v;
      await sleep(300);
    }
    return null;
  };
  const SR = `document.querySelector("[data-fuckvideo-overlay]")?.shadowRoot`;

  await send("Runtime.enable");
  await send("Page.navigate", { url: STUDIO });

  if (!(await waitFor(`!!${SR}?.querySelector(".fab")`, 90000))) throw new Error("floating button did not mount");
  console.log("ok   floating button mounted");

  await evaluate(`${SR}.querySelector(".fab").click()`);
  if (!(await waitFor(`!!${SR}.querySelector(".card")`))) fail("card did not open");
  else console.log("ok   card opens");

  const options = await waitFor(`${SR}.querySelectorAll(".card select option").length > 1 && ${SR}.querySelectorAll(".card select option").length`);
  if (!options) fail("project list empty");
  else console.log(`ok   project list: ${options} options`);

  // Load the most recent project (same as picking it in the dropdown).
  await evaluate(`(() => {
    const select = ${SR}.querySelector(".card select");
    const value = [...select.options].find((o) => o.value)?.value;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  const scenes = await waitFor(`${SR}.querySelectorAll(".scene").length`, 30000);
  if (!scenes) fail("scenes did not load");
  else console.log(`ok   project loaded: ${scenes} scenes`);
  const onComposition = await waitFor(`location.pathname.includes("MultiSceneVideo") && location.pathname`, 30000);
  if (!onComposition) fail(`Studio did not switch to MultiSceneVideo (at ${await evaluate("location.pathname")})`);
  else console.log(`ok   Studio switched to ${onComposition}`);

  await evaluate(`${SR}.querySelectorAll(".scene")[2]?.click()`);
  await sleep(1500);
  console.log("ok   scene click -> seek");

  // Chinese UI toggle.
  await evaluate(`[...${SR}.querySelectorAll(".tabs button")].find((b) => b.textContent.includes("设置")).click()`);
  await waitFor(`!!${SR}.querySelector(".switch input")`);
  const before = await evaluate(`document.body.innerText.includes("Compositions") || document.body.innerText.includes("Render")`);
  await evaluate(`${SR}.querySelector(".switch input").click()`);
  const translated = await waitFor(`document.body.innerText.includes("合成列表") || document.body.innerText.includes("渲染")`, 5000);
  await evaluate(`${SR}.querySelector(".switch input").click()`);
  await sleep(800);
  const restored = await evaluate(`!document.body.innerText.includes("合成列表") && !document.body.innerText.includes("渲染")`);
  if (!before || !translated || !restored) fail(`translation toggle (english before=${before}, translated=${translated}, restored=${restored})`);
  else console.log("ok   界面中文 toggles on and restores English");

  const real = errors.filter((e) => !/favicon|ResizeObserver loop/.test(e));
  if (real.length) fail(`page errors (${real.length}):\n` + real.slice(0, 8).join("\n"));
  else console.log("ok   no page errors");
  ws.close();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  browser.kill();
  if (services) {
    try {
      execFileSync("taskkill", ["/PID", String(services.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  }
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
console.log(failed ? "workbench smoke: FAIL" : "workbench smoke: ok");
process.exit(failed ? 1 : 0);
