#!/usr/bin/env python3
"""
Аналог Power Switcher: переключение профиля энергопотребления в Linux.

Порядок бэкендов:
  1. powerprofilesctl (GNOME / systemd-power-profiled)
  2. /sys/firmware/acpi/platform_profile (ACPI Platform Profile)
  3. cpufreq scaling_governor на всех CPU

Запись в sysfs обычно требует прав root (sudo).
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from enum import Enum
from pathlib import Path
from typing import Callable


class Profile(str, Enum):
    POWER_SAVER = "power-saver"
    BALANCED = "balanced"
    PERFORMANCE = "performance"


PLATFORM_PROFILE = Path("/sys/firmware/acpi/platform_profile")
PLATFORM_CHOICES = Path("/sys/firmware/acpi/platform_profile_choices")
GOVERNOR_PATH = Path("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor")
AVAILABLE_GOVERNORS = Path("/sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors")

# ACPI platform_profile names (kernel docs)
ACPI_MAP = {
    Profile.POWER_SAVER: ("low-power", "quiet"),
    Profile.BALANCED: ("balanced",),
    Profile.PERFORMANCE: ("performance",),
}


def _run(cmd: list[str], check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=check,
    )


def backend_powerprofilesctl() -> bool:
    return shutil.which("powerprofilesctl") is not None


def list_profiles_ppd() -> str:
    r = _run(["powerprofilesctl", "list"])
    if r.returncode != 0:
        return r.stderr or r.stdout or "(ошибка powerprofilesctl list)"
    return r.stdout.strip() or "(пусто)"


def get_active_ppd() -> str | None:
    r = _run(["powerprofilesctl", "get"])
    if r.returncode != 0:
        return None
    return r.stdout.strip() or None


def set_ppd(profile: Profile) -> tuple[bool, str]:
    name = profile.value
    r = _run(["powerprofilesctl", "set", name])
    if r.returncode == 0:
        return True, f"powerprofilesctl: установлен профиль «{name}»"
    err = (r.stderr or r.stdout or "неизвестная ошибка").strip()
    return False, f"powerprofilesctl: {err}"


def backend_platform_profile() -> bool:
    return PLATFORM_PROFILE.is_file()


def list_platform_values() -> list[str]:
    for path in (PLATFORM_CHOICES, PLATFORM_PROFILE):
        if not path.is_file():
            continue
        try:
            raw = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        parts = raw.replace("\n", " ").split()
        vals = [p for p in parts if p and p not in ("[active]", "*")]
        if path == PLATFORM_CHOICES and vals:
            return vals
        if path == PLATFORM_PROFILE and vals:
            return vals
    return []


def get_active_platform() -> str | None:
    if not PLATFORM_PROFILE.is_file():
        return None
    try:
        line = PLATFORM_PROFILE.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return None
    if not line:
        return None
    first = line.split()[0]
    return first if first not in ("[active]", "*") else None


def set_platform_profile(profile: Profile) -> tuple[bool, str]:
    candidates = ACPI_MAP[profile]
    available = set(list_platform_values())
    chosen: str | None = None
    for c in candidates:
        if not available or c in available:
            chosen = c
            break
    if chosen is None and available:
        sl = sorted(available)
        if profile == Profile.PERFORMANCE:
            chosen = sl[-1]
        elif profile == Profile.POWER_SAVER:
            chosen = sl[0]
        else:
            chosen = sl[len(sl) // 2]
    if chosen is None:
        return False, "platform_profile: не удалось выбрать значение"

    try:
        PLATFORM_PROFILE.write_text(chosen + "\n", encoding="utf-8")
    except PermissionError:
        return False, f"platform_profile: нет прав записи в {PLATFORM_PROFILE} (нужен sudo)"
    except OSError as e:
        return False, f"platform_profile: {e}"
    return True, f"platform_profile: установлено «{chosen}»"


def backend_cpufreq() -> bool:
    return GOVERNOR_PATH.is_file()


def _read_available_governors() -> list[str]:
    if not AVAILABLE_GOVERNORS.is_file():
        return []
    try:
        text = AVAILABLE_GOVERNORS.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    return text.split()


def _cpu_governor_paths() -> list[Path]:
    base = Path("/sys/devices/system/cpu")
    paths: list[Path] = []
    for p in sorted(base.glob("cpu[0-9]*")):
        g = p / "cpufreq" / "scaling_governor"
        if g.is_file():
            paths.append(g)
    return paths


def get_active_governor() -> str | None:
    if not GOVERNOR_PATH.is_file():
        return None
    try:
        return GOVERNOR_PATH.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return None


def set_governor(profile: Profile) -> tuple[bool, str]:
    available = set(_read_available_governors())
    want: str
    if profile == Profile.PERFORMANCE:
        want = "performance" if "performance" in available else "schedutil"
    elif profile == Profile.POWER_SAVER:
        want = "powersave" if "powersave" in available else "conservative"
    else:
        want = "schedutil" if "schedutil" in available else "ondemand"
        if want not in available and "powersave" in available:
            want = "powersave"

    if want not in available:
        if not available:
            return False, "cpufreq: нет списка доступных губернаторов"
        want = sorted(available)[0]

    paths = _cpu_governor_paths()
    if not paths:
        return False, "cpufreq: не найдены scaling_governor"

    errors: list[str] = []
    for gpath in paths:
        try:
            gpath.write_text(want + "\n", encoding="utf-8")
        except PermissionError:
            errors.append(str(gpath))
        except OSError as e:
            errors.append(f"{gpath}: {e}")

    if errors:
        return False, "cpufreq: нет прав или ошибка записи: " + "; ".join(errors[:3])
    return True, f"cpufreq: для всех CPU установлен губернатор «{want}»"


def detect_backend() -> str:
    if backend_powerprofilesctl():
        return "powerprofilesctl"
    if backend_platform_profile():
        return "platform_profile"
    if backend_cpufreq():
        return "cpufreq"
    return "none"


def show_status() -> int:
    be = detect_backend()
    print(f"Бэкенд: {be}", flush=True)
    if be == "powerprofilesctl":
        print("Текущий профиль:", get_active_ppd() or "?")
        print()
        print(list_profiles_ppd())
    elif be == "platform_profile":
        print("Текущее значение:", get_active_platform() or "?")
        vals = list_platform_values()
        if vals:
            print("Доступные:", " ".join(vals))
    elif be == "cpufreq":
        print("Текущий губернатор:", get_active_governor() or "?")
        ag = _read_available_governors()
        if ag:
            print("Доступные:", " ".join(ag))
    else:
        print("Не найдено: powerprofilesctl, ACPI platform_profile или cpufreq.")
        print(
            "Установите пакет power-profiles-daemon или используйте ядро с platform_profile.",
        )
        return 1
    return 0


def set_profile(profile: Profile, preferred: str | None) -> int:
    if preferred == "powerprofilesctl" and backend_powerprofilesctl():
        ok, msg = set_ppd(profile)
        print(msg)
        return 0 if ok else 1
    if preferred == "platform_profile" and backend_platform_profile():
        ok, msg = set_platform_profile(profile)
        print(msg)
        return 0 if ok else 1
    if preferred == "cpufreq" and backend_cpufreq():
        ok, msg = set_governor(profile)
        print(msg)
        return 0 if ok else 1

    order: list[tuple[str, Callable[[], tuple[bool, str]]]] = []
    if backend_powerprofilesctl():
        order.append(("powerprofilesctl", lambda: set_ppd(profile)))
    if backend_platform_profile():
        order.append(("platform_profile", lambda: set_platform_profile(profile)))
    if backend_cpufreq():
        order.append(("cpufreq", lambda: set_governor(profile)))

    if not order:
        print(
            "Нет доступного способа переключения профиля на этой системе.",
            file=sys.stderr,
        )
        return 1

    for name, fn in order:
        ok, msg = fn()
        print(f"[{name}] {msg}")
        if ok:
            return 0

    return 1


def main() -> int:
    profiles_help = ", ".join(p.value for p in Profile)

    p = argparse.ArgumentParser(
        description="Переключение профиля энергопотребления (аналог Power Switcher).",
    )
    p.add_argument(
        "profile",
        nargs="?",
        choices=[x.value for x in Profile],
        help=f"Профиль: {profiles_help}",
    )
    p.add_argument(
        "-s",
        "--status",
        action="store_true",
        help="Показать текущий профиль и доступные варианты",
    )
    p.add_argument(
        "--backend",
        choices=["powerprofilesctl", "platform_profile", "cpufreq", "auto"],
        default="auto",
        help="Принудительно выбрать бэкенд (по умолчанию: первый доступный)",
    )

    args = p.parse_args()
    preferred = None if args.backend == "auto" else args.backend

    if args.status:
        st = show_status()
        if args.profile is None:
            return st
        print()

    if args.profile is None:
        return show_status()

    profile = Profile(args.profile)
    return set_profile(profile, preferred)


if __name__ == "__main__":
    sys.exit(main())
