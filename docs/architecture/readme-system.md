# README System

This document defines the documentation system for the FuckVideo repository.

## Read Order

1. `README.md`
2. `project.json`
3. `docs/video-understanding-system.md`
4. `docs/contracts/video-project-schema.md`
5. `docs/architecture/material-pipeline.md`
6. `docs/operations/runtime-runbook.md`
7. `docs/research/cloneable-video-understanding-stacks.md`
8. subsystem README files under `src/**` and `asset-source/**`

## Canonical Documents

| Document | Role |
| --- | --- |
| `README.md` | Human entrypoint for purpose, setup, current workflow and project-wide rules. |
| `project.json` | Machine-readable project manifest and active authority map. |
| `docs/video-understanding-system.md` | Canonical architecture for AI material understanding, semantic retrieval and automatic assembly. |
| `docs/contracts/video-project-schema.md` | Contract for project JSON, shot plans, scenes, vector results and Remotion props handoff. |
| `docs/architecture/material-pipeline.md` | Material ingestion, preprocessing, indexing and retrieval architecture. |
| `docs/operations/runtime-runbook.md` | Runtime commands, ports, env vars, verification and troubleshooting. |
| `docs/research/cloneable-video-understanding-stacks.md` | Cloneable open-source stacks and build-vs-buy decisions. |

## Subsystem Documents

| Document | Scope |
| --- | --- |
| `src/historical-globe/README.md` | Historical globe and map compositions. |
| `src/historical-globe/history-db/README.md` | Historical world state data model. |
| `src/remotionlab-showcase/README.md` | RemotionLab showcase integration. |
| `asset-source/remotionlab/README.md` | RemotionLab source cache and attribution. |
| `asset-source/historical-basemaps/README.md` | Historical basemap source and derived assets. |
| `asset-source/programmatic-visual-assets/README.md` | Programmatic visual asset sources. |

## Vendor Documents

Documents inside imported upstream references are not project authority. Examples:

- `asset-source/programmatic-visual-assets/remotion-bits/**`
- `asset-source/programmatic-visual-assets/reactvideoeditor-remotion-templates/**`
- `asset-source/historical-basemaps/CONTRIBUTING.md`

They explain upstream usage, license or contribution style. They do not override this repository's contracts, runtime boundaries or product goal.

## Update Rules

- If the project goal changes, update `README.md`, `project.json` and `docs/video-understanding-system.md`.
- If a JSON field used by projects changes, update `docs/contracts/video-project-schema.md` before changing code.
- If material indexing changes, update `docs/architecture/material-pipeline.md`.
- If commands, ports or env vars change, update `docs/operations/runtime-runbook.md`.
- If a new upstream project, dataset, template source or cloneable stack is adopted, update README attribution and `docs/research/cloneable-video-understanding-stacks.md`.

## Bot And Automation Policy

Automation may enforce formatting and cheap static checks. It must not rewrite architecture, timeline semantics, visual provider decisions or generated project JSON without human review.

- `pre-commit-ci[bot]`: allowed for formatting, lint and small mechanical fixes.
- `sourcery-ai[bot]`: comment-only unless a narrow Python-only scope is explicitly approved.
- GitHub Actions: owns quality gates and should block broken builds.
