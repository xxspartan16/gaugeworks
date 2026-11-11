import json
import unittest
from pathlib import Path

from gaugeworks import analyze, detect_signals, read_measurements


class GaugeworksTests(unittest.TestCase):
    def test_shared_numeric_fixtures(self):
        fixtures = json.loads((Path(__file__).parents[1] / "fixtures/parity.json").read_text())
        for fixture in fixtures["cases"]:
            with self.subTest(fixture=fixture["name"]):
                points = [{"sample": str(i), "value": value} for i, value in enumerate(fixture["values"])]
                result = analyze(points, fixture["baseline"], fixture["spec"]["lower"], fixture["spec"]["upper"])
                for key, expected in fixture["expected"].items():
                    if expected is None:
                        self.assertIsNone(result[key])
                    else:
                        self.assertAlmostEqual(result[key], expected, places=9)

    def test_quoted_csv(self):
        self.assertEqual(read_measurements('sample,value\n"A,part",1\n"B""part",2')[1]["sample"], 'B"part')

    def test_numeric_validation(self):
        for bad in ["NaN", "Infinity", "", "1e999", "0x10", "12mm"]:
            with self.subTest(value=bad), self.assertRaises(ValueError):
                read_measurements(f"sample,value\nA,1\nB,{bad}")

    def test_rejects_reversed_specs(self):
        with self.assertRaises(ValueError):
            analyze([{"value": 1}, {"value": 2}], 2, 4, 2)

    def test_strict_limit_boundary(self):
        self.assertEqual([signal["index"] for signal in detect_signals([7, 13, 13.1, 6.9], 10, 1)], [2, 3])

    def test_side_run_overlapping_windows(self):
        self.assertEqual([signal["index"] for signal in detect_signals([2] * 9, 0, 100)], [7, 8])

    def test_mean_breaks_run(self):
        self.assertEqual(detect_signals([2, 2, 2, 2, 0, 2, 2, 2, 2], 0, 100), [])

    def test_tie_breaks_trend(self):
        self.assertEqual(detect_signals([1, 2, 3, 3, 4, 5], 0, 100), [])

    def test_six_point_trend(self):
        self.assertEqual(detect_signals([1, 2, 3, 4, 5, 6], 0, 100), [{"index": 5, "start": 0, "rule": "trend"}])


if __name__ == "__main__":
    unittest.main()
