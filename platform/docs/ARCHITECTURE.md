# Architecture

## 进程模型

```
┌──────────────┐   /api/* rewrite   ┌──────────────┐
│  apps/web    │  ────────────────► │  apps/api    │
│  Next.js 14  │  :3000             │  Hono :3001  │
│  App Router  │ ◄──────────────────│              │
└──────────────┘    JSON            └──────┬───────┘
                                           │ enqueue render
                                           ▼
                                    ┌──────────────┐
                                    │  apps/worker │
                                    │  p-queue     │
                                    │  Remotion    │
                                    │  :3002       │
                                    └──────┬───────┘
                                           │ writes MP4
                                           ▼
                                       storage/
                                       renders/
                                       *.mp4
```

三进程独立，通过 HTTP/JSON 通信。本地 dev 由 `pnpm dev` 一起拉起。

## 包拓扑

```
apps/
  web         → packages/schemas
  api         → packages/{schemas, db, llm, tts-dashscope, material-search}
  worker      → packages/{schemas, db, tts-dashscope, compositions}

packages/
  schemas         (无内部依赖) — Zod 真源
  db              → schemas
  llm             → schemas (Claude/Qwen via sub2api)
  tts-dashscope   → schemas (DashScope CosyVoice)
  material-search → schemas (LanceDB embedded + Qwen Embedding)
  compositions    → schemas (Remotion components)
```

`@huasheng-clone/schemas` 是 single source of truth — 任何跨包/跨进程的数据形状都从这里 derive。

## 存储分级

| 阶段 | 元数据 | 对象存储 | 向量 | 队列 |
|---|---|---|---|---|
| **local-dev**（Stage 1-2a，默认） | SQLite + Drizzle | 本地 `storage/` | LanceDB embedded | p-queue 内存 |
| **single-server**（Stage 2b 起） | Postgres + Drizzle | minio | LanceDB embedded | PgBoss |
| **scale-out**（Stage 4 按需） | Postgres cluster | minio cluster | LanceDB cluster + Python sidecar | Redis + BullMQ |

切换由 `DATABASE_URL` 等 env 驱动，业务代码不感知。

## 核心数据流（端到端）

```
1. POST /api/innovideo/create
   ├─ Zod CreateDraftRequestSchema 校验
   ├─ INSERT INTO drafts (status='planning')
   └─ enqueue script-to-scenes 任务
       │
2. packages/llm.scriptToScenes()
   ├─ sub2api Claude/Qwen
   ├─ 解析 → Zod ScenePlanSchema → 3 次重试
   ├─ UPDATE drafts SET scene_plan_json=..., status='tts'
   └─ enqueue tts 任务
       │
3. packages/tts-dashscope.renderTimeline(scenes)
   ├─ 每个 scene 调 DashScope CosyVoice
   ├─ 写入 storage/tts/scene-*.mp3
   ├─ 生成 SRT + manifest
   ├─ UPDATE drafts SET status='matching'
   └─ enqueue material-match 任务
       │
4. packages/material-search.searchMaterials({query: visualHint})
   ├─ Qwen Embedding(visualHint)
   ├─ LanceDB vector search top-K
   ├─ UPDATE drafts SET scene_plan_json=...(matchedAssets), status='rendering'
   └─ POST http://worker:3002/render
       │
5. apps/worker render
   ├─ @remotion/bundler bundle compositions
   ├─ @remotion/renderer renderMedia(MultiSceneVideo, props=scenes)
   ├─ 输出 storage/renders/{draftId}.mp4
   └─ UPDATE drafts SET status='done', output_path=...
       │
6. GET /api/innovideo/draft/:id → 返回 MP4 路径
```

## 关键技术决策

1. **Next.js App Router + RSC**（和花生对齐）
2. **apps/api 独立进程 Stage 1 起**（避免后期"先合后拆"导致 fetch 路径重写）
3. **存储分级**（按部署形态切换，业务无感）
4. **Remotion 服务端渲染**（继承 31 个 composition）
5. **LLM 走 sub2api**（统一 Claude/Qwen，跨 provider 兼容）
6. **类型策略**：Zod 运行时校验 + Props interface 显式（避免 IDE 跳转跳进 Zod 内部）
7. **TTS 用 DashScope CosyVoice v3.5-plus**
8. **素材检索**：Qwen Embedding → LanceDB embedded → 后期 + LLM rerank
9. **部署**：Stage 1-2a 本机；Stage 2b 起前端 + worker 同机部署（**不用 Vercel**，国内延迟 + 跨境鉴权复杂）
10. **不做**：浏览器 WebCodecs 重写、画面生成大模型、自训 TTS、Bilibili BV 抓取
