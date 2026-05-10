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

const sentenceTransformersSmoke = `
import os
import sys
import types

class FakeVector:
    def tolist(self):
        return [0.5, 0.5, 0.5]

class FakeModel:
    def __init__(self, name, device=None):
        self.name = name
        self.device = device
    def encode(self, texts, normalize_embeddings=True):
        return [FakeVector()]

fake_module = types.ModuleType("sentence_transformers")
fake_module.SentenceTransformer = FakeModel
sys.modules["sentence_transformers"] = fake_module
os.environ["MATERIAL_EMBEDDING_BACKEND"] = "sentence-transformers"
os.environ["MATERIAL_EMBEDDING_MODEL"] = "fake/clip"

from app.embeddings import embed_text, embedding_status
v = embed_text("上海 夜景 city")
assert v == [0.5, 0.5, 0.5]
assert embedding_status()["backend"] == "sentence-transformers"
print("material vector sentence-transformers backend smoke ok")
`;

execFileSync("python", ["-c", sentenceTransformersSmoke], {
  cwd: serviceRoot,
  stdio: "inherit",
});
