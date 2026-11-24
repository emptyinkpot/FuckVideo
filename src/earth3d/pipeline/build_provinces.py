"""生成全球地块系统：assets/provinces-*.bin（地块编号图）、provinces-borders.bin（地块边界线）、provinces.json（地块信息）。

参考 Paradox 游戏的 province map：全世界切成固定的地块，每个日期只需要一张“地块 -> 领有者、控制者”的对照表
（前端 map/provinceStore.ts），国家层按表涂色，国界、前线从地块边界里挑出两侧不同的画成贴地线。

地块来源：
- 中国大陆：geoBoundaries CHN ADM2（2391 个县级单位，来源中国国家测绘地理信息局，PDDL 公有领域）；
- 世界其他地方（含台湾、香港、澳门）：Natural Earth 10m 一级行政区（省、州）。
每个地块另记：代表点、面积、所在的现代中国省份（只对中国、台港澳）、1930 / 1938 / 1945 年历史世界底图
（historical-basemaps，GPL-3.0）里所属的国家（NAME）和宗主国（SUBJECTO）。

两张编号图（uint16，0 为海洋、范围外）：
- 全球：经度 -180~180、纬度 -60~84，约 10 公里一像素；
- 东亚：经度 70~150、纬度 15~56，0.02°（约 2.2 公里）一像素。
不同来源的边界之间会有细缝：陆地上的空白按相邻地块补上，海上不补（国界线不会伸到海面上）。

地块边界线：从编号图里抽出相邻两个像素属于不同地块的边（海岸线不算），按地块对连成折线，
简化（Douglas–Peucker，去掉像素台阶）、平滑（Chaikin）后每 2 公里取一次地面高度。东亚范围内用东亚图，范围外用全球图。
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import requests
import shapefile
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from config import ASSETS, CACHE, EARTH3D, THEATER_BOUNDS, VECTOR_CACHE
from dem import Dem
from fsutil import write_bytes, write_text

HERE = Path(__file__).resolve().parent
LOCK = HERE / "provinces.lock.json"
DOWNLOADS = CACHE / "provinces"
BASEMAPS = "https://raw.githubusercontent.com/aourednik/historical-basemaps/d7cc908e67e136674129ba8444a3a7f2e0835bb4/geojson"
SOURCES = {
    "chn-adm2.geojson": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/CHN/ADM2/geoBoundaries-CHN-ADM2_simplified.geojson",
    "ne-admin1.zip": "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip",
    "world-1930.geojson": f"{BASEMAPS}/world_1930.geojson",
    "world-1938.geojson": f"{BASEMAPS}/world_1938.geojson",
    "world-1945.geojson": f"{BASEMAPS}/world_1945.geojson",
}
YEARS = ["1930", "1938", "1945"]

GLOBAL = {"west": -180.0, "south": -60.0, "east": 180.0, "north": 84.0, "width": 4096}
DETAIL = {"west": 70.0, "south": 15.0, "east": 150.0, "north": 56.0, "width": 4000}
GAP_PX = 6
MAX_STEP_KM = 2.0


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fetch_sources() -> dict[str, Path]:
    """下载（已有就跳过），核对 provinces.lock.json 里的校验值；第一次运行时写入校验值。"""
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    paths = {}
    for name, url in SOURCES.items():
        path = DOWNLOADS / name
        if not path.exists():
            print(f"download {name} ...", flush=True)
            for attempt in range(1, 7):
                try:
                    response = requests.get(url, timeout=300)
                    response.raise_for_status()
                    break
                except requests.RequestException as error:
                    if attempt == 6:
                        raise
                    print(f"  {name}: {error}，{10 * attempt} 秒后重试", flush=True)
                    time.sleep(10 * attempt)
            write_bytes(path, response.content)
        digest = sha256(path)
        if name in lock and lock[name]["sha256"] != digest:
            raise SystemExit(f"{name} 与 provinces.lock.json 不一致（{url}），数据源可能更新了；原有文件未改动。")
        lock.setdefault(name, {"url": url, "sha256": digest})
        paths[name] = path
    LOCK.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    return paths


def read_ne_admin1(path: Path):
    import zipfile

    folder = DOWNLOADS / "ne-admin1"
    if not any(folder.glob("*.shp")):
        with zipfile.ZipFile(path) as archive:
            archive.extractall(folder)
    reader = shapefile.Reader(str(next(folder.glob("*.shp"))), encoding="utf-8")
    for record, geometry in zip(reader.records(), reader.shapes()):
        yield record.as_dict(), shape(geometry.__geo_interface__)


def raster_grid(spec: dict) -> tuple[int, int, object]:
    width = spec["width"]
    height = round(width * (spec["north"] - spec["south"]) / (spec["east"] - spec["west"]))
    return width, height, from_bounds(spec["west"], spec["south"], spec["east"], spec["north"], width, height)


def fill_gaps(ids: np.ndarray, land: np.ndarray) -> None:
    """陆地上的空白按相邻地块补上（最多 GAP_PX 像素），海上不补。"""
    for _ in range(GAP_PX):
        empty = (ids == 0) & land
        if not empty.any():
            break
        candidate = np.zeros_like(ids)
        for shift, axis in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
            rolled = np.roll(ids, shift, axis=axis)
            candidate = np.where((candidate == 0) & (rolled != 0), rolled, candidate)
        ids[empty] = candidate[empty]


def boundary_lines(ids: np.ndarray, spec: dict, height: int, skip=None) -> dict[tuple[int, int], list]:
    """相邻像素属于不同地块（都不是 0）的边，按地块对连成折线（像素角点坐标）。"""
    segments: dict[tuple[int, int], list] = defaultdict(list)
    # 左右相邻：竖直边 (x+1, y)-(x+1, y+1)
    a, b = ids[:, :-1], ids[:, 1:]
    ys, xs = np.nonzero((a != b) & (a != 0) & (b != 0))
    for y, x in zip(ys.tolist(), xs.tolist()):
        p, q = int(a[y, x]), int(b[y, x])
        segments[(min(p, q), max(p, q))].append(((x + 1, y), (x + 1, y + 1)))
    # 上下相邻：水平边 (x, y+1)-(x+1, y+1)
    a, b = ids[:-1, :], ids[1:, :]
    ys, xs = np.nonzero((a != b) & (a != 0) & (b != 0))
    for y, x in zip(ys.tolist(), xs.tolist()):
        p, q = int(a[y, x]), int(b[y, x])
        segments[(min(p, q), max(p, q))].append(((x, y + 1), (x + 1, y + 1)))

    lines: dict[tuple[int, int], list] = {}
    for pair, edges in segments.items():
        neighbors: dict[tuple, list] = defaultdict(list)
        for u, v in edges:
            neighbors[u].append(v)
            neighbors[v].append(u)
        used: set = set()
        chains = []
        # 先从端点（度数不为 2）出发，再处理闭合环
        starts = [p for p, n in neighbors.items() if len(n) != 2] + list(neighbors)
        for start in starts:
            for nxt in neighbors[start]:
                key = (min(start, nxt), max(start, nxt))
                if key in used:
                    continue
                chain = [start]
                prev, cur = start, nxt
                used.add(key)
                while True:
                    chain.append(cur)
                    options = [n for n in neighbors[cur] if (min(cur, n), max(cur, n)) not in used]
                    if len(neighbors[cur]) != 2 or not options:
                        break
                    prev, cur = cur, options[0]
                    used.add((min(prev, cur), max(prev, cur)))
                if len(chain) >= 2:
                    chains.append(chain)
        lines[pair] = chains
    return lines


def chaikin(points: list, rounds: int = 2) -> list:
    for _ in range(rounds):
        if len(points) < 3:
            return points
        out = [points[0]]
        for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
            out.append((0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1))
            out.append((0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1))
        out.append(points[-1])
        points = out
    return points


def simplify(points: list, tolerance: float) -> list:
    """Douglas–Peucker。"""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        (x0, y0), (x1, y1) = points[i], points[j]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy) or 1e-9
        best, index = 0.0, -1
        for k in range(i + 1, j):
            x, y = points[k]
            distance = abs(dy * (x - x0) - dx * (y - y0)) / length
            if distance > best:
                best, index = distance, k
        if best > tolerance and index > 0:
            keep[index] = True
            stack += [(i, index), (index, j)]
    return [p for p, k in zip(points, keep) if k]


def to_lonlat(points: list, spec: dict, height: int) -> list:
    sx = (spec["east"] - spec["west"]) / spec["width"]
    sy = (spec["north"] - spec["south"]) / height
    return [(spec["west"] + x * sx, spec["north"] - y * sy) for x, y in points]


def km(lon0: float, lat0: float, lon1: float, lat1: float) -> float:
    return math.hypot((lon1 - lon0) * 111.32 * math.cos(math.radians((lat0 + lat1) / 2)), (lat1 - lat0) * 110.57)


def densify(points: list) -> list:
    dense = [points[0]]
    for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
        steps = max(1, math.ceil(km(x0, y0, x1, y1) / MAX_STEP_KM))
        dense += [(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps) for s in range(1, steps + 1)]
    return dense


def main() -> None:
    paths = fetch_sources()

    # ---------- 地块 ----------
    provinces: list[dict] = []
    geometries = []
    china = json.loads(paths["chn-adm2.geojson"].read_text(encoding="utf-8"))
    for feature in china["features"]:
        geometry = shape(feature["geometry"]).buffer(0)
        if geometry.is_empty:
            continue
        provinces.append({"name": feature["properties"]["shapeName"], "src": "cn", "country": "China"})
        geometries.append(geometry)
    for record, geometry in read_ne_admin1(paths["ne-admin1.zip"]):
        if record["adm0_a3"] == "CHN":
            continue
        geometry = geometry.buffer(0)
        if geometry.is_empty:
            continue
        provinces.append({"name": record["name_zh"] or record["name"], "src": "ne", "country": record["admin"]})
        geometries.append(geometry)
    print(f"provinces: {len(provinces)}", flush=True)

    # 代表点、面积、现代中国省份
    cn_provinces = json.loads((EARTH3D / "data" / "china-provinces.geojson").read_text(encoding="utf-8"))["features"]
    cn_shapes = [shape(f["geometry"]).buffer(0) for f in cn_provinces]
    cn_tree = STRtree(cn_shapes)
    for province, geometry in zip(provinces, geometries):
        point = geometry.representative_point()
        lat = point.y
        province["lon"] = round(point.x, 4)
        province["lat"] = round(lat, 4)
        province["areaKm2"] = round(geometry.area * 111.32 * 110.57 * math.cos(math.radians(lat)))
        hits = [i for i in cn_tree.query(point) if cn_shapes[i].contains(point)]
        if hits and (province["src"] == "cn" or province["country"] in ("Taiwan", "Hong Kong S.A.R.", "Macao S.A.R", "Macau S.A.R")):
            province["cn"] = cn_provinces[hits[0]]["properties"]["name"]

    # 历史世界底图：所属国家、宗主国（找不到包含它的，取 50 公里内最近的）
    names: list[str] = []
    name_index: dict[str, int] = {}

    def intern(value) -> int:
        text = str(value) if value else ""
        if text not in name_index:
            name_index[text] = len(names)
            names.append(text)
        return name_index[text]

    for year in YEARS:
        world = json.loads(paths[f"world-{year}.geojson"].read_text(encoding="utf-8"))["features"]
        shapes = [shape(f["geometry"]).buffer(0) for f in world]
        tree = STRtree(shapes)
        for province in provinces:
            point = Point(province["lon"], province["lat"])
            hits = [i for i in tree.query(point) if shapes[i].contains(point)]
            if not hits:
                near = tree.query_nearest(point, max_distance=0.5)
                hits = list(near)
            if hits:
                props = world[hits[0]]["properties"]
                province.setdefault("hist", {})[year] = [intern(props.get("NAME")), intern(props.get("SUBJECTO") or props.get("NAME"))]
            else:
                province.setdefault("hist", {})[year] = [0, 0]

    # ---------- 编号图 ----------
    ocean_path = next((VECTOR_CACHE / "ne_ocean").rglob("*.shp"))
    ocean = [shape(s.__geo_interface__) for s in shapefile.Reader(str(ocean_path)).shapes()]
    shapes_with_id = [(geometry, index + 1) for index, geometry in enumerate(geometries)]
    rasters = {}
    for label, spec in (("global", GLOBAL), ("detail", DETAIL)):
        width, height, transform = raster_grid(spec)
        ids = rasterize(shapes_with_id, out_shape=(height, width), transform=transform, fill=0, dtype="uint16")
        sea = rasterize([(g, 1) for g in ocean], out_shape=(height, width), transform=transform, fill=0, dtype="uint8")
        fill_gaps(ids, sea == 0)
        rasters[label] = (ids, spec, height)
        header = np.array([width, height], dtype="<u4").tobytes() + np.array(
            [spec["west"], spec["south"], spec["east"], spec["north"]], dtype="<f4").tobytes()
        write_bytes(ASSETS / f"provinces-{label}.bin", gzip.compress(header + ids.astype("<u2").tobytes(), 6, mtime=0))
        print(f"{label}: {width}x{height}, filled {(ids > 0).mean():.3f}", flush=True)

    # ---------- 地块边界线 ----------
    dem = Dem(capacity=1500)
    west, south, east, north = THEATER_BOUNDS
    offsets = [0]
    pairs: list[int] = []
    lons, lats, heights = [], [], []
    d = DETAIL
    for label in ("detail", "global"):
        ids, spec, height = rasters[label]
        pixel_deg = (spec["east"] - spec["west"]) / spec["width"]
        for (p, q), chains in boundary_lines(ids, spec, height).items():
            for chain in chains:
                # 先简化掉像素台阶，再平滑成曲线：反过来做会留下许多小折角，线外的光晕会在折角处扎出毛刺
                points = to_lonlat(chaikin(simplify(chain, 0.7), 3), spec, height)
                if label == "global":
                    # 东亚范围内用东亚图的边界；全球图只补范围外
                    mx = sum(x for x, _ in points) / len(points)
                    my = sum(y for _, y in points) / len(points)
                    if d["west"] + pixel_deg < mx < d["east"] - pixel_deg and d["south"] + pixel_deg < my < d["north"] - pixel_deg:
                        continue
                dense = np.array(densify(points))
                inside = (dense[:, 0] >= west) & (dense[:, 0] <= east) & (dense[:, 1] >= south) & (dense[:, 1] <= north)
                h = np.where(inside, dem.sample_lonlat(9, dense[:, 0], dense[:, 1]), dem.sample_lonlat(5, dense[:, 0], dense[:, 1]))
                lons.append(dense[:, 0])
                lats.append(dense[:, 1])
                heights.append(np.maximum(h, 0))
                offsets.append(offsets[-1] + len(dense))
                pairs.append(p | (q << 16))
    count = len(pairs)
    payload = (np.array([count, offsets[-1]], dtype="<u4").tobytes() + np.array(offsets, dtype="<u4").tobytes()
               + np.array(pairs, dtype="<u4").tobytes()
               + np.concatenate(lons).astype("<f4").tobytes()
               + np.concatenate(lats).astype("<f4").tobytes()
               + np.concatenate(heights).astype("<f4").tobytes())
    write_bytes(ASSETS / "provinces-borders.bin", gzip.compress(payload, 6, mtime=0))
    print(f"borders: {count} lines, {offsets[-1]} vertices", flush=True)

    meta = {
        "names": names,
        "provinces": [
            {k: v for k, v in p.items() if k in ("name", "src", "country", "cn", "lon", "lat", "areaKm2", "hist")}
            for p in provinces
        ],
    }
    write_text(ASSETS / "provinces.json", json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("provinces done")


if __name__ == "__main__":
    main()
