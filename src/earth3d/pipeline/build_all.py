"""按顺序跑完 earth3d 的全部数据预处理，最后与 assets.sha256 逐个文件核对。
每一步都能断点续跑。

用法（在 src/earth3d/pipeline 下）：
    ../.cache/venv/Scripts/python.exe build_all.py
"""

from __future__ import annotations

import subprocess
import sys

STEPS = [
    "fetch_dem.py",
    "fetch_vectors.py",
    "fetch_landcover.py",
    "build_cities.py",
    "build_masks.py",
    "build_rivers.py",
    "build_borders.py",
    "build_tiles.py",
]


def main() -> None:
    for step in STEPS:
        print(f"== {step}", flush=True)
        subprocess.run([sys.executable, step], check=True)
    print("== manifest.py verify", flush=True)
    result = subprocess.run([sys.executable, "manifest.py", "verify"])
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
