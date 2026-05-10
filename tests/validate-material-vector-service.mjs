import { execFileSync } from "node:child_process";
import path from "node:path";

const serviceRoot = path.join(process.cwd(), "services", "material-vector-search");
const files = [
  "app/embeddings.py",
  "app/store.py",
  "app/ingest.py",
  "app/main.py",
];

execFileSync("python", ["-m", "py_compile", ...files], {
  cwd: serviceRoot,
  stdio: "inherit",
});

const smoke = `
from app.embeddings import embed_text, VECTOR_DIMENSIONS
v = embed_text("上海 夜景 city")
assert len(v) == VECTOR_DIMENSIONS
assert any(abs(x) > 0 for x in v)
print("material vector service python smoke ok")
`;

execFileSync("python", ["-c", smoke], {
  cwd: serviceRoot,
  stdio: "inherit",
});
