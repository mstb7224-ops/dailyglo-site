#!/usr/bin/env python3
"""Fetch the latest published Thailand Government Lottery result.

The official GLO endpoint is public and returns the latest published draw.
The script merges the new draw into data/draw-results.json so the static site
can display verified results without scraping from a browser.
"""
from __future__ import annotations

import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_URL = "https://www.glo.or.th/api/lottery/getLatestLottery"
ROOT = Path(__file__).resolve().parents[1]
RESULTS_PATH = ROOT / "data" / "draw-results.json"


def get_latest() -> dict:
    request = urllib.request.Request(
        API_URL,
        data=b"{}",
        headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "DailyGlo-Results-Sync/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not payload.get("status") or not payload.get("response"):
        raise RuntimeError(f"GLO API returned an unsuccessful response: {payload.get('statusMessage')}")
    return payload["response"]


def first_value(group: dict) -> str:
    numbers = (group or {}).get("number") or []
    if not numbers or not numbers[0].get("value"):
        raise RuntimeError("GLO API response did not contain a first-prize number")
    return str(numbers[0]["value"]).zfill(6)


def last_two_value(group: dict) -> str:
    numbers = (group or {}).get("number") or []
    if not numbers or not numbers[0].get("value"):
        raise RuntimeError("GLO API response did not contain a 2D result")
    return str(numbers[0]["value"]).zfill(2)


def main() -> None:
    response = get_latest()
    draw_date = response.get("date")
    if not draw_date:
        raise RuntimeError("GLO API response did not contain a draw date")
    datetime.strptime(draw_date, "%Y-%m-%d")

    try:
        results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        results = {}

    results[draw_date] = {
        "firstPrize": first_value(response.get("data", {}).get("first")),
        "twoDDown": last_two_value(response.get("data", {}).get("last2")),
        "source": API_URL,
        "verifiedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(dict(sorted(results.items())), ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=RESULTS_PATH.parent, delete=False) as temp:
        temp.write(content)
        temporary_path = Path(temp.name)
    temporary_path.replace(RESULTS_PATH)
    print(json.dumps({"date": draw_date, "firstPrize": results[draw_date]["firstPrize"], "twoDDown": results[draw_date]["twoDDown"]}))


if __name__ == "__main__":
    main()
