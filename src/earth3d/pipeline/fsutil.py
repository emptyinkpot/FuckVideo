"""产物写入与杂物清理。

所有产物都先写到“<文件名>.tmp”，写完再一步替换成正式文件：中途停掉只会留下 .tmp，
正式文件要么是旧的完整版本，要么是新的完整版本，不会是半截。
.tmp、.part（下载中）、.extracting（解压中）都是中断留下的杂物，build_all.py 在开始和结束时清掉。
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import numpy as np


def tmp_path(path: Path) -> Path:
    return path.with_name(path.name + ".tmp")


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = tmp_path(path)
    tmp.write_bytes(data)
    os.replace(tmp, path)


def write_text(path: Path, text: str) -> None:
    write_bytes(path, text.encode("utf-8"))


def save_npy(path: Path, array: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = tmp_path(path)
    with tmp.open("wb") as file:
        np.save(file, array)
    os.replace(tmp, path)


def is_leftover(path: Path) -> bool:
    name = path.name
    return name.endswith((".tmp", ".part", ".extracting")) or ".tmp." in name


def clean_leftovers(*roots: Path, skip: tuple[str, ...] = ("venv",)) -> list[Path]:
    """删掉中断留下的临时文件、半截下载、解压到一半的目录。返回删掉的路径。"""
    removed: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for current, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in skip]
            here = Path(current)
            for name in list(dirs):
                if is_leftover(here / name):
                    shutil.rmtree(here / name, ignore_errors=True)
                    dirs.remove(name)
                    removed.append(here / name)
            for name in files:
                if is_leftover(here / name):
                    try:
                        (here / name).unlink()
                        removed.append(here / name)
                    except OSError:
                        pass
    return removed
