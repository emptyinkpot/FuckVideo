"""渲染数据的校验清单：src/earth3d/assets.sha256（提交进仓库）。

每个数据文件记一行 "sha256  相对路径"。.e3d、.bin 是 gzip 压缩的，校验的是解压后的内容，
不受 gzip 头里的时间戳、各电脑 zlib 版本差异影响。

用法（在 src/earth3d/pipeline 下）：
    python manifest.py write    # 按当前 assets 生成清单（数据有意改动后由维护者运行）
    python manifest.py verify   # 检查 assets 是否和清单完全一致
    python manifest.py verify --report out.json   # 同时把缺失、多余、不一致的文件列表写进 json
可用环境变量 EARTH3D_ASSETS 指定要检查的数据目录。
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

from config import ASSETS, EARTH3D

MANIFEST = EARTH3D / "assets.sha256"
COMPRESSED = {".e3d", ".bin"}
SKIP = {".gitkeep"}


def content_hash(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix in COMPRESSED:
        data = gzip.decompress(data)
    return hashlib.sha256(data).hexdigest()


def scan(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): content_hash(path)
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.name not in SKIP and not path.name.endswith(".tmp")
    }


def read_manifest() -> dict[str, str]:
    entries = {}
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        if line.strip():
            digest, name = line.split("  ", 1)
            entries[name] = digest
    return entries


def write() -> None:
    entries = scan(ASSETS)
    MANIFEST.write_text("".join(f"{digest}  {name}\n" for name, digest in entries.items()), encoding="utf-8")
    print(f"manifest written: {len(entries)} files -> {MANIFEST}")


def verify(report: Path | None = None) -> bool:
    if not MANIFEST.exists():
        print(f"no manifest at {MANIFEST}")
        return False
    expected = read_manifest()
    actual = scan(ASSETS)
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    different = sorted(name for name in set(expected) & set(actual) if expected[name] != actual[name])
    if report:
        report.write_text(json.dumps({"missing": missing, "extra": extra, "different": different}), encoding="utf-8")
    if not (missing or extra or different):
        print(f"assets identical to manifest: {len(expected)} files")
        return True
    print(f"assets differ from manifest: {len(missing)} missing, {len(extra)} extra, {len(different)} different")
    for label, names in (("missing", missing), ("extra", extra), ("different", different)):
        for name in names[:20]:
            print(f"  {label}: {name}")
        if len(names) > 20:
            print(f"  ... {len(names) - 20} more {label}")
    return False


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "verify"
    if command == "write":
        write()
    elif command == "verify":
        report = Path(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[2] == "--report" else None
        sys.exit(0 if verify(report) else 1)
    else:
        sys.exit(f"unknown command: {command}")
