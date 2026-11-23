# FuckVideo

Code-driven Remotion animation templates for previewing and rendering in Remotion Studio.

## Run

Double-click `start.bat` in the project root to check the installed Remotion packages, update them when a newer version is available, and start Remotion Studio. If the update fails, the script reports the failure and starts with the packages already installed. The console shows startup logs and stays open while Studio is running. Press `Ctrl+C` in that console to stop Studio.

The update check covers the Remotion packages used by the project. Other dependencies stay at the versions recorded in `package.json` and `package-lock.json`.

To start Studio from a terminal instead:

```sh
npm install
npm run dev
```

Render a bundle with `npm run build`. Run `npm run verify:upstream` for lint, type checking, and a still render of each registered composition.

## Project Layout

- `src/Root.tsx` registers the compositions shown in Studio.
- `src/templates/` contains reusable 2D, 3D, map, and historical animation components.
- `src/earth3d/` contains everything related to the globe: the new data-driven 3D Earth (real-scale terrain mesh, shader-computed land surface, modeled water and buildings), its Python preprocessing scripts, the war history database and timelines, and the legacy vector and textured globes. Generated data lives in `src/earth3d/assets/` and download caches in `src/earth3d/.cache/`; both are ignored by Git and rebuilt by the scripts. See `src/earth3d/README.md`.
- `public/maps/`, `public/geojson/`, and `public/historical-maps/` contain runtime map data used by animations.
- `asset-source/remotionlab/` keeps local `.tsx` animation references. These examples are not loaded by the Remotion bundle.
- `asset-source/programmatic-visual-assets/` contains code-animation references and attribution.

Remotion is installed as an npm dependency. This repository uses its public APIs and keeps animation implementation under `src/`.
