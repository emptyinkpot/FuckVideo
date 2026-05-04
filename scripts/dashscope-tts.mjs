import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";

const DEFAULT_DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

export function shouldUseDashScopeTts(input = {}) {
  const inputProvider = String(input.ttsProvider || "").toLowerCase();
  const provider = inputProvider && inputProvider !== "auto"
    ? inputProvider
    : String(process.env.TTV_TTS_PROVIDER || "auto").toLowerCase();
  if (provider === "dashscope" || provider === "direct") return true;
  if (provider === "proxy" || provider === "tengokukk") return false;
  return Boolean(process.env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY_FILE);
}

export async function synthesizeDashScopeTtsToFile(input, outputFile) {
  const apiKey = await readDashScopeApiKey();
  if (!apiKey) {
    throw new Error("直连 DashScope TTS 需要设置 DASHSCOPE_API_KEY。");
  }

  const model = String(input.dashscopeModel || process.env.DASHSCOPE_TTS_MODEL || "cosyvoice-v3.5-plus");
  const voice = String(input.dashscopeVoice || process.env.DASHSCOPE_TTS_VOICE || input.providerVoice || input.voice || "");
  if (!voice) {
    throw new Error("直连 DashScope TTS 缺少 voice，请设置 DASHSCOPE_TTS_VOICE 或传入 --voice。");
  }

  const text = String(input.text || "").trim();
  if (!text) {
    throw new Error("直连 DashScope TTS 缺少文本。");
  }

  const chunks = await synthesizeDashScopeTts({
    apiKey,
    model,
    voice,
    text,
    format: input.audioFormat || process.env.DASHSCOPE_TTS_FORMAT || "mp3",
    sampleRate: Number(input.sampleRate || process.env.DASHSCOPE_TTS_SAMPLE_RATE || 24000),
    url: input.dashscopeWsUrl || process.env.DASHSCOPE_WS_URL || DEFAULT_DASHSCOPE_WS_URL,
  });

  await writeFile(outputFile, Buffer.concat(chunks));
  return {
    audio: {
      filePath: outputFile,
      format: input.audioFormat || process.env.DASHSCOPE_TTS_FORMAT || "mp3",
      provider: "dashscope",
    },
  };
}

async function synthesizeDashScopeTts({ apiKey, model, voice, text, format, sampleRate, url }) {
  const taskId = randomUUID();
  const timeoutMs = Number(process.env.DASHSCOPE_TTS_TIMEOUT_MS || 120000);
  const chunks = [];

  return new Promise((resolve, reject) => {
    let started = false;
    let finished = false;
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-DataInspection": "enable",
      },
    });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`DashScope TTS 超时：${Math.round(timeoutMs / 1000)}s 内未完成`));
    }, timeoutMs);

    const cleanup = () => clearTimeout(timer);
    const fail = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    ws.on("open", () => {
      ws.send(JSON.stringify(buildRunTask({ taskId, model, voice, format, sampleRate })));
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        chunks.push(Buffer.from(data));
        return;
      }

      const message = parseJsonMessage(data);
      const event = message.header?.event;
      if (message.header?.error_code) {
        fail(new Error(`DashScope TTS 失败：${message.header.error_code} ${message.header.error_message || ""}`.trim()));
        return;
      }

      if (event === "task-started" && !started) {
        started = true;
        ws.send(JSON.stringify(buildContinueTask({ taskId, text })));
        ws.send(JSON.stringify(buildFinishTask({ taskId })));
        return;
      }

      if (event === "task-finished") {
        finished = true;
        cleanup();
        ws.close();
        if (!chunks.length) {
          reject(new Error("DashScope TTS 已完成但没有返回音频数据。"));
          return;
        }
        resolve(chunks);
        return;
      }

      if (event === "task-failed") {
        fail(new Error(`DashScope TTS 失败：${message.header?.error_message || "task-failed"}`));
      }
    });

    ws.on("error", fail);
    ws.on("close", () => {
      if (!finished) {
        cleanup();
        reject(new Error("DashScope TTS WebSocket 已关闭但任务未完成。"));
      }
    });
  });
}

function buildRunTask({ taskId, model, voice, format, sampleRate }) {
  return {
    header: {
      action: "run-task",
      task_id: taskId,
      streaming: "duplex",
    },
    payload: {
      task_group: "audio",
      task: "tts",
      function: "SpeechSynthesizer",
      model,
      parameters: {
        text_type: "PlainText",
        voice,
        format,
        sample_rate: sampleRate,
      },
      input: {},
    },
  };
}

function buildContinueTask({ taskId, text }) {
  return {
    header: {
      action: "continue-task",
      task_id: taskId,
      streaming: "duplex",
    },
    payload: {
      input: {
        text,
      },
    },
  };
}

function buildFinishTask({ taskId }) {
  return {
    header: {
      action: "finish-task",
      task_id: taskId,
      streaming: "duplex",
    },
    payload: {
      input: {},
    },
  };
}

function parseJsonMessage(data) {
  try {
    return JSON.parse(Buffer.from(data).toString("utf8"));
  } catch {
    return {};
  }
}

async function readDashScopeApiKey() {
  if (process.env.DASHSCOPE_API_KEY) return process.env.DASHSCOPE_API_KEY;
  if (!process.env.DASHSCOPE_API_KEY_FILE) return "";
  const { readFile } = await import("node:fs/promises");
  return (await readFile(process.env.DASHSCOPE_API_KEY_FILE, "utf8")).trim();
}
