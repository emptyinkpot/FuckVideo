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

## Commit and push

Double-click `push.bat` in the project root to commit every change in the working tree and push it. The script (`push.ps1`) asks three questions:

1. Branch: it lists the remote branches. Enter a number, or type a new branch name. Press Enter to use the remote's default branch.
2. Description: the commit message. Press Enter to commit without a message.
3. Tag: an annotated tag name. Press Enter to skip tagging.

If the chosen branch is not the current one, the script carries the uncommitted changes over to it and commits only the files that had changes before the switch, so files ignored on the current branch (such as `src/earth3d/assets/`) are not picked up by a different `.gitignore`. It refuses to commit any single file over 50 MB. Pushes go over HTTPS first and fall back to SSH. When the Git LFS pre-push check cannot reach GitHub, the script skips that check only if the outgoing commits add no LFS files. It never force-pushes: if the remote branch has commits that are not local, it stops and keeps the local commit.

## Project Layout

- `src/Root.tsx` registers the compositions shown in Studio.
- `src/templates/` contains reusable 2D, 3D, map, and historical animation components.
- `src/earth3d/` contains everything related to the globe, and it is the only globe or geographic map in the project: the data-driven 3D Earth (real-scale terrain mesh, shader-computed land surface, modeled water and buildings), the war history database, the 1931–1945 war composition, the route flyover template, the narration backdrop, and the Python preprocessing pipeline. The base Earth and the overlays (nations colored by polity with generated borders, occupation stripes and contested dashes, railways, cities, front lines, arrows, place names) are separate layers that can be switched on and off and exported as separate passes (`pass`: full, globe, overlay, labels). Small generated data files in `src/earth3d/assets/` are committed. The terrain tiles (`src/earth3d/assets/tiles/`, about 775 MB) and the download cache (`src/earth3d/.cache/`) are not; `start.bat` quick-checks them on every launch and, if anything is missing or out of date, rebuilds just that part in the background with a progress window while Studio starts (about an hour from scratch); `src/earth3d/rebuild.bat` runs the full check by hand and checks every file against `src/earth3d/assets.sha256`. See `src/earth3d/README.md`.
- `public/fonts/` holds the fonts every animation uses (Inter, Noto Sans SC, Noto Serif SC, all SIL OFL, licenses alongside). `src/fonts.ts` loads them before any frame is captured, so renders do not depend on the fonts installed on the machine.
- `public/images/vinyl-cover.jpg` is the default VinylPlayer cover (an Unsplash photo), stored locally so the render does not need the network.
- `asset-source/remotionlab/` keeps local `.tsx` animation references. These examples are not loaded by the Remotion bundle.
- `asset-source/programmatic-visual-assets/` contains code-animation references and attribution.

Remotion is installed as an npm dependency. This repository uses its public APIs and keeps animation implementation under `src/`.
