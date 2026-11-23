"""下载河流、湖泊、海洋、城市矢量数据到 .cache/vector/<name>/ 并解压。

Natural Earth 的下载地址总是指向最新版本。为了让每台电脑用到同一份数据，
解压后核对 .shp、.dbf 的 sha256 与 inputs.lock.json 是否一致；不一致就停下说明，
不会悄悄用新版本算出不同的结果。
  python fetch_vectors.py --update-lock   # 有意更换数据版本时，由维护者重写锁定值

不重复下载、不误删：
- 已完整的目录（有 .complete 标记，或文件与锁定值一致）直接跳过，不联网。
- 下载写到 <name>.zip.download，中断后保留，下次从断开处续传（HTTP Range）。
- 新下载的数据先解压到临时目录并核对锁定值，核对通过才替换；核对不通过就丢掉新下载的，
  原有目录保持不动。
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path

import requests

from config import VECTOR_CACHE, VECTOR_SOURCES

LOCK = Path(__file__).with_name("inputs.lock.json")
ATTEMPTS = 6


def file_hashes(folder: Path) -> dict[str, str]:
    return {
        path.relative_to(folder).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(folder.rglob("*"))
        if path.suffix.lower() in {".shp", ".dbf"}
    }


def download(url: str, name: str) -> Path:
    """下载到 <name>.zip.download，可续传；每 2% 输出一次“已下/总共 MB”，供进度窗口显示。"""
    part = VECTOR_CACHE / f"{name}.zip.download"
    source = VECTOR_CACHE / f"{name}.zip.download.url"
    # 地址变了，之前下了一半的是另一个文件，不能接着用
    if part.exists() and (not source.exists() or source.read_text(encoding="utf-8") != url):
        part.unlink()
    source.write_text(url, encoding="utf-8")
    for attempt in range(1, ATTEMPTS + 1):
        start = part.stat().st_size if part.exists() else 0
        try:
            headers = {"Range": f"bytes={start}-"} if start else {}
            with requests.get(url, headers=headers, stream=True, timeout=120) as response:
                if start and response.status_code == 416:
                    return part  # 上次其实已经下完
                response.raise_for_status()
                resumed = start > 0 and response.status_code == 206
                if not resumed:
                    start = 0
                total = start + int(response.headers.get("Content-Length") or 0)
                done, shown = start, -1
                with part.open("ab" if resumed else "wb") as file:
                    for chunk in response.iter_content(1 << 20):
                        file.write(chunk)
                        done += len(chunk)
                        step = int(done * 50 / total) if total else done >> 24
                        if step != shown:
                            shown = step
                            print(f"  {done / 1e6:.1f}/{(total or done) / 1e6:.1f} MB", flush=True)
            return part
        except requests.RequestException as error:
            if attempt == ATTEMPTS:
                raise
            print(f"  {name}: 下载中断（{error}），{5 * attempt} 秒后从断开处继续", flush=True)
            time.sleep(5 * attempt)
    return part


def complete(target: Path, name: str, lock: dict) -> bool:
    """目录完整：有完成标记；或（旧版本留下的）文件与锁定值完全一致。"""
    if (target / ".complete").exists():
        return True
    if target.exists() and name in lock and file_hashes(target) == lock[name]["files"]:
        (target / ".complete").write_text("", encoding="utf-8")
        return True
    return False


def fetch(name: str, url: str, lock: dict, update: bool) -> None:
    """下载、解压到临时目录、核对，通过后才替换正式目录。"""
    target = VECTOR_CACHE / name
    staging = VECTOR_CACHE / f"{name}.extracting"
    print(f"download {name} ...", flush=True)
    for attempt in range(2):
        part = download(url, name)
        shutil.rmtree(staging, ignore_errors=True)
        try:
            with zipfile.ZipFile(part) as archive:
                archive.extractall(staging)
            break
        except zipfile.BadZipFile:
            part.unlink()  # 下载内容损坏，重下一次
            if attempt == 1:
                raise
    hashes = file_hashes(staging)
    if not update and name in lock and hashes != lock[name]["files"]:
        shutil.rmtree(staging, ignore_errors=True)
        part.unlink()
        (VECTOR_CACHE / f"{name}.zip.download.url").unlink(missing_ok=True)
        sys.exit(
            f"{name}: 新下载的数据与 inputs.lock.json 不一致，数据源可能发布了新版本（{url}）。"
            f"原有数据没有改动。只有在有意更换数据版本时，才用 --update-lock 运行。"
        )
    (staging / ".complete").write_text("", encoding="utf-8")
    if target.exists():
        # Windows 上不能直接用目录替换非空目录：旧目录先改成杂物名，新目录就位后再删
        old = VECTOR_CACHE / f"{name}.replaced.extracting"
        shutil.rmtree(old, ignore_errors=True)
        os.replace(target, old)
        os.replace(staging, target)
        shutil.rmtree(old, ignore_errors=True)
    else:
        os.replace(staging, target)
    print(f"  {name}: {part.stat().st_size / 1e6:.1f} MB", flush=True)
    part.unlink()
    (VECTOR_CACHE / f"{name}.zip.download.url").unlink(missing_ok=True)


def main() -> None:
    update = "--update-lock" in sys.argv
    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    before = json.dumps(lock, indent=2, ensure_ascii=False) + "\n"
    VECTOR_CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in VECTOR_SOURCES.items():
        target = VECTOR_CACHE / name
        if not complete(target, name, lock):
            fetch(name, url, lock, update)
        if update or name not in lock:
            lock[name] = {"url": url, "files": file_hashes(target)}
        print(f"ok {name}")
    after = json.dumps(lock, indent=2, ensure_ascii=False) + "\n"
    if after != before:  # 没有变化就不改写这个提交进仓库的文件
        LOCK.write_text(after, encoding="utf-8")


if __name__ == "__main__":
    main()
