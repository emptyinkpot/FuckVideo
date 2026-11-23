"""下载河流、湖泊、海洋、城市矢量数据到 .cache/vector/<name>/ 并解压。

Natural Earth 的下载地址总是指向最新版本。为了让每台电脑用到同一份数据，
解压后核对 .shp、.dbf 的 sha256 与 inputs.lock.json 是否一致；不一致就停下说明，
不会悄悄用新版本算出不同的结果。
  python fetch_vectors.py --update-lock   # 有意更换数据版本时，由维护者重写锁定值
"""

from __future__ import annotations

import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

import requests

from config import VECTOR_CACHE, VECTOR_SOURCES

LOCK = Path(__file__).with_name("inputs.lock.json")


def file_hashes(folder: Path) -> dict[str, str]:
    return {
        path.relative_to(folder).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(folder.rglob("*"))
        if path.suffix.lower() in {".shp", ".dbf"}
    }


def main() -> None:
    update = "--update-lock" in sys.argv
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    for name, url in VECTOR_SOURCES.items():
        target = VECTOR_CACHE / name
        if not (target.exists() and any(target.rglob("*.shp"))):
            print(f"download {name} ...", flush=True)
            response = requests.get(url, timeout=600)
            response.raise_for_status()
            target.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
                archive.extractall(target)
            print(f"  {name}: {len(response.content) / 1e6:.1f} MB")
        hashes = file_hashes(target)
        if update or name not in lock:
            lock[name] = {"url": url, "files": hashes}
            continue
        if hashes != lock[name]["files"]:
            sys.exit(
                f"{name}: downloaded data differs from inputs.lock.json. The source has probably "
                f"published a new version ({url}). Results would not match the committed assets. "
                f"Run with --update-lock only if the data change is intended."
            )
        print(f"ok {name}")
    LOCK.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
