"""下载河流、湖泊、海洋、城市矢量数据到 .cache/vector/<name>/ 并解压。"""

from __future__ import annotations

import io
import zipfile

import requests

from config import VECTOR_CACHE, VECTOR_SOURCES


def main() -> None:
    for name, url in VECTOR_SOURCES.items():
        target = VECTOR_CACHE / name
        if target.exists() and any(target.rglob("*.shp")):
            print(f"skip {name}")
            continue
        print(f"download {name} ...", flush=True)
        response = requests.get(url, timeout=600)
        response.raise_for_status()
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            archive.extractall(target)
        print(f"  {name}: {len(response.content) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
