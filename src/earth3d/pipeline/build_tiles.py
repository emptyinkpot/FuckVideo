"""生成渲染分块 assets/tiles/{z}/{x}/{y}.e3d（gzip 压缩的小端二进制）。

每个分块对应一张 Web 墨卡托瓦片的范围，内容依次为：
- Uint16 grid, surfaceRes, normalRes, horizonRes
                                    网格角点数（最细一级 257，其余 129）、地表分类、坡度图、地平线图的分辨率
- Int16  height[(grid+2)*(grid+2)]  地形高度（米），四周各多一圈采样点，用于在边缘计算法线，
                                    让相邻分块的光照连续；湖底和近岸海底已按水域压低
- Int16  water[grid*grid]           水面高度（米），-32768 表示该点没有水
- Uint8  surface[surfaceRes*surfaceRes]  地表类别（见 SURFACE_CODES）
- Uint8  slope[normalRes*normalRes*2]    逐像素向东、向北的坡度（见 relief.py）
- Uint8  horizon[horizonRes*horizonRes*8] 8 个方向的地平线仰角（见 relief.py）
网格点落在瓦片角点上，相邻分块共享边界，不会出现裂缝。
所有分块都走同一套流程，只是网格覆盖的范围大小随级别变化。
"""

from __future__ import annotations

import gzip
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from fsutil import write_bytes, write_text
from config import (ASSETS, CACHE, CLASS_RES, LANDCOVER_CACHE, TILE_OUT, all_tiles, grid_for_zoom)
from dem import TILE, Dem, pixel_lonlat
from relief import HORIZON_RES, NORMAL_RES, relief_payload

NO_WATER = -32768
MASKS = CACHE / "masks"
# WorldCover 类别 -> 渲染用地表类别。1937 年时的城区按我们自己的城市轮廓标记（5），
# WorldCover 里的现代建成区按耕地处理。
SURFACE_CODES = {0: 0, 10: 1, 20: 2, 30: 3, 40: 4, 50: 4, 60: 6, 70: 7, 80: 8, 90: 9,
                 95: 10, 100: 11}
URBAN = 5
LUT = np.zeros(256, dtype=np.uint8)
for source, target in SURFACE_CODES.items():
    LUT[source] = target

_state: dict = {}


def load_state() -> dict:
    if _state:
        return _state
    for label in ("theater", "global"):
        meta = json.loads((LANDCOVER_CACHE / f"{label}.json").read_text(encoding="utf-8"))
        meta["res"] = (meta["east"] - meta["west"]) / meta["cols"]
        _state[f"cover_{label}"] = (np.load(LANDCOVER_CACHE / f"{label}.npy", mmap_mode="r"), meta)
        mask_meta = json.loads((MASKS / f"{label}.json").read_text(encoding="utf-8"))
        _state[f"mask_{label}"] = (np.load(MASKS / f"{label}.npy", mmap_mode="r"), mask_meta)
    lakes = json.loads((MASKS / "lakes.json").read_text(encoding="utf-8"))
    _state["lake_levels"] = np.array([lake["level"] for lake in lakes] + [0.0], dtype=np.float32)
    _state["cities"] = json.loads((ASSETS / "cities.json").read_text(encoding="utf-8"))
    _state["dem"] = Dem()
    return _state


def lookup(grid: tuple[np.ndarray, dict], lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """最近邻取样；返回 (值, 是否落在网格内)。"""
    data, meta = grid
    col = np.floor((lon - meta["west"]) / meta["res"]).astype(np.int64)
    row = np.floor((meta["north"] - lat) / meta["res"]).astype(np.int64)
    inside = (col >= 0) & (col < meta["cols"]) & (row >= 0) & (row < meta["rows"])
    values = np.zeros(lon.shape, dtype=data.dtype)
    if inside.any():
        values[inside] = data[row[inside], col[inside]]
    return values, inside


def sample_grid(kind: str, lon: np.ndarray, lat: np.ndarray, fine: bool) -> np.ndarray:
    state = load_state()
    values, inside = lookup(state[f"{kind}_global"], lon, lat)
    if fine:
        theater_values, theater_inside = lookup(state[f"{kind}_theater"], lon, lat)
        values[theater_inside] = theater_values[theater_inside]
    return values


def surface_grid(z: int, x: int, y: int) -> np.ndarray:
    """CLASS_RES x CLASS_RES 的地表类别；粗级别用 4x4 子样本取众数，避免噪点。"""
    sub = 4 if z <= 7 else 1
    steps = (np.arange(CLASS_RES * sub) + 0.5) / (CLASS_RES * sub)
    gx = (x + steps) * TILE
    gy = (y + steps) * TILE
    px, py = np.meshgrid(gx, gy)
    lon, lat = pixel_lonlat(px, py, z)
    fine = z >= 8
    cover = LUT[sample_grid("cover", lon, lat, fine)]
    mask = sample_grid("mask", lon, lat, fine)
    cover[mask == 1] = 0
    cover[(mask == 2) & (cover == 8)] = 4  # 1937 年还没修的水库：原来是河谷农田
    land_no_data = (cover == 0) & (mask != 1)
    cover[land_no_data & (lat < -60)] = 7
    cover[land_no_data & (lat >= -60)] = 6
    stamp_cities(cover, lon, lat)
    if sub > 1:
        blocks = cover.reshape(CLASS_RES, sub, CLASS_RES, sub)
        best = np.zeros((CLASS_RES, CLASS_RES), dtype=np.uint8)
        best_count = np.zeros((CLASS_RES, CLASS_RES), dtype=np.int32)
        for value in range(12):
            count = (blocks == value).sum(axis=(1, 3))
            better = count > best_count
            best[better] = value
            best_count[better] = count[better]
        cover = best
    return cover


def stamp_cities(cover: np.ndarray, lon: np.ndarray, lat: np.ndarray) -> None:
    west, east = lon.min(), lon.max()
    south, north = lat.min(), lat.max()
    for city in load_state()["cities"]:
        margin = city["radiusKm"] * 1.3 / 100
        if not (west - margin <= city["lon"] <= east + margin and south - margin <= city["lat"] <= north + margin):
            continue
        dx = (lon - city["lon"]) * 111.32 * math.cos(math.radians(city["lat"]))
        dy = (lat - city["lat"]) * 110.57
        distance = np.hypot(dx, dy)
        near = distance < city["radiusKm"] * 1.3
        if not near.any():
            continue
        outline = np.array(city["outline"] + city["outline"][:1], dtype=np.float32)
        angle = (np.arctan2(dy[near], dx[near]) % math.tau) / math.tau * 24
        index = np.floor(angle).astype(np.int64)
        radius = outline[index] * (1 - (angle - index)) + outline[index + 1] * (angle - index)
        inside = distance[near] < radius
        target = cover[near]
        target[inside & (target != 0) & (target != 8)] = URBAN
        cover[near] = target


def height_and_water(z: int, x: int, y: int) -> tuple[np.ndarray, np.ndarray]:
    state = load_state()
    grid = grid_for_zoom(z)
    size = grid + 2
    steps = np.arange(-1, grid + 1) / (grid - 1)
    px, py = np.meshgrid((x + steps) * TILE, (y + steps) * TILE)
    lon, lat = pixel_lonlat(px, py, z)
    height = state["dem"].sample(z, px, py)
    mask = sample_grid("mask", lon, lat, z >= 8).astype(np.int64)
    ocean = mask == 1
    lake = mask >= 3
    levels = state["lake_levels"]
    water = np.full(height.shape, np.nan, dtype=np.float32)
    water[ocean] = 0.0
    water[lake] = levels[np.minimum(mask[lake] - 3, len(levels) - 1)]
    has_water = ~np.isnan(water)
    height = np.where(ocean, np.minimum(height, -3.0), height)
    height = np.where(lake, np.minimum(height, water - 4.0), height)

    # 邻接水域的陆地点：抬到水面以上，并把水面延伸过来，让岸线落在格子中间
    padded = np.pad(np.where(has_water, water, -np.inf), 1, constant_values=-np.inf)
    neighbor = np.full(height.shape, -np.inf, dtype=np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy:
                neighbor = np.maximum(neighbor, padded[1 + dy:1 + dy + size, 1 + dx:1 + dx + size])
    shore = ~has_water & np.isfinite(neighbor)
    height = np.where(shore, np.maximum(height, neighbor + 1.0), height)
    water[shore] = neighbor[shore]
    water = np.where(np.isnan(water), NO_WATER, np.round(water))
    height = np.clip(np.round(height), -12000, 9000)
    return height.astype("<i2"), water[1:-1, 1:-1].astype("<i2")


# build_all.py 传入：早于 EARTH3D_TILES_SINCE（时间戳）的分块是旧源码生成的，需要重建；
# EARTH3D_TILES_REDO 指向一个 json 列表（"z/x/y"），这些分块与校验清单不一致，也要重建。
# 重建都是写临时文件再替换，已有文件在新文件写好之前一直保留。
TILES_SINCE = float(os.environ.get("EARTH3D_TILES_SINCE") or 0)
TILES_REDO = (
    set(json.loads(Path(os.environ["EARTH3D_TILES_REDO"]).read_text(encoding="utf-8")))
    if os.environ.get("EARTH3D_TILES_REDO") else set()
)


def up_to_date(path: Path, key: str) -> bool:
    return path.exists() and key not in TILES_REDO and path.stat().st_mtime >= TILES_SINCE


def build(tile: tuple[int, int, int]) -> str | None:
    z, x, y = tile
    path = TILE_OUT / str(z) / str(x) / f"{y}.e3d"
    if up_to_date(path, f"{z}/{x}/{y}"):
        return None
    height, water = height_and_water(z, x, y)
    surface = surface_grid(z, x, y)
    header = np.array([grid_for_zoom(z), CLASS_RES, NORMAL_RES, HORIZON_RES], dtype="<u2")
    payload = (header.tobytes() + height.tobytes() + water.tobytes() + surface.astype(np.uint8).tobytes()
               + relief_payload(load_state()["dem"], z, x, y))
    path.parent.mkdir(parents=True, exist_ok=True)
    write_bytes(path, gzip.compress(payload, 6, mtime=0))
    return None


def build_column(tiles: list[tuple[int, int, int]]) -> int:
    for tile in tiles:
        build(tile)
    return len(tiles)


def main() -> None:
    tiles = all_tiles()
    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        # 全部重新生成：逐个覆盖，不先删除（子进程从环境变量读取）
        os.environ["EARTH3D_TILES_SINCE"] = str(time.time())
    # 按 (z, x) 分列交给进程，相邻瓦片在同一进程里复用高程缓存
    columns: dict[tuple[int, int], list] = {}
    for z, x, y in tiles:
        columns.setdefault((z, x // 4), []).append((z, x, y))
    jobs = list(columns.values())
    done = 0
    with ProcessPoolExecutor(6) as pool:
        for count in pool.map(build_column, jobs):
            done += count
            if done % 100 < count or done == len(tiles):
                print(f"  {done}/{len(tiles)}", flush=True)
    meta = {
        "surfaceRes": CLASS_RES, "normalRes": NORMAL_RES, "horizonRes": HORIZON_RES, "noWater": NO_WATER,
        "tiles": sorted(f"{z}/{x}/{y}" for z, x, y in tiles),
    }
    write_text(ASSETS / "tiles.json", json.dumps(meta))
    print(f"tiles done: {len(tiles)}")


if __name__ == "__main__":
    main()
