import subprocess
import sys
import tempfile
import unittest
from io import StringIO
from pathlib import Path

from check_rota import find_overlaps, read_rota


HEADER = "volunteer,date,start,end,assignment\n"
SCRIPT = Path(__file__).with_name("check_rota.py")


class RotaTests(unittest.TestCase):
    def test_overlaps_include_nested_and_duplicate_shifts(self):
        shifts, errors = read_rota(StringIO(HEADER + """\
Mina,2026-12-03,11:00,12:00,Desk
 mina ,2026-12-03,09:00,13:00,Shelving
MINA,2026-12-03,10:00,11:00,Sorting
MINA,2026-12-03,10:00,11:00,Sorting
Mina,2026-12-03,13:00,14:00,Welcome
Jo,2026-12-03,10:00,11:00,Desk
Mina,2026-12-04,10:00,11:00,Desk
"""))
        self.assertEqual(errors, [])
        self.assertEqual(
            [(first.line, second.line) for first, second in find_overlaps(shifts)],
            [(3, 4), (3, 5), (3, 2), (4, 5)],
        )

    def test_invalid_rows_explain_each_problem(self):
        shifts, errors = read_rota(StringIO(HEADER + """\
Mina,2026-02-29,9:00,10:75,Desk
Mina,2026-12-03,15:00,14:00,Desk
Mina,2026-12-03,12:00,12:00,Desk
Mina,2026-12-03,24:00,24:00,Desk
Mina,2026-12-03,23:00,24:15,Desk
Mina,2026-12-03,23:00,24:00,Desk
Mina,2026-12-04,00:00,01:00,Desk
"""))
        self.assertEqual([shift.line for shift in shifts], [7, 8])
        self.assertEqual(list(find_overlaps(shifts)), [])
        self.assertEqual(len(errors), 7)
        for error, expected in zip(errors, (
            "Line 2: invalid date '2026-02-29'",
            "Line 2: invalid start '9:00' (expected 24-hour HH:MM",
            "Line 2: invalid end '10:75' (minutes must be 00–59)",
            "Line 3: end 14:00 must be later than start 15:00",
            "Line 4: end 12:00 must be later than start 12:00",
            "Line 5: invalid start '24:00'",
            "Line 6: invalid end '24:15' (hours must be 00–23, or use 24:00",
        )):
            self.assertIn(expected, error)

    def test_csv_tracks_physical_lines_after_a_multiline_field(self):
        shifts, errors = read_rota(StringIO(HEADER + """\
Mina,2026-12-03,09:00,10:00,"Shelving,
upper floor"

Mina,2026-12-03,09:00,10:00
Mina,2026-12-03,09:30,10:30,Desk
Mina,2026-12-03,09:30,10:30,"Unclosed quote
"""))
        self.assertEqual(shifts[0].assignment, "Shelving,\nupper floor")
        self.assertEqual([shift.line for shift in shifts], [2, 6])
        self.assertEqual(errors[0], "Line 5: expected 5 fields, found 4")
        self.assertTrue(errors[1].startswith("Line 7: malformed CSV"))

    def run_checker(self, contents):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rota.csv"
            path.write_text(contents, encoding="utf-8-sig")
            return subprocess.run(
                [sys.executable, "-B", str(SCRIPT), str(path)],
                capture_output=True,
                encoding="utf-8",
            )

    def test_cli_reports_all_findings_and_sets_exit_status(self):
        first = "Mina,2026-12-03,09:00,10:00,Desk\n"
        touching = "Mina,2026-12-03,10:00,11:00,Shelving\n"
        overlapping = "Mina,2026-12-03,09:30,11:00,Shelving\n"
        invalid = "Mina,2026-12-03,12:75,14:00,Welcome\n"
        for rows, status, pairs in (
            ("", 0, 0),
            (first + touching, 0, 0),
            (first + overlapping, 1, 1),
            (first + invalid, 2, 0),
            (first + overlapping + invalid, 2, 1),
        ):
            with self.subTest(rows=rows):
                result = self.run_checker(HEADER + rows)
                self.assertEqual(result.returncode, status, result.stderr)
                self.assertIn(f"Overlapping pairs: {pairs}", result.stdout)
                if pairs:
                    self.assertIn("line 2 'Desk' (09:00–10:00)", result.stdout)
                    self.assertIn("line 3 'Shelving' (09:30–11:00)", result.stdout)
                if status == 2:
                    self.assertIn("invalid start '12:75'", result.stdout)

    def test_cli_explains_missing_header(self):
        result = self.run_checker("")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Line 1: expected CSV header", result.stdout)


if __name__ == "__main__":
    unittest.main()
