"""把海洋、湖泊栅格化成水域掩码，并计算每个湖泊的水位。

输出到 .cache/masks/：
- theater.npy / global.npy：uint16 掩码，网格与同名地表分类图对齐（global 另用 0.04°）
  0 陆地，1 海洋，2 1937 年后才修建的水库（按陆地处理），3+ 湖泊编号 + 3
- *.json：网格范围
- lakes.json：湖泊名称和水位（米）
"""

from __future__ import annotations

import json

import numpy as np
import shapefile
from rasterio.features import rasterize
from rasterio.transform import from_origin

from config import CACHE, LANDCOVER_CACHE, VECTOR_CACHE
from dem import Dem

MASKS = CACHE / "masks"
GLOBAL_RES = 0.04
HISTORICAL_YEAR = 1937


def read_shapes(name: str) -> list[tuple[dict, dict]]:
    path = next((VECTOR_CACHE / name).rglob("*.shp"))
    reader = shapefile.Reader(str(path), encoding="utf-8")
    fields = [field[0] for field in reader.fields[1:]]
    return [(dict(zip(fields, record)), shape.__geo_interface__)
            for record, shape in zip(reader.iterRecords(), reader.iterShapes())]


def build_grid(label: str, west: float, north: float, res: float, cols: int, rows: int,
               ocean: list[dict], reservoirs: list[dict], lakes: list[dict]) -> np.ndarray:
    transform = from_origin(west, north, res, res)
    shapes = [(geometry, 1) for geometry in ocean]
    shapes += [(geometry, 2) for geometry in reservoirs]
    shapes += [(geometry, 3 + index) for index, geometry in enumerate(lakes)]
    mask = rasterize(shapes, out_shape=(rows, cols), transform=transform, fill=0, dtype="uint16")
    np.save(MASKS / f"{label}.npy", mask)
    meta = {"west": west, "north": north, "res": res, "cols": cols, "rows": rows}
    (MASKS / f"{label}.json").write_text(json.dumps(meta), encoding="utf-8")
    print(f"{label}: {cols}x{rows}, ocean {np.mean(mask == 1):.3f}, lakes {np.mean(mask >= 3):.4f}")
    return mask


def lake_levels(mask: np.ndarray, meta: dict, zoom: int, count: int, dem: Dem,
                levels: list[list[float]]) -> None:
    rows, cols = np.nonzero(mask >= 3)
    codes = mask[rows, cols] - 3
    order = np.argsort(codes, kind="stable")
    rows, cols, codes = rows[order], cols[order], codes[order]
    starts = np.searchsorted(codes, np.arange(count))
    ends = np.searchsorted(codes, np.arange(count), side="right")
    rng = np.random.default_rng(0)
    for index in range(count):
        start, end = starts[index], ends[index]
        if end <= start:
            continue
        pick = rng.choice(np.arange(start, end), size=min(400, end - start), replace=False)
        lon = meta["west"] + (cols[pick] + 0.5) * meta["res"]
        lat = meta["north"] - (rows[pick] + 0.5) * meta["res"]
        heights = dem.sample_lonlat(zoom, lon, lat)
        levels[index].append(float(np.median(heights)))


def shore_level(geometry: dict, zoom: int, dem: Dem) -> float | None:
    """取湖泊外轮廓上各点高程的 15% 分位数。"""
    if geometry["type"] == "Polygon":
        exteriors = [geometry["coordinates"][0]]
    else:
        exteriors = [polygon[0] for polygon in geometry["coordinates"]]
    points = np.array([point for ring in exteriors for point in ring], dtype=np.float64)
    if len(points) == 0:
        return None
    if len(points) > 600:
        points = points[np.linspace(0, len(points) - 1, 600).astype(int)]
    heights = dem.sample_lonlat(zoom, points[:, 0], points[:, 1])
    return float(np.percentile(heights, 15))


def main() -> None:
    MASKS.mkdir(parents=True, exist_ok=True)
    ocean = [geometry for _, geometry in read_shapes("ne_ocean")]
    reservoirs, lakes, lake_names = [], [], []
    for record, geometry in read_shapes("ne_lakes"):
        year = int(record.get("year") or -99)
        if record["featurecla"] == "Reservoir" and not (0 < year <= HISTORICAL_YEAR):
            reservoirs.append(geometry)
        else:
            lakes.append(geometry)
            lake_names.append(record.get("name_zh") or record.get("name") or "")
    print(f"lakes {len(lakes)}, excluded reservoirs {len(reservoirs)}")

    theater_meta = json.loads((LANDCOVER_CACHE / "theater.json").read_text(encoding="utf-8"))
    res = (theater_meta["east"] - theater_meta["west"]) / theater_meta["cols"]
    theater = build_grid("theater", theater_meta["west"], theater_meta["north"], res,
                         theater_meta["cols"], theater_meta["rows"], ocean, reservoirs, lakes)
    global_mask = build_grid("global", -180.0, 90.0, GLOBAL_RES, int(360 / GLOBAL_RES),
                             int(180 / GLOBAL_RES), ocean, reservoirs, lakes)

    dem = Dem()
    levels: list[list[float]] = [[] for _ in lakes]
    lake_levels(theater, {"west": theater_meta["west"], "north": theater_meta["north"], "res": res},
                9, len(lakes), dem, levels)
    global_levels: list[list[float]] = [[] for _ in lakes]
    lake_levels(global_mask, {"west": -180.0, "north": 90.0, "res": GLOBAL_RES}, 5, len(lakes),
                dem, global_levels)
    result = []
    for index, name in enumerate(lake_names):
        # 战区内的湖用第 9 级高程定水位，战区外用第 5 级
        in_theater = bool(levels[index])
        chosen = levels[index] or global_levels[index] or [0.0]
        level = chosen[0]
        # 有些湖的高程数据带湖底深度（如太湖），湖内中位数会偏低；这时改用岸线高程的低分位
        shore = shore_level(lakes[index], 9 if in_theater else 5, dem)
        if shore is not None and level < shore - 10:
            level = shore
        result.append({"name": name, "level": round(level, 1)})
    (MASKS / "lakes.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print("masks done")


if __name__ == "__main__":
    main()
