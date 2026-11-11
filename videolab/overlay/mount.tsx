// Entry of the FuckVideo workbench inside Remotion Studio. Imported lazily from src/index.ts only
// when getRemotionEnvironment().isStudio, so renders never load it.
import { createRoot } from "react-dom/client";
import { startStudioTranslation } from "./i18n/translate";
import { OVERLAY_CSS } from "./styles";
import { Workbench, readPref } from "./Workbench";

const w = window as unknown as { __fuckvideoWorkbench?: boolean };

// Hot reloads can re-run the entry module; mount once per page.
if (!w.__fuckvideoWorkbench) {
  w.__fuckvideoWorkbench = true;
  const host = document.createElement("div");
  host.setAttribute("data-fuckvideo-overlay", "");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);
  const container = document.createElement("div");
  container.className = "root";
  shadow.appendChild(container);
  createRoot(container).render(<Workbench />);
  if (readPref("zh", false)) startStudioTranslation();
}
