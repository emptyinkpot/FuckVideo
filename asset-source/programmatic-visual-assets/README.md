# Programmatic Visual Assets

This directory stores reusable visual source material for the Remotion pipeline.
The runtime template layer lives in `src/templates`; this folder is the source and reference layer.

## Downloaded Sources

| Source | Local path | License | Runtime role |
| --- | --- | --- | --- |
| remotion-bits | `remotion-bits/` | MIT | Component bits: `AnimatedText`, `GradientTransition`, particles, 3D scene helpers |
| React Video Editor Remotion Templates | `reactvideoeditor-remotion-templates/` | MIT, per project README | Standalone templates: text highlight, quote card, noise grain, film burn, vignette, camera motion |
| Remotion official resources | `remotion-official/resources.html` | Reference docs, verify per linked resource | Curated reference index for official examples and implementation patterns |

## Local Runtime Alignment

The first adapted runtime template is:

- `src/templates/DocumentRevealProV2.tsx`

It uses:

- `remotion-bits` for deterministic text entrance.
- `roughjs` for hand-drawn highlight, rules, and stamp paths.
- RVE-style grain, vignette, and film-burn overlay patterns adapted into local code.
- Existing manifest fields from `DocumentReveal`: `title`, `subtitle`, `body`, `highlightWords`, `highlightMode`, `sealText`, `tone`.

## Rule

Do not import raw template demos directly into production scenes. Copy or adapt the useful visual mechanism into a local template, then register it in:

- `src/templates/template-manifest.json`
- `src/templates/visual-provider-manifest.json`
- `src/templates/sceneRegistry.tsx`
