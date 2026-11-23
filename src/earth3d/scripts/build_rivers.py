"""生成战区河流 assets/rivers.bin（gzip 压缩的小端二进制）。

数据来自 HydroRIVERS v1.0（亚洲、西伯利亚两区）。保留平均流量 >= MIN_DISCHARGE 的河段，
河宽按水力几何关系 w = 7 * Q^0.5（米）估算并限制在 [25, 2500]。
河道折线先做两轮 Chaikin 平滑（原始数据来自 15 角秒栅格，转弯呈锯齿状），
再沿河道在第 9 级高程上取样，然后沿流向取累积最小值，保证水面不会往下游爬升。
落在海洋或湖泊里的河段删除（那里已经有水面）。

文件结构：
  Uint32 reachCount, Uint32 vertexCount
  Uint32 offsets[reachCount + 1]
  Float32 width[reachCount]
  Float32 lon[vertexCount], lat[vertexCount], height[vertexCount]
"""

from __future__ import annotations

import gzip
import json

import numpy as np
import shapefile

from config import ASSETS, CACHE, THEATER_BOUNDS, VECTOR_CACHE
from dem import Dem

MIN_DISCHARGE = 20.0
MASKS = CACHE / "masks"


def chaikin(lon: np.ndarray, lat: np.ndarray, rounds: int = 2) -> tuple[np.ndarray, np.ndarray]:
    """Chaikin 切角平滑，保留首尾端点，使相连河段仍然接得上。"""
    points = np.stack([lon, lat], axis=1)
    for _ in range(rounds):
        if len(points) < 3:
            break
        a, b = points[:-1], points[1:]
        q = 0.75 * a + 0.25 * b
        r = 0.25 * a + 0.75 * b
        middle = np.empty((len(q) * 2, 2))
        middle[0::2], middle[1::2] = q, r
        points = np.vstack([points[:1], middle[1:-1], points[-1:]])
    return points[:, 0], points[:, 1]


def main() -> None:
    west, south, east, north = THEATER_BOUNDS
    mask = np.load(MASKS / "theater.npy", mmap_mode="r")
    meta = json.loads((MASKS / "theater.json").read_text(encoding="utf-8"))

    def in_water(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        col = np.clip(((lon - meta["west"]) / meta["res"]).astype(np.int64), 0, meta["cols"] - 1)
        row = np.clip(((meta["north"] - lat) / meta["res"]).astype(np.int64), 0, meta["rows"] - 1)
        value = mask[row, col]
        return (value == 1) | (value >= 3)

    dem = Dem(capacity=1500)
    reaches: list[tuple[np.ndarray, np.ndarray, float]] = []
    for region in ("hydrorivers_as", "hydrorivers_si"):
        path = next((VECTOR_CACHE / region).rglob("*.shp"))
        reader = shapefile.Reader(str(path))
        fields = [field[0] for field in reader.fields[1:]]
        discharge_index = fields.index("DIS_AV_CMS")
        for index in range(len(reader)):
            record = reader.record(index)
            discharge = float(record[discharge_index])
            if discharge < MIN_DISCHARGE:
                continue
            shape = reader.shape(index)
            bx0, by0, bx1, by1 = shape.bbox
            if bx1 < west or bx0 > east or by1 < south or by0 > north:
                continue
            points = np.asarray(shape.points, dtype=np.float64)
            if len(points) < 2:
                continue
            width = float(np.clip(7.0 * discharge ** 0.5, 25.0, 2500.0))
            lon, lat = chaikin(points[:, 0], points[:, 1])
            reaches.append((lon, lat, width))
    print(f"reaches kept: {len(reaches)}", flush=True)

    offsets = [0]
    widths, lons, lats, heights = [], [], [], []
    for lon, lat, width in reaches:
        wet = in_water(lon, lat)
        keep = ~(wet & np.roll(wet, 1) & np.roll(wet, -1))
        lon, lat = lon[keep], lat[keep]
        if len(lon) < 2:
            continue
        height = dem.sample_lonlat(9, lon, lat)
        height = np.minimum.accumulate(height)
        lons.append(lon)
        lats.append(lat)
        heights.append(height)
        widths.append(width)
        offsets.append(offsets[-1] + len(lon))
    lon_all = np.concatenate(lons).astype("<f4")
    lat_all = np.concatenate(lats).astype("<f4")
    height_all = np.concatenate(heights).astype("<f4")
    header = np.array([len(widths), len(lon_all)], dtype="<u4")
    payload = (header.tobytes() + np.array(offsets, dtype="<u4").tobytes()
               + np.array(widths, dtype="<f4").tobytes()
               + lon_all.tobytes() + lat_all.tobytes() + height_all.tobytes())
    (ASSETS / "rivers.bin").write_bytes(gzip.compress(payload, 6))
    print(f"rivers: {len(widths)} reaches, {len(lon_all)} vertices")


if __name__ == "__main__":
    main()
