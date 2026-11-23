"""earth3d 数据预处理的公共配置。

所有原始下载进 src/earth3d/.cache/，所有渲染用产物进 src/earth3d/assets/。
两个目录都不提交，随时可以删掉后用 build_all.py 重建。
"""

from __future__ import annotations

import math
import os
from pathlib import Path

EARTH3D = Path(__file__).resolve().parents[1]
CACHE = EARTH3D / ".cache"
# 设置 EARTH3D_ASSETS 可以把输出写到别的目录（例如验证重建结果时）
ASSETS = Path(os.environ["EARTH3D_ASSETS"]) if os.environ.get("EARTH3D_ASSETS") else EARTH3D / "assets"

DEM_CACHE = CACHE / "dem"
LANDCOVER_CACHE = CACHE / "landcover"
VECTOR_CACHE = CACHE / "vector"
TILE_OUT = ASSETS / "tiles"

DEM_URL = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"
WORLDCOVER_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
)
WORLDCOVER_GRID_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/esa_worldcover_grid.geojson"
)
VECTOR_SOURCES = {
    "hydrorivers_as": "https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_as_shp.zip",
    "hydrorivers_si": "https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_si_shp.zip",
    "ne_lakes": "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip",
    "ne_ocean": "https://naciscdn.org/naturalearth/10m/physical/ne_10m_ocean.zip",
    "ne_places": "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip",
}

# 全球统一铺到 GLOBAL_MAX_ZOOM；战区范围继续细分到 THEATER_MAX_ZOOM。
# 两者用同一套数据源、同一套处理，只是网格细分程度不同。
GLOBAL_MAX_ZOOM = 5
THEATER_MAX_ZOOM = 9
# 西, 南, 东, 北：覆盖 1931-1945 中国战场、朝鲜半岛和日本本土。
THEATER_BOUNDS = (97.0, 18.0, 146.0, 54.0)

# 每个分块的网格是 grid x grid 个角点（共享边界），地表分类是 CLASS_RES x CLASS_RES。
# 最细一级用满高程数据本身的分辨率（256 像素 => 257 个角点），其余各级 129。
GRID = 129
FINEST_GRID = 257
CLASS_RES = 256


def grid_for_zoom(z: int) -> int:
    return FINEST_GRID if z >= THEATER_MAX_ZOOM else GRID


MAX_MERCATOR_LAT = 85.0511287798066


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 1 << z
    west = x / n * 360.0 - 180.0
    east = (x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return west, south, east, north


def lonlat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 1 << z
    lat = max(min(lat, MAX_MERCATOR_LAT), -MAX_MERCATOR_LAT)
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def theater_tiles(z: int) -> list[tuple[int, int]]:
    west, south, east, north = THEATER_BOUNDS
    x0, y0 = lonlat_to_tile(west, north, z)
    x1, y1 = lonlat_to_tile(east, south, z)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


def all_tiles() -> list[tuple[int, int, int]]:
    """渲染要用到的全部分块：全球 0..GLOBAL_MAX_ZOOM，战区再到 THEATER_MAX_ZOOM。"""
    tiles = [
        (z, x, y)
        for z in range(GLOBAL_MAX_ZOOM + 1)
        for x in range(1 << z)
        for y in range(1 << z)
    ]
    for z in range(GLOBAL_MAX_ZOOM + 1, THEATER_MAX_ZOOM + 1):
        tiles.extend((z, x, y) for x, y in theater_tiles(z))
    return tiles
