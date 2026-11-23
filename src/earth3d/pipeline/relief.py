"""地形起伏的预计算：逐像素坡度（细法线）和 8 个方向的地平线高度角（投影阴影、环境光遮蔽）。

都在分块所在级别的高程数据上计算，与地形网格同一来源：
- 坡度图：NORMAL_RES x NORMAL_RES，每像素向东、向北的坡度，编码为 atan(坡度) 映射到 0..255。
  比网格顶点细（粗级别分块的网格只有 129 个角点，坡度图用满 256 像素的高程），
  远处的山脊、沟谷在光照上依然锐利。
- 地平线图：HORIZON_RES x HORIZON_RES，每点 8 个方向（北、东北、东……顺时针）向外
  看到的最高地形的仰角，0..63.75° 每 0.25° 一档。搜索距离为半个分块宽（第 9 级约 35 公里），
  计入地球曲率。着色器拿太阳方位、高度和地平线比较得到阴影；8 个方向的 cos² 平均即天空可见度。
"""

from __future__ import annotations

import math

import numpy as np

from dem import TILE, Dem, pixel_lonlat

EARTH_RADIUS_M = 6_371_000.0
NORMAL_RES = 256
HORIZON_RES = 64
HORIZON_STEP_DEG = 0.25
# 顺时针从正北起：dx 向东为正，dy 向南为正（瓦片行号向南增加）
DIRECTIONS = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]


def _tile_width_m(z: int, y: int) -> float:
    """分块在其中线纬度处的东西宽度（米）；墨卡托下南北方向的地面距离与之相同。"""
    n = 1 << z
    lat = math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / n)))
    return 2 * math.pi * EARTH_RADIUS_M * math.cos(lat) / n


def slope_map(dem: Dem, z: int, x: int, y: int) -> np.ndarray:
    """返回 uint8[NORMAL_RES, NORMAL_RES, 2]：向东、向北的坡度。"""
    res = NORMAL_RES
    steps = (np.arange(-1, res + 1) + 0.5) / res
    px, py = np.meshgrid((x + steps) * TILE, (y + steps) * TILE)
    height = np.maximum(dem.sample(z, px, py), 0.0)
    spacing = _tile_width_m(z, y) / res
    east = (height[1:-1, 2:] - height[1:-1, :-2]) / (2 * spacing)
    north = (height[:-2, 1:-1] - height[2:, 1:-1]) / (2 * spacing)
    encode = lambda s: np.clip(np.round((np.arctan(s) / math.pi + 0.5) * 255), 0, 255)
    return np.stack([encode(east), encode(north)], axis=-1).astype(np.uint8)


def horizon_map(dem: Dem, z: int, x: int, y: int) -> np.ndarray:
    """返回 uint8[HORIZON_RES, HORIZON_RES, 8]：8 个方向的地平线仰角。"""
    res = HORIZON_RES
    reach = res // 2  # 向外搜索半个分块
    count = res + 2 * reach
    steps = (np.arange(count) - reach + 0.5) / res
    px, py = np.meshgrid((x + steps) * TILE, (y + steps) * TILE)
    # 海面以下按海面算：水面本身不会挡光
    field = np.maximum(dem.sample(z, px, py), 0.0)
    spacing = _tile_width_m(z, y) / res
    center = field[reach:reach + res, reach:reach + res]
    result = np.zeros((res, res, 8), dtype=np.float32)
    for index, (dx, dy) in enumerate(DIRECTIONS):
        step_m = spacing * math.hypot(dx, dy)
        best = np.zeros((res, res), dtype=np.float32)
        for k in range(1, reach + 1):
            d = step_m * k
            other = field[reach + dy * k:reach + dy * k + res, reach + dx * k:reach + dx * k + res]
            rise = other - center - d * d / (2 * EARTH_RADIUS_M)
            best = np.maximum(best, rise / d)
        result[..., index] = np.degrees(np.arctan(best))
    return np.clip(np.round(result / HORIZON_STEP_DEG), 0, 255).astype(np.uint8)


def relief_payload(dem: Dem, z: int, x: int, y: int) -> bytes:
    return slope_map(dem, z, x, y).tobytes() + horizon_map(dem, z, x, y).tobytes()


def sample_check(z: int, lon: float, lat: float) -> None:
    """调试用：打印某点所在分块的坡度、地平线统计。"""
    from config import lonlat_to_tile

    dem = Dem()
    x, y = lonlat_to_tile(lon, lat, z)
    slopes = slope_map(dem, z, x, y).astype(float)
    horizon = horizon_map(dem, z, x, y).astype(float) * HORIZON_STEP_DEG
    angles = np.degrees(np.tan((slopes / 255 - 0.5) * math.pi))
    print(f"tile {z}/{x}/{y}: slope byte range {slopes.min()}..{slopes.max()}, "
          f"horizon deg p50 {np.percentile(horizon, 50):.1f} p95 {np.percentile(horizon, 95):.1f} max {horizon.max():.1f}, "
          f"sky visibility mean {np.mean(np.cos(np.radians(horizon)) ** 2):.3f}")
    lonlat = pixel_lonlat(np.array([(x + 0.5) * TILE]), np.array([(y + 0.5) * TILE]), z)
    print("center", lonlat, "slope sample", angles[128, 128])
