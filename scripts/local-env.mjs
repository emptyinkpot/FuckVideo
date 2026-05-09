import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv(root = process.cwd()) {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.resolve(root, name);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const raw = trimmed.slice(index + 1).trim();
      if (!key || process.env[key]) continue;
      process.env[key] = unquote(raw);
    }
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
