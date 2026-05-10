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

const openAiCompatibleSmoke = `
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        assert self.path == "/v1/embeddings"
        assert self.headers.get("Authorization") == "Bearer test-key"
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        assert payload["model"] == "fake-embedding-model"
        assert payload["input"] == "上海 夜景 city"
        assert payload["dimensions"] == 3
        body = json.dumps({"data": [{"embedding": [0.1, 0.2, 0.3]}]}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, format, *args):
        return

server = HTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()

os.environ["MATERIAL_EMBEDDING_BACKEND"] = "openai-compatible"
os.environ["MATERIAL_EMBEDDING_API_BASE_URL"] = f"http://127.0.0.1:{server.server_port}/v1"
os.environ["MATERIAL_EMBEDDING_API_MODEL"] = "fake-embedding-model"
os.environ["MATERIAL_EMBEDDING_API_KEY"] = "test-key"
os.environ["MATERIAL_EMBEDDING_DIMENSIONS"] = "3"

from app.embeddings import embed_text, embedding_status
v = embed_text("上海 夜景 city")
assert v == [0.1, 0.2, 0.3]
status = embedding_status()
assert status["backend"] == "openai-compatible"
assert status["model"] == "fake-embedding-model"
assert status["dimensions"] == 3
server.shutdown()
print("material vector openai-compatible backend smoke ok")
`;

execFileSync("python", ["-c", openAiCompatibleSmoke], {
  cwd: serviceRoot,
  stdio: "inherit",
});
