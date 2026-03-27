#!/usr/bin/env python3
"""
Через 5, 10 или 15 секунд переключает клавиатурную раскладку на русскую.

Порядок попыток: GNOME (gsettings), затем X11 (setxkbmap ru).
Требуется графическая сессия с настроенным русским источником ввода (для GNOME).
"""

from __future__ import annotations

import argparse
import ast
import subprocess
import sys
import time

ALLOWED_DELAYS = (5, 10, 15)


def _gsettings_sources() -> list | None:
    try:
        raw = subprocess.check_output(
            [
                "gsettings",
                "get",
                "org.gnome.desktop.input-sources",
                "sources",
            ],
            stderr=subprocess.DEVNULL,
            timeout=5,
        ).decode()
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None
    s = raw.strip()
    if s.startswith("@"):
        i = s.find("[")
        s = s[i:] if i >= 0 else s
    try:
        val = ast.literal_eval(s)
    except (ValueError, SyntaxError):
        return None
    return val if isinstance(val, list) else None


def _layout_is_russian(layout: str) -> bool:
    layout = layout.lower()
    return layout == "ru" or layout.startswith("ru+") or layout.startswith("ru,")


def switch_gnome_to_russian() -> bool:
    sources = _gsettings_sources()
    if not sources:
        return False
    ru_index: int | None = None
    for i, entry in enumerate(sources):
        if isinstance(entry, (list, tuple)) and len(entry) >= 2:
            if _layout_is_russian(str(entry[1])):
                ru_index = i
                break
    if ru_index is None:
        return False
    try:
        subprocess.run(
            [
                "gsettings",
                "set",
                "org.gnome.desktop.input-sources",
                "current",
                str(ru_index),
            ],
            check=True,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def switch_setxkbmap_russian() -> bool:
    try:
        r = subprocess.run(
            ["setxkbmap", "ru"],
            check=False,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return r.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Пауза 5/10/15 с, затем переключение раскладки на русский."
    )
    parser.add_argument(
        "seconds",
        type=int,
        nargs="?",
        default=10,
        choices=ALLOWED_DELAYS,
        help="задержка в секундах (по умолчанию: 10)",
    )
    args = parser.parse_args()
    time.sleep(args.seconds)

    if switch_gnome_to_russian():
        return 0
    if switch_setxkbmap_russian():
        return 0

    print(
        "Не удалось переключить раскладку: нет GNOME с раскладкой ru "
        "или не сработал setxkbmap (нужен X11 и DISPLAY).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
