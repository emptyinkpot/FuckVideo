"""地形数据重建的进度窗口，由 build_all.py 自动打开，每半秒刷新一次。

读 .cache/rebuild-status.json（当前步骤、进度）和 .cache/rebuild.log（最新输出），不改动任何数据，
关掉这个窗口不影响重建。同一时间只有一个窗口（.cache/progress-window.pid）；
重建结束后窗口保持显示结果，按回车关闭；期间再次启动重建，窗口直接切换到新的这次。
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time

from config import CACHE

LOG = CACHE / "rebuild.log"
STATUS = CACHE / "rebuild-status.json"
WINDOW_PID = CACHE / "progress-window.pid"

RESET, BOLD, DIM = "\033[0m", "\033[1m", "\033[2m"
GREEN, YELLOW, RED, CYAN = "\033[32m", "\033[33m", "\033[31m", "\033[36m"


def clock(seconds: float) -> str:
    seconds = int(max(0, seconds))
    return f"{seconds // 3600}:{seconds // 60 % 60:02d}:{seconds % 60:02d}"


def alive(pid: int) -> bool:
    if os.name == "nt":
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


def tail(lines: int) -> list[str]:
    try:
        with LOG.open("rb") as file:
            file.seek(0, 2)
            file.seek(max(0, file.tell() - 16384))
            text = file.read().decode("utf-8", errors="replace")
    except OSError:
        return []
    return [line for line in text.splitlines() if line.strip()][-lines:]


def bar(fraction: float, width: int) -> str:
    filled = int(round(min(1.0, max(0.0, fraction)) * width))
    return "█" * filled + "░" * (width - filled)


def render(status: dict) -> str:
    width = min(shutil.get_terminal_size((100, 30)).columns, 110)
    now = time.time()
    steps = status["steps"]
    step = status["step"]
    state = status["state"]
    if state == "running" and not alive(status["pid"]):
        state = "stopped"
    skipped = set(status.get("skipped") or [])
    out = [f"{BOLD}earth3d 地形数据重建{RESET}   {DIM}关掉这个窗口不影响重建{RESET}", ""]

    for index, label in enumerate(steps):
        if index in skipped:
            out.append(f"  {GREEN}✓{RESET} {index + 1}. {label}  {DIM}已是最新，跳过{RESET}")
            continue
        if index < step or state == "done":
            mark = f"{GREEN}✓{RESET}"
        elif index == step and state in ("failed", "stopped"):
            mark = f"{RED}✗{RESET}"
        elif index == step:
            mark = f"{YELLOW}▶{RESET}"
        else:
            mark = f"{DIM}·{RESET}"
        text = f"{BOLD}{label}{RESET}" if index == step and state == "running" else label
        out.append(f"  {mark} {index + 1}. {text}")
    out.append("")

    overall = min(step, len(steps)) / len(steps)
    if state == "running" and step < len(steps):
        done, total, unit = status.get("done"), status.get("total"), status.get("unit") or ""
        step_fraction = done / total if done is not None and total else 0.0
        overall += step_fraction / len(steps)
        line = f"  当前：{steps[step]}"
        if (status.get("attempt") or 1) > 1:
            line += f"   {YELLOW}第 {status['attempt']} 次尝试{RESET}"
        if done is not None and total:
            amount = f"{done:.1f}/{total:.1f} MB" if unit == "MB" else f"{int(done)}/{int(total)}"
            line += f"   {amount}"
            elapsed = now - status["stepStarted"]
            if step_fraction > 0.02:
                line += f"   本步剩余约 {clock(elapsed / step_fraction - elapsed)}"
            out.append(line)
            out.append(f"  {CYAN}{bar(step_fraction, 40)}{RESET} {step_fraction * 100:5.1f}%")
        else:
            out.append(line)
            out.append(f"  {DIM}（这一步没有分项进度，等它输出结果）{RESET}")
        if status.get("message"):
            out.append(f"  {YELLOW}{status['message']}{RESET}")
        out.append("")
    if state == "done":
        overall = 1.0
    out.append(f"  总进度 {bar(overall, 40)} {overall * 100:5.1f}%   已用 {clock(now - status['started'])}")
    out.append("")

    if state == "done":
        out.append(f"  {GREEN}{BOLD}{status['message']}{RESET}")
    elif state == "failed":
        out.append(f"  {RED}{BOLD}{status['message']}{RESET}")
    elif state == "stopped":
        out.append(f"  {RED}{BOLD}重建进程已经停止（被关闭或中断）。再运行 src/earth3d/rebuild.bat（或重新打开 start.bat）会从中断处继续。{RESET}")
    out.append("")
    out.append(f"  {DIM}最新输出（完整日志：{LOG}）{RESET}")
    for line in tail(10):
        out.append("  " + line[: width - 4])
    if state != "running":
        out.append("")
        out.append(f"  {DIM}按回车关闭窗口；再次启动重建时，这个窗口会自动显示新的进度{RESET}")
    return "\n".join(out)


def enter_pressed() -> bool:
    if os.name != "nt":
        return False
    import msvcrt

    while msvcrt.kbhit():
        if msvcrt.getwch() in "\r\n":
            return True
    return False


def main() -> None:
    other = None
    try:
        other = int(WINDOW_PID.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        pass
    if other and other != os.getpid() and alive(other):
        return  # 已经有一个进度窗口
    WINDOW_PID.write_text(str(os.getpid()), encoding="utf-8")
    if os.name == "nt":
        os.system("")  # 打开控制台的 ANSI 转义支持
        os.system("title earth3d 地形数据重建进度")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write("\033[2J\033[?25l")  # 清屏一次，隐藏光标
    last = ""
    try:
        while True:
            try:
                status = json.loads(STATUS.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                time.sleep(0.5)
                continue
            screen = render(status)
            if screen != last:
                # 光标回左上角逐行覆盖，每行清掉行尾、最后清掉下方残留，不闪屏
                sys.stdout.write("\033[H" + "".join(line + "\033[K\n" for line in screen.split("\n")) + "\033[J")
                sys.stdout.flush()
                last = screen
            finished = status["state"] != "running" or not alive(status["pid"])
            if finished and enter_pressed():
                return
            time.sleep(0.5)
    finally:
        sys.stdout.write("\033[?25h")
        try:
            if int(WINDOW_PID.read_text(encoding="utf-8").strip()) == os.getpid():
                WINDOW_PID.unlink()
        except (OSError, ValueError):
            pass


if __name__ == "__main__":
    main()
