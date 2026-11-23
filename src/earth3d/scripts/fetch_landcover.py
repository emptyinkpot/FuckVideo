"""从 ESA WorldCover 2021（10m，云端 COG）读取降采样后的地表分类，拼成两张马赛克。

- global.npy：全球，约 0.0133° 一格，供 0..GLOBAL_MAX_ZOOM 级分块用
- theater.npy：战区，3/1125° 一格（约 290m），供更细的分块用

两张图用的是同一个数据源、同一套分类，只是采样密度不同。
只通过 HTTP 区段请求读取 COG 的缩略层级，不下载 10m 原始数据。
分类码沿用 WorldCover：10 林地 20 灌丛 30 草地 40 耕地 50 建成区 60 裸地
70 冰雪 80 水体 90 湿地 95 红树林 100 苔原；0 表示无数据（海洋）。
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import rasterio
import requests
from rasterio.enums import Resampling

from config import LANDCOVER_CACHE, THEATER_BOUNDS, WORLDCOVER_GRID_URL, WORLDCOVER_URL

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "5")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")

READ_PX = 1125  # 每个 3° 瓦片统一读成 1125x1125（约 0.00267°），对应 COG 的 1/32 缩略层
GLOBAL_FACTOR = 5  # 全球图在本地按众数再降 5 倍 => 225 px / 3° ≈ 0.0133°
CLASSES = (10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100)


def tile_names() -> list[str]:
    path = LANDCOVER_CACHE / "esa_worldcover_grid.geojson"
    if not path.exists():
        LANDCOVER_CACHE.mkdir(parents=True, exist_ok=True)
        response = requests.get(WORLDCOVER_GRID_URL, timeout=120)
        response.raise_for_status()
        path.write_bytes(response.content)
    grid = json.loads(path.read_text(encoding="utf-8"))
    return sorted(feature["properties"]["ll_tile"] for feature in grid["features"])


def parse(name: str) -> tuple[int, int]:
    lat = int(name[1:3]) * (1 if name[0] == "N" else -1)
    lon = int(name[4:7]) * (1 if name[3] == "E" else -1)
    return lon, lat


def mode_downsample(data: np.ndarray, factor: int) -> np.ndarray:
    rows, cols = data.shape[0] // factor, data.shape[1] // factor
    blocks = data[: rows * factor, : cols * factor].reshape(rows, factor, cols, factor)
    best = np.zeros((rows, cols), dtype=np.uint8)
    best_count = np.zeros((rows, cols), dtype=np.int32)
    for value in CLASSES:
        count = (blocks == value).sum(axis=(1, 3))
        better = count > best_count
        best[better] = value
        best_count[better] = count[better]
    return best


def read_tile(name: str, px: int) -> np.ndarray | None:
    full = read_full(name)
    if full is None or px == READ_PX:
        return full
    return mode_downsample(full, READ_PX // px)


def read_full(name: str) -> np.ndarray | None:
    px = READ_PX
    cache = LANDCOVER_CACHE / f"tiles_{px}" / f"{name}.npz"
    if cache.exists():
        try:
            with np.load(cache) as archive:
                return archive["data"]
        except Exception:  # 中断写坏的缓存当作不存在，重新读取
            cache.unlink()
    url = "/vsicurl/" + WORLDCOVER_URL.format(tile=name)
    for attempt in range(6):
        try:
            with rasterio.open(url) as source:
                data = source.read(1, out_shape=(px, px), resampling=Resampling.mode)
            cache.parent.mkdir(parents=True, exist_ok=True)
            tmp = cache.with_suffix(".tmp.npz")
            np.savez_compressed(tmp, data=data)
            tmp.replace(cache)
            return data
        except rasterio.errors.RasterioIOError as error:
            if attempt == 5:
                print(f"  fail {name}: {error}", flush=True)
                return None
            time.sleep(5 * (attempt + 1))
    return None


def build(label: str, names: list[str], bounds: tuple[int, int, int, int], px: int) -> None:
    west, south, east, north = bounds
    cols = (east - west) // 3 * px
    rows = (north - south) // 3 * px
    mosaic = np.zeros((rows, cols), dtype=np.uint8)
    selected = [
        name for name in names
        if west <= parse(name)[0] < east and south <= parse(name)[1] < north
    ]
    print(f"{label}: {len(selected)} WorldCover tiles -> {cols}x{rows}", flush=True)
    failures = 0
    with ThreadPoolExecutor(16) as pool:
        for index, (name, data) in enumerate(
            zip(selected, pool.map(lambda n: read_tile(n, px), selected)), 1
        ):
            if data is None:
                failures += 1
                continue
            lon, lat = parse(name)
            col = (lon - west) // 3 * px
            row = (north - (lat + 3)) // 3 * px
            mosaic[row:row + px, col:col + px] = data
            if index % 200 == 0:
                print(f"  {index}/{len(selected)}", flush=True)
    if failures:
        print(f"{label}: {failures} tiles failed; rerun to retry")
        sys.exit(1)
    np.save(LANDCOVER_CACHE / f"{label}.npy", mosaic)
    meta = {"west": west, "south": south, "east": east, "north": north,
            "cols": cols, "rows": rows}
    (LANDCOVER_CACHE / f"{label}.json").write_text(json.dumps(meta), encoding="utf-8")


def main() -> None:
    names = tile_names()
    west, south, east, north = THEATER_BOUNDS
    theater = (
        int(math.floor(west / 3) * 3), int(math.floor(south / 3) * 3),
        int(math.ceil(east / 3) * 3), int(math.ceil(north / 3) * 3),
    )
    build("theater", names, theater, READ_PX)
    build("global", names, (-180, -90, 180, 90), READ_PX // GLOBAL_FACTOR)
    print("landcover done")


if __name__ == "__main__":
    main()
