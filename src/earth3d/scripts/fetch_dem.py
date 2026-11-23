"""下载 Terrarium 高程瓦片到 .cache/dem/{z}/{x}/{y}.png。

全球 0..GLOBAL_MAX_ZOOM 全部下载；战区各级多下载一圈，供分块边缘取样。
已存在的文件跳过，可以反复运行。
"""

from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

from config import DEM_CACHE, DEM_URL, GLOBAL_MAX_ZOOM, THEATER_MAX_ZOOM, theater_tiles


def wanted() -> list[tuple[int, int, int]]:
    tiles: set[tuple[int, int, int]] = set()
    for z in range(GLOBAL_MAX_ZOOM + 1):
        n = 1 << z
        tiles.update((z, x, y) for x in range(n) for y in range(n))
    for z in range(GLOBAL_MAX_ZOOM + 1, THEATER_MAX_ZOOM + 1):
        n = 1 << z
        for x, y in theater_tiles(z):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if 0 <= y + dy < n:
                        tiles.add((z, (x + dx) % n, y + dy))
    return sorted(tiles)


session = requests.Session()


def fetch(tile: tuple[int, int, int]) -> str:
    z, x, y = tile
    path = DEM_CACHE / str(z) / str(x) / f"{y}.png"
    if path.exists() and path.stat().st_size > 0:
        return "skip"
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(6):
        try:
            response = session.get(DEM_URL.format(z=z, x=x, y=y), timeout=60)
            response.raise_for_status()
            tmp = path.with_suffix(".part")
            tmp.write_bytes(response.content)
            tmp.replace(path)
            return "ok"
        except requests.RequestException as error:
            if attempt == 5:
                return f"fail {tile} {error}"
            time.sleep(5 * (attempt + 1))
    return "fail"


def main() -> None:
    tiles = wanted()
    print(f"DEM tiles wanted: {len(tiles)}", flush=True)
    failures = []
    with ThreadPoolExecutor(24) as pool:
        for index, result in enumerate(pool.map(fetch, tiles), 1):
            if result.startswith("fail"):
                failures.append(result)
            if index % 500 == 0:
                print(f"  {index}/{len(tiles)}", flush=True)
    if failures:
        print("\n".join(failures))
        sys.exit(1)
    print("DEM done")


if __name__ == "__main__":
    main()
