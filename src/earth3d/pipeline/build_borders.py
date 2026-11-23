"""生成贴地国界线 assets/borders-1938.bin（gzip 压缩的小端二进制）。

来源是 src/earth3d/data/historical-world-1938.geojson（historical-basemaps 的 1938 年世界格局）。
处理步骤：
1. 只保留两个多边形共用的边（真正的国界）；海岸线只属于一个多边形，自然被去掉。
   共用的边只画一份；
2. 再去掉离海洋 3 公里以内的边，处理河口、海峡处两国多边形恰好相接的情况；
3. 每段加密到不超过 2 公里一个点，并按高程数据取地面高度，线条可以贴着山脊起伏。

文件结构与 rivers.bin 相同：
  Uint32 lineCount, Uint32 vertexCount
  Uint32 offsets[lineCount + 1]
  Float32 width[lineCount]（这里全部为 0，宽度由前端按像素给）
  Float32 lon[vertexCount], lat[vertexCount], height[vertexCount]
"""

from __future__ import annotations

import gzip
import json
import math
from pathlib import Path

import numpy as np

from config import ASSETS, CACHE, EARTH3D, THEATER_BOUNDS
from dem import Dem

SOURCE = EARTH3D / "data" / "historical-world-1938.geojson"
MASKS = CACHE / "masks"
MAX_STEP_KM = 2.0
COAST_KM = 3.0


def load_mask(label: str):
    mask = np.load(MASKS / f"{label}.npy", mmap_mode="r")
    meta = json.loads((MASKS / f"{label}.json").read_text(encoding="utf-8"))
    return mask, meta


def near_ocean(lon: float, lat: float, theater, world) -> bool:
    west, south, east, north = THEATER_BOUNDS
    mask, meta = theater if (west <= lon <= east and south <= lat <= north) else world
    reach = max(1, int(math.ceil(COAST_KM / (meta["res"] * 111.0))))
    col = int((lon - meta["west"]) / meta["res"])
    row = int((meta["north"] - lat) / meta["res"])
    r0, r1 = max(0, row - reach), min(meta["rows"], row + reach + 1)
    c0, c1 = max(0, col - reach), min(meta["cols"], col + reach + 1)
    return bool((np.asarray(mask[r0:r1, c0:c1]) == 1).any())


def rings(geometry: dict):
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            yield from polygon


def main() -> None:
    data = json.loads(Path(SOURCE).read_text(encoding="utf-8"))
    theater = load_mask("theater")
    world = load_mask("global")
    def segment_key(lon0: float, lat0: float, lon1: float, lat1: float) -> tuple:
        return tuple(sorted([(round(lon0, 5), round(lat0, 5)), (round(lon1, 5), round(lat1, 5))]))

    counts: dict[tuple, int] = {}
    for feature in data["features"]:
        for ring in rings(feature["geometry"]):
            for (lon0, lat0), (lon1, lat1) in zip(ring[:-1], ring[1:]):
                key = segment_key(lon0, lat0, lon1, lat1)
                counts[key] = counts.get(key, 0) + 1

    seen: set[tuple] = set()
    lines: list[list[tuple[float, float]]] = []
    for feature in data["features"]:
        for ring in rings(feature["geometry"]):
            current: list[tuple[float, float]] = []
            for (lon0, lat0), (lon1, lat1) in zip(ring[:-1], ring[1:]):
                key = segment_key(lon0, lat0, lon1, lat1)
                skip = (counts[key] < 2 or key in seen
                        or near_ocean((lon0 + lon1) / 2, (lat0 + lat1) / 2, theater, world))
                seen.add(key)
                if skip:
                    if len(current) > 1:
                        lines.append(current)
                    current = []
                    continue
                if not current:
                    current = [(lon0, lat0)]
                current.append((lon1, lat1))
            if len(current) > 1:
                lines.append(current)
    print(f"border lines: {len(lines)}")

    dem = Dem(capacity=1500)
    west, south, east, north = THEATER_BOUNDS
    offsets = [0]
    lons, lats, heights = [], [], []
    for line in lines:
        dense: list[tuple[float, float]] = [line[0]]
        for (lon0, lat0), (lon1, lat1) in zip(line[:-1], line[1:]):
            km = math.hypot((lon1 - lon0) * 111.32 * math.cos(math.radians(lat0)), (lat1 - lat0) * 110.57)
            steps = max(1, math.ceil(km / MAX_STEP_KM))
            for s in range(1, steps + 1):
                t = s / steps
                dense.append((lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t))
        points = np.array(dense)
        inside = ((points[:, 0] >= west) & (points[:, 0] <= east) &
                  (points[:, 1] >= south) & (points[:, 1] <= north))
        height = np.where(inside, dem.sample_lonlat(9, points[:, 0], points[:, 1]),
                          dem.sample_lonlat(5, points[:, 0], points[:, 1]))
        lons.append(points[:, 0])
        lats.append(points[:, 1])
        heights.append(np.maximum(height, 0))
        offsets.append(offsets[-1] + len(points))
    header = np.array([len(lines), offsets[-1]], dtype="<u4")
    payload = (header.tobytes() + np.array(offsets, dtype="<u4").tobytes()
               + np.zeros(len(lines), dtype="<f4").tobytes()
               + np.concatenate(lons).astype("<f4").tobytes()
               + np.concatenate(lats).astype("<f4").tobytes()
               + np.concatenate(heights).astype("<f4").tobytes())
    (ASSETS / "borders-1938.bin").write_bytes(gzip.compress(payload, 6, mtime=0))
    print(f"borders: {len(lines)} lines, {offsets[-1]} vertices")


if __name__ == "__main__":
    main()
