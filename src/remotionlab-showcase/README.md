# RemotionLab Showcase Runtime Registry

This folder is the safe Remotion-facing registry for RemotionLab showcase assets.

It intentionally does not compile the 263 downloaded external `.tsx` files as first-party templates. Those files stay in `asset-source/remotionlab/showcase/<slug>/` as source references. Remotion Studio gets one clean composition, `RemotionLabShowcaseAsset`, and switches assets through the `assetId` prop.

Generated catalog:

```text
catalog.ts
```

Regenerate it with:

```console
node scripts/sync-remotionlab-showcase.mjs --skip-media
```
