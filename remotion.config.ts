// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs

import { Config } from "@remotion/cli/config";
import { earth3dWebpackOverride } from "./src/earth3d/webpackOverride.mjs";

// The official template also calls Config.setRspack(true). Not enabled here: Rspack's strict
// export check rejects @react-three/fiber (it reads React.act), which the 3D templates use.
// Remotion's default bundler (webpack) only warns about that.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// earth3d: terrain tiles (.e3d) and river/border data (.bin) are emitted as plain files.
// The same override is passed to the Node bundler in tests/verify-upstream.mjs.
Config.overrideWebpackConfig(earth3dWebpackOverride);
