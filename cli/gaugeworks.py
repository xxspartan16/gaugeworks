#!/usr/bin/env python3
"""A dependency-free companion to Gaugeworks' fixed-baseline I-chart engine."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
from pathlib import Path


def read_measurements(source: str) -> list[dict]:
    if len(source.encode("utf-8")) > 1_048_576:
        raise ValueError("File exceeds the 1 MiB limit.")
    reader = csv.reader(io.StringIO(source.lstrip("\ufeff")), strict=True)
    rows = [(reader.line_num, row) for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        raise ValueError("Add a header and at least two measurements.")
    header = [cell.strip().lower() for cell in rows[0][1]]
    if len(set(header)) != len(header):
        raise ValueError("Column names must be unique.")
    sample_name = "sample" if "sample" in header else "timestamp"
    if sample_name not in header or "value" not in header:
        raise ValueError("Expected sample,value or timestamp,value columns.")
    sample_column, value_column = header.index(sample_name), header.index("value")
    points = []
    for line, row in rows[1:]:
        if len(row) != len(header):
            raise ValueError(f"Row {line}: Expected {len(header)} columns.")
        label, raw = row[sample_column].strip(), row[value_column].strip()
        if not label or len(label) > 200:
            raise ValueError(f"Row {line}: Sample labels need 1–200 characters.")
        if not re.fullmatch(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?", raw, re.I):
            raise ValueError(f"Row {line}: Value must be a finite decimal number.")
        value = float(raw)
        if not math.isfinite(value) or abs(value) > 1e12:
            raise ValueError(f"Row {line}: Value must be finite and within ±1e12.")
        points.append({"sample": label, "value": value})
    if not 2 <= len(points) <= 10_000:
        raise ValueError("Provide 2–10,000 measurements.")
    return points


def detect_signals(values: list[float], mean: float, sigma: float) -> list[dict]:
    signals = []
    side_run, previous_side, trend_run, previous_direction = 0, 0, 1, 0
    sign = lambda x: (x > 0) - (x < 0)
    for index, value in enumerate(values):
        if value < mean - 3 * sigma or value > mean + 3 * sigma:
            signals.append({"index": index, "start": index, "rule": "beyond-limit"})
        side = sign(value - mean)
        side_run = 0 if side == 0 else side_run + 1 if side == previous_side else 1
        if side_run >= 8:
            signals.append({"index": index, "start": index - 7, "rule": "same-side"})
        previous_side = side
        if index > 0:
            direction = sign(value - values[index - 1])
            trend_run = 1 if direction == 0 else trend_run + 1 if direction == previous_direction else 2
            if trend_run >= 6:
                signals.append({"index": index, "start": index - 5, "rule": "trend"})
            previous_direction = direction
    return signals


def analyze(points: list[dict], baseline: int, lower: float, upper: float) -> dict:
    if not 2 <= len(points) <= 10_000:
        raise ValueError("Provide 2–10,000 measurements.")
    if isinstance(baseline, bool) or not isinstance(baseline, int) or not 2 <= baseline <= len(points):
        raise ValueError("Baseline must contain between 2 and all available measurements.")
    if not all(math.isfinite(value) and abs(value) <= 1e12 for value in [lower, upper]) or lower >= upper:
        raise ValueError("Specification limits must be finite, within ±1e12, and lower must be less than upper.")
    values = [point["value"] for point in points]
    if not all(math.isfinite(value) and abs(value) <= 1e12 for value in values):
        raise ValueError("All measurements must be finite and within ±1e12.")
    mean, m2, moving_total = 0.0, 0.0, 0.0
    for index, value in enumerate(values[:baseline]):
        delta = value - mean
        mean += delta / (index + 1)
        m2 += delta * (value - mean)
        if index:
            moving_total += abs(value - values[index - 1])
    moving_mean = moving_total / (baseline - 1)
    sigma = moving_mean / 1.128
    cp = (upper - lower) / (6 * sigma) if sigma > 0 else None
    cpk = min((upper - mean) / (3 * sigma), (mean - lower) / (3 * sigma)) if sigma > 0 else None
    if cp is not None and not math.isfinite(cp):
        cp = None
    if cpk is not None and not math.isfinite(cpk):
        cpk = None
    signals = detect_signals(values, mean, sigma)
    warnings = []
    if baseline < 25:
        warnings.append("A baseline below 25 observations is preliminary; collect more representative measurements.")
    if sigma == 0:
        warnings.append("The baseline has no measurable variation. Capability is undefined; check measurement resolution before interpreting limits.")
    if any(signal["index"] < baseline for signal in signals):
        warnings.append("The baseline itself contains rule signals. Investigate it before using these limits for monitoring.")
    if any(signal["index"] >= baseline for signal in signals):
        warnings.append("Monitoring data contains rule signals. Capability estimates describe the baseline and should not be used as a forecast for the shifted process.")
    return {
        "count": len(points), "baselineCount": baseline, "mean": mean,
        "sampleDeviation": math.sqrt(max(0, m2 / (baseline - 1))),
        "movingRangeMean": moving_mean, "sigma": sigma,
        "lowerControl": mean - 3 * sigma, "upperControl": mean + 3 * sigma,
        "cp": cp, "cpk": cpk, "outOfSpec": sum(value < lower or value > upper for value in values),
        "signals": signals, "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="Ordered measurement CSV, in millimetres")
    parser.add_argument("--baseline", type=int, default=25, help="Use the first N rows; default 25")
    parser.add_argument("--lower", type=float, required=True, help="Lower specification limit")
    parser.add_argument("--upper", type=float, required=True, help="Upper specification limit")
    args = parser.parse_args()
    try:
        if args.csv.stat().st_size > 1_048_576:
            raise ValueError("File exceeds the 1 MiB limit.")
        points = read_measurements(args.csv.read_text(encoding="utf-8-sig"))
        result = analyze(points, args.baseline, args.lower, args.upper)
        print(json.dumps({"schemaVersion": 1, "unit": "mm", "analysis": result}, indent=2, allow_nan=False))
        return 0
    except (OSError, UnicodeError, ValueError, csv.Error) as error:
        print(f"gaugeworks: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
