# FuckVideo

Code-driven Remotion animation templates for previewing and rendering in Remotion Studio.

## Run

Double-click `FuckVideo.exe` in the project root to start Remotion Studio. The launcher expects the project dependencies to be installed.

To rebuild the launcher, run `videolab\launcher\build.cmd` on Windows with .NET Framework 4.x installed.

To start Studio from a terminal instead:

```sh
npm install
npm run dev
```

Render a bundle with `npm run build`. Run `npm run verify:upstream` for lint, type checking, and a still render of each registered composition.

## Project Layout

- `src/Root.tsx` registers the compositions shown in Studio.
- `src/templates/` contains reusable 2D, 3D, map, and historical animation components.
- `src/historical-globe/` contains the editable historical globe compositions and timeline data.
- `public/maps/`, `public/geojson/`, and `public/historical-maps/` contain runtime map data used by animations.
- `asset-source/remotionlab/` keeps local `.tsx` animation references. These examples are not loaded by the Remotion bundle.
- `asset-source/programmatic-visual-assets/` contains code-animation references and attribution.

Remotion is installed as an npm dependency. This repository uses its public APIs and keeps animation implementation under `src/`.
