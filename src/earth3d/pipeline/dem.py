"""从 .cache/dem 里的 Terrarium 瓦片做双线性高程取样。"""

from __future__ import annotations

import math
from collections import OrderedDict

import numpy as np
from PIL import Image

from config import DEM_CACHE

TILE = 256


def mercator_pixel(lon: np.ndarray, lat: np.ndarray, z: int) -> tuple[np.ndarray, np.ndarray]:
    """经纬度 -> 第 z 级全局像素坐标（像素 k 的中心是 k + 0.5）。"""
    size = TILE * (1 << z)
    lat = np.clip(lat, -85.05112878, 85.05112878)
    px = (lon + 180.0) / 360.0 * size
    py = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * size
    return px, py


def pixel_lonlat(px: np.ndarray, py: np.ndarray, z: int) -> tuple[np.ndarray, np.ndarray]:
    size = TILE * (1 << z)
    lon = px / size * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * py / size))))
    return lon, lat


def despike(data: np.ndarray) -> np.ndarray:
    """去掉 SRTM 空洞留下的孤立深坑：低于海平面且比周围 5x5 中位数低 50 米以上的点。
    真实洼地（如吐鲁番盆地）是成片的，中位数同样低，不受影响。"""
    padded = np.pad(data, 2, mode="edge")
    windows = np.lib.stride_tricks.sliding_window_view(padded, (5, 5))
    median = np.median(windows.reshape(data.shape[0], data.shape[1], 25), axis=2)
    pits = (data < 0) & (data < median - 50)
    return np.where(pits, median, data).astype(np.float32)


class Dem:
    def __init__(self, capacity: int = 700) -> None:
        self.capacity = capacity
        self.tiles: OrderedDict[tuple[int, int, int], np.ndarray | None] = OrderedDict()

    def tile(self, z: int, x: int, y: int) -> np.ndarray | None:
        key = (z, x, y)
        if key in self.tiles:
            self.tiles.move_to_end(key)
            return self.tiles[key]
        path = DEM_CACHE / str(z) / str(x) / f"{y}.png"
        data = None
        if path.exists():
            try:
                with Image.open(path) as image:
                    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
                data = despike(rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768)
            except OSError:
                data = None
        self.tiles[key] = data
        if len(self.tiles) > self.capacity:
            self.tiles.popitem(last=False)
        return data

    def gather(self, z: int, ix: np.ndarray, iy: np.ndarray) -> np.ndarray:
        n = 1 << z
        size = TILE * n
        ix = np.mod(ix, size)
        iy = np.clip(iy, 0, size - 1)
        tx, ty = ix // TILE, iy // TILE
        out = np.zeros(ix.shape, dtype=np.float32)
        keys = tx * n + ty
        for key in np.unique(keys):
            mask = keys == key
            data = self.tile(z, int(key // n), int(key % n))
            if data is not None:
                out[mask] = data[iy[mask] % TILE, ix[mask] % TILE]
            elif z > 0:
                # 缺这一级的瓦片时退回上一级（只会发生在战区边缘外）
                out[mask] = self.sample(z - 1, (ix[mask] + 0.5) / 2, (iy[mask] + 0.5) / 2)
        return out

    def sample(self, z: int, px: np.ndarray, py: np.ndarray) -> np.ndarray:
        """在全局像素坐标 (px, py) 处双线性取样，单位米。"""
        fx, fy = np.asarray(px) - 0.5, np.asarray(py) - 0.5
        x0, y0 = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
        wx, wy = (fx - x0).astype(np.float32), (fy - y0).astype(np.float32)
        h00 = self.gather(z, x0, y0)
        h10 = self.gather(z, x0 + 1, y0)
        h01 = self.gather(z, x0, y0 + 1)
        h11 = self.gather(z, x0 + 1, y0 + 1)
        return (h00 * (1 - wx) + h10 * wx) * (1 - wy) + (h01 * (1 - wx) + h11 * wx) * wy

    def sample_lonlat(self, z: int, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
        px, py = mercator_pixel(np.asarray(lon, dtype=np.float64), np.asarray(lat, dtype=np.float64), z)
        return self.sample(z, px, py)
