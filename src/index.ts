import { getRemotionEnvironment, registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);

// FuckVideo workbench (floating button + card) — only inside Remotion Studio, never in renders.
// Delete this block and the videolab/ folder to get a plain Remotion project back.
if (getRemotionEnvironment().isStudio) {
  void import("../videolab/overlay/mount");
}
