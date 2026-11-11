import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// staticFile() in the compositions resolves against this base; server.mjs serves public/ here.
(window as unknown as { remotion_staticBase: string }).remotion_staticBase = "/public";

createRoot(document.getElementById("root")!).render(<App />);
