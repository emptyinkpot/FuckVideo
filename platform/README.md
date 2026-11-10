# platform (huasheng-clone)

> **Location**: this is the `platform/` subdirectory of `emptyinkpot/FuckVideo`. It was a standalone repo (`emptyinkpot/huasheng-clone`) until 2026-11-10, when it was merged here with its full commit history. Run all commands below from `platform/`. The "root Remotion workspace" mentioned below is the FuckVideo repo root (`src/`, `scripts/`), formerly called `remotion-project`.
>
> Open-source clone of [huasheng.cn](https://www.huasheng.cn/) (Bilibili's AI video creation tool, internal codename `innovideo`).
>
> **Differentiator**: while replicating huasheng's full feature set (script → auto-storyboard → TTS → semantic asset matching → 1080P export → timeline editor), this project layers on **programmatic-animation moats** that huasheng cannot do — historical-globe flyovers, 3D scenes, vector earth textures, data-driven charts, narrative templates — inherited from the FuckVideo root Remotion workspace.

## Status

**v0.1.0 / Stage 1 — MVP end-to-end pipeline scaffolding in progress.**

The 5-stage roadmap (`docs/ROADMAP.md`) is kept local-only and is not in the public repo.

## Stack

- **Frontend**: Next.js 14 App Router + RSC + Tailwind v4 + shadcn/ui (mirrors huasheng's stack)
- **Backend**: Hono on Node (independent process, not Next Route Handlers)
- **Render**: Remotion 4.x server-side + Chromium, BullMQ Standalone queue
- **TTS**: DashScope CosyVoice v3.5-plus (public voices + 10s cloning)
- **LLM**: routed via local sub2api (Claude / Qwen)
- **Storage** (tiered):
  - `local-dev` (default): SQLite + local fs + LanceDB embedded + in-memory queue
  - `single-server`: + Postgres + minio
  - `scale-out`: + Redis + Python vector-search sidecar

## Layout

```
FuckVideo/platform/
├── apps/
│   ├── web/        Next.js 14 frontend (huasheng-like UI)
│   ├── api/        Hono backend (innovideo/* endpoints)
│   └── worker/     Remotion render worker
├── packages/
│   ├── compositions/   Programmatic-animation moat (rewritten from root src/templates)
│   ├── schemas/        Shared Zod definitions
│   ├── tts-dashscope/  TTS pipeline
│   └── material-search/ Vector retrieval (LanceDB embedded)
├── docs/
└── infra/
```

## Quick start (Stage 1)

```bash
# 0. Use Node 22 LTS (see .node-version).
#    Node 24 currently forces native better-sqlite3 builds on Windows.
node -v

# 1. Install deps
pnpm install

# 2. Copy env template & fill in keys
cp .env.example .env.local   # .env.example is local-only (gitignored); create .env.local with the keys below
# Required: DASHSCOPE_API_KEY, SUB2API_BASE_URL, SUB2API_KEY,
#           QWEN_EMBEDDING_BASE_URL, QWEN_EMBEDDING_KEY

# 3. Pre-fetch Chromium for Remotion (200MB, first run only)
pnpm --filter @huasheng-clone/worker exec npx remotion browser ensure

# 4. Start all 3 processes (web:3000 + api:3001 + worker:3002)
pnpm dev

# 5. Smoke test
curl http://localhost:3001/health

curl -X POST http://localhost:3001/api/innovideo/create \
  -H 'Content-Type: application/json' \
  -d @docs/fixtures/default_script.json
```

## Reverse-engineering notes

Real evidence captured via Playwright MCP on 2026-06-19 (not extrapolation). The full findings doc (`docs/HUASHENG_REVERSE_ENGINEERING.md`) is local-only; summary: Next.js App Router + Bilibili jinkela ecosystem, 4 working TTS voices, single Index LLM, real quotas, full API topology.

## License

MIT (planned).
