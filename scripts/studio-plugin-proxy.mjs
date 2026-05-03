#!/usr/bin/env node
import { createServer } from "node:http";

const targetPort = Number(process.env.REMOTION_STUDIO_TARGET_PORT || 3000);
const proxyPort = Number(process.env.REMOTION_STUDIO_PLUGIN_PORT || 3057);
const pluginOrigin = process.env.TEXT_TO_VIDEO_ORIGIN || "http://127.0.0.1:3037";

const server = createServer(async (req, res) => {
  try {
    const targetUrl = new URL(req.url || "/", `http://127.0.0.1:${targetPort}`);
    const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const html = await response.text();
      const injected = html.includes(`${pluginOrigin}/studio-plugin.js`)
        ? html
        : html.replace("</body>", `<script src="${pluginOrigin}/studio-plugin.js"></script></body>`);
      const body = Buffer.from(injected, "utf8");
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      });
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("content-length", String(body.length));
      res.end(body);
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    if (!response.headers.get("content-length")) {
      res.setHeader("content-length", String(buffer.length));
    }
    res.end(buffer);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(proxyPort, "127.0.0.1", () => {
  console.log(`Remotion 工作台插件入口：http://127.0.0.1:${proxyPort}`);
});
