"""earth3d 数据的一键检查与增量重建。双击 src/earth3d/rebuild.bat 即可；
仓库根目录的 start.bat 每次启动时也会用 --if-needed 快速检查一遍。

做什么：
1. 每一步都检查源码和产物：步骤脚本、它引用的本地模块、输入数据和上游步骤的指纹
   都没变、产物也都在，就跳过；变了或缺了，只重做这一步以及受它影响的下游步骤。
   - 下载步骤每次都跑，但已经下好的文件会自动跳过，只补缺的。
   - 地形分块逐个判断：缺的补上；源码变了，就把旧源码生成的分块逐个覆盖重建。
2. 最后与 assets.sha256 逐个文件核对；有缺失或不一致的分块，就只重建这些，再核对一次。
3. 不删除有用的文件。产物都先写 .tmp、写完再替换（fsutil.py），中途停掉不会留下半截文件。

干净：
- 同一时间只有一个重建（原子锁文件）；重建进行中再次启动，只会把进度窗口叫出来。
- 所有子进程放在一个 Windows 作业对象里：重建进程无论怎么退出，子进程都一起结束，不留孤儿进程。
- 开始和结束时都清掉中断留下的 .tmp、.part、解压一半的目录、临时报告；日志只留本次和上一次。
- 某一步失败会自动等待后重试，最多 3 次。

运行时弹出进度窗口（progress_window.py，同时只有一个）；输出同时写进 .cache/rebuild.log。

用法（在 src/earth3d/pipeline 下）：
    ../.cache/venv/Scripts/python.exe build_all.py              # 检查并按需重建，弹出进度窗口
    ../.cache/venv/Scripts/python.exe build_all.py --no-window  # 不弹窗（无图形界面的机器）
    ../.cache/venv/Scripts/python.exe build_all.py --if-needed  # 快速检查（不读数据内容，约一秒）：
        都是最新就直接退出；需要重建就在后台启动完整重建（弹出进度窗口）后立即返回
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from config import ASSETS, CACHE, EARTH3D, LANDCOVER_CACHE
from fsutil import clean_leftovers, write_text

HERE = Path(__file__).resolve().parent
LOG = CACHE / "rebuild.log"
PREVIOUS_LOG = CACHE / "rebuild.previous.log"
STATUS = CACHE / "rebuild-status.json"
STAMPS = CACHE / "build-stamps.json"
LOCK = CACHE / "rebuild.lock"
WINDOW_PID = CACHE / "progress-window.pid"
VERIFY_REPORT = CACHE / "verify-report.json"
TILES_REDO = CACHE / "tiles-redo.json"
MASKS = CACHE / "masks"
# 早期版本留下的文件，见到就清掉
LEGACY = ["rebuild2.log", "rebuild3.log", "build_tiles.log", "watch-rebuild.ps1"]
ATTEMPTS = 3

IS_WINDOWS = os.name == "nt"
NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW
NEW_CONSOLE = 0x00000010  # CREATE_NEW_CONSOLE
BREAKAWAY = 0x01000000  # CREATE_BREAKAWAY_FROM_JOB：进度窗口不随重建进程一起结束


@dataclass
class Step:
    script: str
    label: str
    # 产物：都存在且指纹没变时跳过这一步。为空表示每次都运行（步骤自己跳过已完成的部分）
    outputs: list[Path] = field(default_factory=list)
    # 除了脚本源码以外的输入文件
    inputs: list[Path] = field(default_factory=list)
    # 上游步骤：它们的指纹变了，这一步也要重做
    after: list[str] = field(default_factory=list)
    # 下载步骤：结果只由数据源地址和锁定值决定（config.py、inputs），与下载脚本本身的代码无关。
    # 改进下载逻辑不应让下游全部重做。
    fetch: bool = False


STEPS = [
    Step("fetch_dem.py", "下载高程数据", fetch=True),
    Step("fetch_vectors.py", "下载河流、湖泊、海洋、城市数据", inputs=[HERE / "inputs.lock.json"], fetch=True),
    Step(
        "fetch_landcover.py", "下载地表分类", fetch=True,
        outputs=[LANDCOVER_CACHE / f"{label}.{ext}" for label in ("theater", "global") for ext in ("npy", "json")],
    ),
    Step("build_cities.py", "生成城市数据", outputs=[ASSETS / "cities.json"], after=["fetch_vectors.py"]),
    Step(
        "build_masks.py", "生成海洋、湖泊遮罩",
        outputs=[MASKS / f"{label}.{ext}" for label in ("theater", "global") for ext in ("npy", "json")]
        + [MASKS / "lakes.json"],
        after=["fetch_dem.py", "fetch_vectors.py", "fetch_landcover.py"],
    ),
    Step(
        "build_rivers.py", "生成河流数据",
        outputs=[ASSETS / "rivers.bin"], after=["fetch_dem.py", "fetch_vectors.py", "build_masks.py"],
    ),
    Step(
        "build_borders.py", "生成国界数据",
        outputs=[ASSETS / "borders-1938.bin"],
        inputs=[EARTH3D / "data" / "historical-world-1938.geojson"],
        after=["fetch_dem.py", "build_masks.py"],
    ),
    Step(
        "build_tiles.py", "生成地形分块",
        after=["fetch_dem.py", "fetch_landcover.py", "build_cities.py", "build_masks.py", "build_rivers.py"],
    ),
    Step("manifest.py", "逐个文件校验", inputs=[EARTH3D / "assets.sha256"]),
]

# 子步骤输出里的进度：“  4000/8160”（个数）或 “  12.3/90.5 MB”（下载量）
PROGRESS = re.compile(r"^\s*([\d.]+)/([\d.]+)(\s*MB)?\s*$")


# ---------- 指纹 ----------

def local_imports(script: Path, seen: set[Path]) -> None:
    """脚本及其引用的 pipeline 目录下的模块（递归）。"""
    if script in seen or not script.exists():
        return
    seen.add(script)
    for node in ast.walk(ast.parse(script.read_text(encoding="utf-8"))):
        names = []
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names = [node.module]
        for name in names:
            local_imports(HERE / f"{name.split('.')[0]}.py", seen)


def fingerprints() -> dict[str, str]:
    result: dict[str, str] = {}
    for step in STEPS:
        sources: set[Path] = set()
        if step.fetch:
            sources.add(HERE / "config.py")
        else:
            local_imports(HERE / step.script, sources)
        digest = hashlib.sha256()
        for path in sorted(sources) + step.inputs:
            digest.update(path.name.encode())
            digest.update(path.read_bytes() if path.exists() else b"<missing>")
        for upstream in step.after:
            digest.update(result[upstream].encode())
        result[step.script] = digest.hexdigest()
    return result


def load_stamps() -> dict:
    try:
        return json.loads(STAMPS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_stamps(stamps: dict) -> None:
    write_text(STAMPS, json.dumps(stamps, indent=1))


# ---------- 状态（给进度窗口看） ----------

class Status:
    def __init__(self, run_id: str) -> None:
        self.data = {
            "run": run_id,
            "pid": os.getpid(),
            "started": time.time(),
            "steps": [step.label for step in STEPS],
            "skipped": [],
            "step": 0,
            "stepStarted": time.time(),
            "attempt": 1,
            "done": None,
            "total": None,
            "unit": "",
            "state": "running",
            "message": "",
        }

    def update(self, **values) -> None:
        self.data.update(values)
        write_text(STATUS, json.dumps(self.data, ensure_ascii=False))


# ---------- 进程 ----------

def process_alive(pid: int) -> bool:
    if IS_WINDOWS:
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def read_pid(path: Path) -> int | None:
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None


def acquire_lock() -> int | None:
    """拿到锁返回 None；已有重建在运行时返回它的进程号。锁文件用 O_EXCL 原子创建。"""
    for _ in range(3):
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            pid = read_pid(LOCK)
            if pid and process_alive(pid):
                return pid
            LOCK.unlink(missing_ok=True)  # 上次的重建已经不在了，锁是残留的
            continue
        with os.fdopen(fd, "w") as file:
            file.write(str(os.getpid()))
        return None
    return read_pid(LOCK) or -1


def release_lock() -> None:
    if read_pid(LOCK) == os.getpid():
        LOCK.unlink(missing_ok=True)


_job = None


def contain_children() -> None:
    """把本进程放进一个“关闭即结束全部成员”的作业对象，子进程自动加入。
    本进程退出（包括被强制结束）时，所有子进程、孙进程一起结束。"""
    global _job
    if not IS_WINDOWS:
        return
    import ctypes
    from ctypes import wintypes

    class Basic(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD), ("SchedulingClass", wintypes.DWORD),
        ]

    class Io(ctypes.Structure):
        _fields_ = [(name, ctypes.c_uint64) for name in ("r", "w", "o", "rb", "wb", "ob")]

    class Extended(ctypes.Structure):
        _fields_ = [
            ("Basic", Basic), ("Io", Io), ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
    kernel32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD]
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        return
    info = Extended()
    info.Basic.LimitFlags = 0x2000 | 0x800  # KILL_ON_JOB_CLOSE | BREAKAWAY_OK
    kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info))
    if kernel32.AssignProcessToJobObject(job, kernel32.GetCurrentProcess()):
        _job = job  # 句柄一直留着；进程结束时系统关闭句柄，作业里的进程随之结束


def open_window() -> None:
    """打开进度窗口；已经开着就不再开第二个（窗口会自动显示这次运行）。"""
    if not IS_WINDOWS:
        return
    pid = read_pid(WINDOW_PID)
    if pid and process_alive(pid):
        return
    # 用带控制台的 python.exe（本进程可能是没有控制台的 pythonw.exe）
    console = Path(sys.executable).with_name("python.exe")
    command = [str(console if console.exists() else sys.executable), str(HERE / "progress_window.py")]
    try:
        subprocess.Popen(command, cwd=HERE, creationflags=NEW_CONSOLE | BREAKAWAY)
    except OSError:
        subprocess.Popen(command, cwd=HERE, creationflags=NEW_CONSOLE)


# ---------- 清理 ----------

def clean(log=None) -> None:
    removed = clean_leftovers(CACHE, ASSETS, HERE)
    for name in LEGACY:
        path = CACHE / name
        if path.exists():
            path.unlink(missing_ok=True)
            removed.append(path)
    for path in (VERIFY_REPORT, TILES_REDO):
        if path.exists():
            path.unlink(missing_ok=True)
            removed.append(path)
    shutil.rmtree(HERE / "__pycache__", ignore_errors=True)
    if removed and log:
        say(f"清理了 {len(removed)} 个中断留下的临时文件", log)


# ---------- 运行 ----------

def say(text: str, log, end: str = "\n") -> None:
    try:
        sys.stdout.write(text + end)
        sys.stdout.flush()
    except (OSError, ValueError, AttributeError):
        pass  # 没有控制台（pythonw）时只写日志
    log.write(text + end)
    log.flush()


def run_script(args: list[str], status: Status, log, env: dict | None = None) -> int:
    full_env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1", PYTHONDONTWRITEBYTECODE="1")
    full_env.update(env or {})
    status.update(done=None, total=None, unit="")
    process = subprocess.Popen(
        [sys.executable, *args], cwd=HERE, env=full_env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
        creationflags=NO_WINDOW if IS_WINDOWS else 0,
    )
    assert process.stdout is not None
    for line in process.stdout:
        say(line, log, end="")
        match = PROGRESS.match(line)
        if match:
            status.update(done=float(match[1]), total=float(match[2]), unit="MB" if match[3] else "")
    return process.wait()


def tiles_env(stamps: dict, stamp: str) -> dict:
    """决定哪些分块算过期：源码变了，就把变之前生成的分块逐个覆盖重建。"""
    done = stamps.get("build_tiles.py")
    pending = stamps.get("build_tiles.pending")
    if done == stamp:
        since = 0.0  # 全部是当前源码生成的，只补缺的
    elif pending and pending["stamp"] == stamp:
        since = pending["since"]  # 上次换源码后的重建被打断，接着做
    elif done is None:
        since = 0.0  # 没有记录：先信任已有分块，最后的校验会找出不一致的并只重建那些
    else:
        since = time.time()
        stamps["build_tiles.pending"] = {"stamp": stamp, "since": since}
        save_stamps(stamps)
    return {"EARTH3D_TILES_SINCE": str(since)} if since else {}


def verify_and_repair(status: Status, log, index: int) -> tuple[int, str]:
    for attempt in range(2):
        if run_script(["manifest.py", "verify", "--report", str(VERIFY_REPORT)], status, log) == 0:
            return 0, ""
        try:
            result = json.loads(VERIFY_REPORT.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return 1, "校验没能完成（详见日志）。"
        wrong = result["missing"] + result["different"]
        tiles = [n[len("tiles/"):-len(".e3d")] for n in wrong if n.startswith("tiles/") and n.endswith(".e3d")]
        others = [n for n in wrong if not (n.startswith("tiles/") and n.endswith(".e3d"))]
        if attempt == 1 or not tiles or others:
            break
        say(f"== 有 {len(tiles)} 个地形分块与校验清单不一致，只重建这些", log)
        write_text(TILES_REDO, json.dumps(tiles))
        status.update(step=index - 1, stepStarted=time.time())
        if run_script(["build_tiles.py"], status, log, {"EARTH3D_TILES_REDO": str(TILES_REDO)}) != 0:
            return 1, "重建不一致的分块时出错（详见日志）。"
        status.update(step=index, stepStarted=time.time())
    return 1, (
        "产物与校验清单 assets.sha256 不一致（详见日志）。如果是有意修改了生成源码，"
        "需要维护者运行 manifest.py write 更新清单。"
    )


def run_step(index: int, step: Step, stamps: dict, stamp: str, status: Status, log) -> tuple[int, str]:
    if step.script == "manifest.py":
        return verify_and_repair(status, log, index)
    env = tiles_env(stamps, stamp) if step.script == "build_tiles.py" else None
    return run_script([step.script], status, log, env), ""


def build(status: Status, log) -> int:
    stamps = load_stamps()
    prints = fingerprints()
    changed: set[str] = set()
    for index, step in enumerate(STEPS):
        status.update(step=index, stepStarted=time.time(), attempt=1)
        stamp = prints[step.script]
        fresh = (
            step.outputs
            and stamps.get(step.script) == stamp
            and all(path.exists() for path in step.outputs)
            and not changed.intersection(step.after)
        )
        if fresh:
            say(f"== [{index + 1}/{len(STEPS)}] {step.label}：已是最新，跳过", log)
            status.update(skipped=status.data["skipped"] + [index])
            continue
        say(f"== [{index + 1}/{len(STEPS)}] {step.label} ({step.script})", log)
        for attempt in range(1, ATTEMPTS + 1):
            code, problem = run_step(index, step, stamps, stamp, status, log)
            if code == 0 or step.script == "manifest.py" or attempt == ATTEMPTS:
                break
            wait = 15 * attempt
            say(f"-- 第 {attempt} 次失败（退出码 {code}），{wait} 秒后自动重试", log)
            clean_leftovers(CACHE, ASSETS)
            status.update(attempt=attempt + 1, message=f"第 {attempt} 次失败，{wait} 秒后自动重试")
            time.sleep(wait)
            status.update(stepStarted=time.time(), message="")
        if code != 0:
            message = problem or (
                f"第 {index + 1} 步“{step.label}”连续 {ATTEMPTS} 次失败（退出码 {code}），详见日志。"
                "再运行 src/earth3d/rebuild.bat（或重新打开 start.bat）会从中断处继续。"
            )
            say(message, log)
            status.update(state="failed", message=message)
            return code or 1
        if stamps.get(step.script) != stamp:
            changed.add(step.script)
        stamps[step.script] = stamp
        if step.script == "build_tiles.py":
            stamps.pop("build_tiles.pending", None)
        save_stamps(stamps)
    minutes = (time.time() - status.data["started"]) / 60
    message = f"全部完成，用时 {minutes:.0f} 分钟。所有数据与校验清单一致。"
    say(message, log)
    status.update(step=len(STEPS), state="done", message=message)
    return 0


# ---------- 快速检查（start.bat 每次启动时用） ----------

def missing_tiles() -> int | None:
    """tiles.json 里列出的分块有几个不在磁盘上；没有 tiles.json 返回 None。只看文件名，不读内容。"""
    try:
        expected = json.loads((ASSETS / "tiles.json").read_text(encoding="utf-8"))["tiles"]
    except (OSError, ValueError, KeyError):
        return None
    present = set()
    root = ASSETS / "tiles"
    for current, _, files in os.walk(root):
        rel = Path(current).relative_to(root).as_posix()
        present.update(f"{rel}/{name[:-4]}" for name in files if name.endswith(".e3d"))
    return sum(1 for key in expected if key not in present)


def why_rebuild() -> str | None:
    """需要重建的原因；都是最新返回 None。"""
    stamps = load_stamps()
    prints = fingerprints()
    for step in STEPS:
        if stamps.get(step.script) != prints[step.script]:
            return f"“{step.label}”的源码或输入有变化，或者还没有完整运行过"
        gone = [path for path in step.outputs if not path.exists()]
        if gone:
            return f"缺少 {gone[0].name}"
    missing = missing_tiles()
    if missing is None:
        return "还没有生成地形分块"
    if missing:
        return f"缺少 {missing} 个地形分块"
    return None


def start_detached() -> None:
    """在后台启动完整重建：没有控制台、不随调用方（start.bat 的窗口）一起结束。"""
    background = Path(sys.executable).with_name("pythonw.exe")
    command = [str(background if background.exists() else sys.executable), str(HERE / "build_all.py")]
    flags = 0x00000008 | 0x00000200 if IS_WINDOWS else 0  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    try:
        subprocess.Popen(command, cwd=HERE, creationflags=flags | (BREAKAWAY if IS_WINDOWS else 0), close_fds=True)
    except OSError:
        subprocess.Popen(command, cwd=HERE, creationflags=flags, close_fds=True)


def check_only() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    pid = read_pid(LOCK)
    if pid and process_alive(pid):
        print("earth3d：数据重建正在进行，打开进度窗口。")
        open_window()
        return
    reason = why_rebuild()
    if reason is None:
        print("earth3d：地形数据已是最新。")
        return
    print(f"earth3d：需要重建地形数据（{reason}），已在后台开始，进度见弹出的窗口。")
    start_detached()


def main() -> None:
    if "--if-needed" in sys.argv:
        check_only()
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    window = "--no-window" not in sys.argv
    other = acquire_lock()
    if other:
        print(f"已有重建在运行（进程 {other}），只打开进度窗口。")
        if window:
            open_window()
        return
    code = 1
    try:
        try:
            contain_children()
        except Exception:  # 拿不到作业对象也照常重建，只是少了“退出时带走子进程”这层保护
            pass
        if LOG.exists():
            os.replace(LOG, PREVIOUS_LOG)
        with LOG.open("w", encoding="utf-8") as log:
            say(f"===== 检查并重建 {time.strftime('%Y-%m-%d %H:%M:%S')} =====", log)
            clean(log)
            status = Status(uuid.uuid4().hex)
            status.update()
            if window:
                open_window()
            try:
                code = build(status, log)
            except BaseException as error:  # 意外错误也要写进状态，窗口能显示
                status.update(state="failed", message=f"重建出错：{error!r}（详见日志）")
                say(f"重建出错：{error!r}", log)
                raise
            finally:
                clean()
    finally:
        release_lock()
    sys.exit(code)


def report_crash() -> None:
    """启动阶段的意外错误：写进日志和状态，打开进度窗口显示出来（pythonw 下没有控制台，否则看不到）。"""
    import traceback

    text = traceback.format_exc()
    try:
        with LOG.open("a", encoding="utf-8") as log:
            log.write(text)
        status = Status(uuid.uuid4().hex)
        status.update(state="failed", message=f"重建程序出错：{text.strip().splitlines()[-1]}（详见日志）")
        if "--no-window" not in sys.argv:
            open_window()
    finally:
        release_lock()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException:
        report_crash()
        sys.exit(1)
