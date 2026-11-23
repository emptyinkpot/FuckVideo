"""生成 1930 年代战区城市表 assets/cities.json。

城市位置来自 Natural Earth 10m populated places。人口按年代压低：
重点城市用史料中 1930 年代的近似人口直接覆盖；其余有 UN 1950 年人口的乘 0.8，
没有的按现代人口和所属国家折算。中国城市的 UN 数据常按地级区域统计，另设上限。
城区轮廓是围绕中心的 24 个方向半径，略带不规则。build_tiles.py 用它标记城区地表，
前端用同一份轮廓生成建筑，两者保持一致。
"""

from __future__ import annotations

import json
import math
import random
import zlib

import shapefile

from config import ASSETS, THEATER_BOUNDS, VECTOR_CACHE

# 1930 年代近似人口（人），取各城市通史中的常见估计，只用于决定城区规模。
POP_1930S = {
    "Shanghai": 3_500_000, "Beijing": 1_500_000, "Tianjin": 1_200_000,
    "Nanjing": 1_000_000, "Wuhan": 1_200_000, "Guangzhou": 1_100_000,
    "Chongqing": 500_000, "Chengdu": 450_000, "Xi'an": 200_000, "Xian": 200_000,
    "Shenyang": 530_000, "Shenyeng": 530_000, "Harbin": 470_000, "Changchun": 350_000,
    "Dalian": 400_000, "Qingdao": 500_000, "Jinan": 430_000, "Hangzhou": 580_000,
    "Suzhou": 390_000, "Changsha": 400_000, "Taiyuan": 140_000, "Zhengzhou": 100_000,
    "Kunming": 150_000, "Guiyang": 120_000, "Lanzhou": 100_000, "Fuzhou": 400_000,
    "Xiamen": 180_000, "Hong Kong": 1_000_000, "Taipei": 330_000, "Seoul": 700_000,
    "Pyongyang": 280_000, "Busan": 250_000, "Tokyo": 6_000_000, "Osaka": 3_000_000,
    "Nagoya": 1_300_000, "Kyoto": 1_100_000, "Yokohama": 900_000, "Kobe": 900_000,
    "Hiroshima": 340_000, "Nagasaki": 220_000, "Fukuoka": 300_000, "Sapporo": 200_000,
    "Vladivostok": 200_000, "Hanoi": 150_000, "Qiqihar": 100_000, "Tangshan": 150_000,
    "Fushun": 200_000, "Anshan": 100_000, "Wuxi": 270_000, "Ningbo": 250_000,
    "Luoyang": 70_000, "Datong": 80_000, "Baotou": 60_000, "Jilin": 130_000,
    "Kaifeng": 300_000, "Xuzhou": 160_000, "Shijiazhuang": 70_000, "Nanchang": 270_000,
    "Hefei": 80_000, "Yichang": 100_000, "Changzhou": 120_000, "Zhenjiang": 200_000,
    "Anqing": 120_000, "Wuhu": 150_000, "Hengyang": 150_000, "Guilin": 100_000,
    "Nanning": 100_000, "Shantou": 180_000, "Yantai": 140_000,
}
COUNTRY_FACTOR = {"China": 0.07, "Japan": 0.3, "South Korea": 0.1, "North Korea": 0.12,
                  "Taiwan": 0.12, "Russia": 0.25, "Mongolia": 0.1}
CHINA_CAP = 350_000
# 人口密度（人/平方公里）：中国、朝鲜城市密集，日本稍低。
DENSITY = {"Japan": 14_000}
DEFAULT_DENSITY = 22_000
MIN_POP = 40_000


def outline(seed: int, radius_km: float) -> list[float]:
    rng = random.Random(seed)
    phases = [rng.uniform(0, math.tau) for _ in range(5)]
    amps = [0.22, 0.14, 0.09, 0.06, 0.04]
    result = []
    for i in range(24):
        angle = i / 24 * math.tau
        wobble = sum(a * math.sin((k + 2) * angle + p) for k, (a, p) in enumerate(zip(amps, phases)))
        result.append(round(radius_km * (1 + wobble), 3))
    return result


def estimate_population(name: str, country: str, row: dict) -> float:
    if name in POP_1930S:
        return POP_1930S[name]
    if row.get("POP1950") and int(row["POP1950"]) > 0:
        pop = int(row["POP1950"]) * 1000 * 0.8  # POP1950 以千人为单位
    else:
        pop = int(row["POP_MAX"]) * COUNTRY_FACTOR.get(country, 0.08)
    if country == "China":
        pop = min(pop, CHINA_CAP)
    return pop


def main() -> None:
    west, south, east, north = THEATER_BOUNDS
    reader = shapefile.Reader(str(VECTOR_CACHE / "ne_places" / "ne_10m_populated_places.shp"),
                              encoding="utf-8")
    names = [field[0] for field in reader.fields[1:]]
    cities = []
    for record in reader.iterRecords():
        row = dict(zip(names, record))
        lon, lat = float(row["LONGITUDE"]), float(row["LATITUDE"])
        if not (west <= lon <= east and south <= lat <= north):
            continue
        name = row["NAMEASCII"] or row["NAME"]
        country = row["ADM0NAME"]
        pop = estimate_population(name, country, row)
        if pop < MIN_POP:
            continue
        radius = math.sqrt(pop / DENSITY.get(country, DEFAULT_DENSITY) / math.pi)
        seed = int(row["NE_ID"]) if row.get("NE_ID") else zlib.crc32(name.encode())
        cities.append({
            "name": name,
            "nameZh": row.get("NAME_ZH") or name,
            "country": country,
            "lon": round(lon, 5),
            "lat": round(lat, 5),
            "pop": int(pop),
            "radiusKm": round(radius, 3),
            "seed": seed & 0x7FFFFFFF,
            "outline": outline(seed, radius),
        })
    cities.sort(key=lambda city: -city["pop"])
    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "cities.json").write_text(json.dumps(cities, ensure_ascii=False), encoding="utf-8")
    print(f"cities: {len(cities)}")
    for city in cities[:12]:
        print(f"  {city['nameZh']} {city['pop']:,} r={city['radiusKm']}km")


if __name__ == "__main__":
    main()
