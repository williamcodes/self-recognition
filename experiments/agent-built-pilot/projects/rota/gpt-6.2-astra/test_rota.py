import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from rota import check

ROOT = Path(__file__).resolve().parent
HEADER = "volunteer,date,start,end,assignment\n"


class RotaTests(unittest.TestCase):
    def test_nested_unsorted_and_touching(self):
        rows = [
            "Robin Lee,2026-12-05,10:00,11:00,B",
            "Robin Lee,2026-12-05,11:00,12:00,C",
            " robin   LEE ,2026-12-05,09:00,12:00,A",
            "Kim,2026-12-05,09:00,12:00,D",
            "Robin Lee,2026-12-06,09:00,12:00,E",
        ]
        count, issues = check(io.StringIO(HEADER + "\n".join(rows)))
        self.assertEqual(count, 5)
        self.assertEqual(len(issues), 2)
        for issue, line in zip(issues, (2, 3)):
            self.assertIn("line 4", issue)
            self.assertIn(f"line {line}", issue)

    def test_invalid_fields(self):
        for start, end, expected in [
            ("", "10:00", "start ''"),
            ("9:00", "10:00", "start '9:00'"),
            ("09:00", "24:00", "end '24:00'"),
            ("09:00", "09:60", "end '09:60'"),
            ("09:00", "09:00", "later than start"),
            ("10:00", "09:00", "later than start"),
        ]:
            with self.subTest(start=start, end=end):
                _, issues = check(io.StringIO(HEADER + f"Jo,2025-02-29,{start},{end},Desk"))
                self.assertEqual(len(issues), 1)
                for fragment in ("Line 2", "date '2025-02-29'", expected):
                    self.assertIn(fragment, issues[0])

    def test_cli(self):
        def run(path):
            return subprocess.run([sys.executable, str(ROOT / "rota.py"), str(path)],
                                  capture_output=True, text=True)

        sample = run(ROOT / "sample.csv")
        self.assertEqual(sample.returncode, 1)
        for fragment in ("Line 6", "line 3", "line 4", "Issues: 2"):
            self.assertIn(fragment, sample.stdout)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "rota.csv"
            self.assertEqual(run(path).returncode, 2)
            path.write_text("volunteer,start\n", encoding="utf-8")
            self.assertEqual(run(path).returncode, 2)
            path.write_text('assignment,date,volunteer,start,end\n'
                            '"Desk, west",2024-02-29,Jules,09:00,10:00\n',
                            encoding="utf-8-sig")
            clean = run(path)
            self.assertEqual(clean.returncode, 0)
            self.assertIn("Assignment rows: 1. Issues: 0.", clean.stdout)
