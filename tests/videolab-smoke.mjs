// VideoLab UI smoke test: opens http://127.0.0.1:3037 in Remotion's bundled headless Chrome
// (isolated profile) over the DevTools protocol, waits for the app to load a project, and checks
// that the Player mounted, scenes and timeline rendered, and no page errors were thrown.
// Starts the VideoLab server itself if nothing answers on :3037. No screenshots are taken.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] || "http://127.0.0.1:3037/";
const chrome = path.join(root, "node_modules", ".remotion", "chrome-headless-shell", "win64", "chrome-headless-shell-win64", "chrome-headless-shell.exe");
const profile = mkdtempSync(path.join(tmpdir(), "videolab-smoke-"));
const port = 9300 + Math.floor(Math.random() * 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
let server = null;
if (!(await up())) {
  server = spawn(process.execPath, [path.join(root, "videolab", "server", "server.mjs")], { cwd: root, stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(200);
}

const browser = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--mute-audio",
  "--window-size=1600,900",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

let failed = false;
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
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ""}`);
    }
  });
  const send = (method, params = {}) => new Promise((r) => {
    const id = ++nextId;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url });

  const probe = `(() => ({
    brand: !!document.querySelector(".brand"),
    project: document.querySelector(".project-select")?.selectedOptions[0]?.textContent || "",
    scenes: document.querySelectorAll(".scene").length,
    blocks: document.querySelectorAll(".timeline .block").length,
    player: !!document.querySelector(".player-box [class*='__remotion'], .player-box canvas, .player-box div[style*='aspect-ratio']"),
    playerChildren: document.querySelector(".player-box")?.innerHTML.length || 0,
    empty: document.querySelector(".player-box .empty")?.textContent || "",
    status: document.querySelector(".status")?.textContent || "",
  }))()`;
  let state;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    state = (await send("Runtime.evaluate", { expression: probe, returnByValue: true })).result?.result?.value;
    if (state?.scenes > 0 && state.playerChildren > 200) break;
  }
  // Seek through the Player by clicking the 3rd scene, then let it render a moment.
  await send("Runtime.evaluate", { expression: `document.querySelectorAll(".scene")[2]?.click()` });
  await sleep(2500);
  const after = (await send("Runtime.evaluate", { expression: `document.querySelector(".panel.preview .panel-head .muted")?.textContent`, returnByValue: true })).result?.result?.value;

  console.log(JSON.stringify({ ...state, timeAfterSelectingScene3: after }, null, 2));
  const ignorable = (e) => /favicon\.ico/.test(e);
  const real = errors.filter((e) => !ignorable(e));
  if (real.length) {
    failed = true;
    console.error(`page errors (${real.length}):\n` + real.slice(0, 10).join("\n"));
  }
  if (!state?.brand || !state.scenes || !state.blocks || state.playerChildren <= 200) {
    failed = true;
    console.error("UI did not fully render");
  }
  ws.close();
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  browser.kill();
  server?.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(failed ? "videolab smoke: FAIL" : "videolab smoke: ok");
process.exit(failed ? 1 : 0);
