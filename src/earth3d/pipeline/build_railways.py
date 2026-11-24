"""生成 1930 年代铁路：assets/railways.bin（线路几何，带地面高度）和 assets/railways.json（线路、区段、通车日期、经营方）。

线路和车站来自 railways_source.py（人工整理）。相邻车站之间沿 Natural Earth 10m 现代铁路网找最短路径，
得到实际的线路走向（干线走廊百年来基本没变）；车站 20 公里内没有现代铁路、或路径比直线长 35% 以上
（现代路网绕路、或那一段早已改线）时，退回车站之间的直线。每段路径都在日志里标明是“沿路网”还是“直线”。

Natural Earth 铁路数据单独锁定在 railways.lock.json（与 fetch_vectors.py 相同的核对方式），
新增这份数据不会改变其他步骤的指纹。
"""

from __future__ import annotations

import gzip
import heapq
import json
import math
from pathlib import Path

import numpy as np
import shapefile

from config import ASSETS, THEATER_BOUNDS, VECTOR_CACHE
from dem import Dem
from fetch_vectors import complete, fetch, file_hashes
from fsutil import write_bytes, write_text
from railways_source import LINES

RAIL_NAME = "ne_railroads"
RAIL_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_railroads.zip"
LOCK = Path(__file__).with_name("railways.lock.json")
BBOX = (95.0, 15.0, 146.0, 55.0)
SNAP_KM = 20.0
JOIN_KM = 1.5
DETOUR = 1.35
MAX_STEP_KM = 2.0


def km(lon0: float, lat0: float, lon1: float, lat1: float) -> float:
    p0, p1 = math.radians(lat0), math.radians(lat1)
    dp, dl = p1 - p0, math.radians(lon1 - lon0)
    a = math.sin(dp / 2) ** 2 + math.cos(p0) * math.cos(p1) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(min(1.0, math.sqrt(a)))


def ensure_source() -> Path:
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    target = VECTOR_CACHE / RAIL_NAME
    if not complete(target, RAIL_NAME, lock):
        fetch(RAIL_NAME, RAIL_URL, lock, False)
    if RAIL_NAME not in lock:
        lock[RAIL_NAME] = {"url": RAIL_URL, "files": file_hashes(target)}
        LOCK.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return next(target.rglob("*.shp"))


class Network:
    """现代铁路网：顶点为节点，折线相邻点为边；端点相距 JOIN_KM 内的互相连通。"""

    def __init__(self, path: Path) -> None:
        self.coords: list[tuple[float, float]] = []
        self.index: dict[tuple[float, float], int] = {}
        self.edges: list[list[tuple[int, float]]] = []
        self.grid: dict[tuple[int, int], list[int]] = {}
        endpoints: list[int] = []
        west, south, east, north = BBOX
        for shape in shapefile.Reader(str(path)).shapes():
            parts = list(shape.parts) + [len(shape.points)]
            for a, b in zip(parts[:-1], parts[1:]):
                points = shape.points[a:b]
                if not any(west <= x <= east and south <= y <= north for x, y in points):
                    continue
                ids = [self.node(x, y) for x, y in points]
                for i, j in zip(ids[:-1], ids[1:]):
                    if i != j:
                        self.link(i, j)
                endpoints += [ids[0], ids[-1]]
        for i in endpoints:
            for j in self.near(*self.coords[i], JOIN_KM):
                if j != i:
                    self.link(i, j)

    def node(self, x: float, y: float) -> int:
        key = (round(x, 4), round(y, 4))
        found = self.index.get(key)
        if found is not None:
            return found
        n = len(self.coords)
        self.index[key] = n
        self.coords.append(key)
        self.edges.append([])
        self.grid.setdefault((int(math.floor(x * 10)), int(math.floor(y * 10))), []).append(n)
        return n

    def link(self, i: int, j: int) -> None:
        d = km(*self.coords[i], *self.coords[j])
        self.edges[i].append((j, d))
        self.edges[j].append((i, d))

    def near(self, x: float, y: float, radius_km: float) -> list[int]:
        reach = int(math.ceil(radius_km / 11.0)) + 1
        cx, cy = int(math.floor(x * 10)), int(math.floor(y * 10))
        found = []
        for gx in range(cx - reach, cx + reach + 1):
            for gy in range(cy - reach, cy + reach + 1):
                for n in self.grid.get((gx, gy), []):
                    if km(x, y, *self.coords[n]) <= radius_km:
                        found.append(n)
        return found

    def snap(self, x: float, y: float) -> int | None:
        candidates = self.near(x, y, SNAP_KM)
        return min(candidates, key=lambda n: km(x, y, *self.coords[n])) if candidates else None

    def route(self, a: int, b: int, limit_km: float) -> list[int] | None:
        """a 到 b 的最短路径；超过 limit_km 就放弃。"""
        best = {a: 0.0}
        previous: dict[int, int] = {}
        heap = [(0.0, a)]
        while heap:
            d, n = heapq.heappop(heap)
            if n == b:
                path = [b]
                while path[-1] != a:
                    path.append(previous[path[-1]])
                return path[::-1]
            if d > best.get(n, math.inf) or d > limit_km:
                continue
            for m, w in self.edges[n]:
                nd = d + w
                if nd < best.get(m, math.inf):
                    best[m] = nd
                    previous[m] = n
                    heapq.heappush(heap, (nd, m))
        return None


def densify(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    dense = [points[0]]
    for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
        steps = max(1, math.ceil(km(x0, y0, x1, y1) / MAX_STEP_KM))
        dense += [(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps) for s in range(1, steps + 1)]
    return dense


def main() -> None:
    network = Network(ensure_source())
    print(f"modern network: {len(network.coords)} nodes", flush=True)
    dem = Dem(capacity=1500)
    west, south, east, north = THEATER_BOUNDS

    meta_lines = []
    offsets = [0]
    section_ids: list[int] = []
    lons, lats, heights = [], [], []
    routed_km = straight_km = 0.0
    for line in LINES:
        sections = []
        for section in line["sections"]:
            stations = section["stations"]
            snapped = [network.snap(x, y) for _, x, y in stations]
            anchor = [network.coords[s] if s is not None else (x, y) for s, (_, x, y) in zip(snapped, stations)]
            points: list[tuple[float, float]] = [anchor[0]]
            how = []
            for k in range(len(stations) - 1):
                a, b = snapped[k], snapped[k + 1]
                direct = km(*anchor[k], *anchor[k + 1])
                path = network.route(a, b, direct * DETOUR + 15) if a is not None and b is not None else None
                if path:
                    points += [network.coords[n] for n in path[1:]]
                    routed_km += direct
                    how.append("网")
                else:
                    points.append(anchor[k + 1])
                    straight_km += direct
                    how.append("直")
            dense = np.array(densify(points))
            inside = ((dense[:, 0] >= west) & (dense[:, 0] <= east) & (dense[:, 1] >= south) & (dense[:, 1] <= north))
            height = np.where(inside, dem.sample_lonlat(9, dense[:, 0], dense[:, 1]),
                              dem.sample_lonlat(5, dense[:, 0], dense[:, 1]))
            index = len(section_ids)
            section_ids.append(index)
            lons.append(dense[:, 0])
            lats.append(dense[:, 1])
            heights.append(np.maximum(height, 0))
            offsets.append(offsets[-1] + len(dense))
            sections.append({
                "geometry": index,
                "opened": section["opened"],
                **({"approx": True} if section.get("approx") else {}),
                "stations": [[name, round(x, 4), round(y, 4)] for (name, _, _), (x, y) in zip(stations, anchor)],
            })
            print(f"  {line['name']} {stations[0][0]}—{stations[-1][0]}: {''.join(how)}", flush=True)
        meta_lines.append({
            "id": line["id"], "name": line["name"], **({"names": line["names"]} if line.get("names") else {}),
            "owner": line["owner"], "sections": sections,
        })

    header = np.array([len(section_ids), offsets[-1]], dtype="<u4")
    payload = (header.tobytes() + np.array(offsets, dtype="<u4").tobytes()
               + np.array(section_ids, dtype="<u4").tobytes()
               + np.concatenate(lons).astype("<f4").tobytes()
               + np.concatenate(lats).astype("<f4").tobytes()
               + np.concatenate(heights).astype("<f4").tobytes())
    write_bytes(ASSETS / "railways.bin", gzip.compress(payload, 6, mtime=0))
    write_text(ASSETS / "railways.json", json.dumps({"lines": meta_lines}, ensure_ascii=False, indent=1) + "\n")
    total = routed_km + straight_km
    print(f"railways: {len(meta_lines)} lines, {len(section_ids)} sections, {offsets[-1]} vertices; "
          f"{routed_km / total:.0%} of station-to-station distance follows the modern network")


if __name__ == "__main__":
    main()
