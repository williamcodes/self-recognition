"""Check a library volunteer rota in CSV format."""

import argparse
import csv
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

COLUMNS = ("volunteer", "date", "start", "end", "assignment")


@dataclass
class Shift:
    line: int
    volunteer: str
    date: str
    start: str
    end: str
    assignment: str

    def label(self):
        return f"line {self.line} ({self.assignment}, {self.start}–{self.end})"


def validate(shift):
    errors = []
    if not shift.volunteer:
        errors.append("volunteer is empty")
    if not shift.assignment:
        errors.append("assignment is empty")
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", shift.date):
            raise ValueError
        date.fromisoformat(shift.date)
    except ValueError:
        errors.append(f"date {shift.date!r} must be a real date in YYYY-MM-DD format")

    valid_times = True
    for field in ("start", "end"):
        value = getattr(shift, field)
        if not re.fullmatch(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]", value):
            errors.append(f"{field} {value!r} must use 24-hour HH:MM (00:00–23:59)")
            valid_times = False
    if valid_times and shift.start >= shift.end:
        errors.append(f"end {shift.end} must be later than start {shift.start} on the same date")
    return errors


def check(stream):
    reader = csv.reader(stream, strict=True)
    header = next(reader, [])
    fields = [field.strip() for field in header]
    if sorted(fields) != sorted(COLUMNS):
        raise ValueError("expected each of these column headers once: " + ", ".join(COLUMNS))

    groups = defaultdict(list)
    issues = []
    count = 0
    while True:
        line = reader.line_num + 1
        try:
            row = next(reader)
        except StopIteration:
            break
        except csv.Error as error:
            raise ValueError(f"CSV record starting at line {line}: {error}") from error
        if not row:
            continue
        count += 1
        if len(row) != len(fields):
            issues.append(f"Line {line}: expected {len(fields)} fields, found {len(row)}")
            continue
        shift = Shift(line=line, **dict(zip(fields, (cell.strip() for cell in row))))
        errors = validate(shift)
        if errors:
            issues.append(f"Line {line}: " + "; ".join(errors))
            continue
        name_key = " ".join(shift.volunteer.casefold().split())
        groups[name_key, shift.date].append(shift)

    for shifts in groups.values():
        active = []
        for shift in sorted(shifts, key=lambda item: (item.start, item.line)):
            active = [other for other in active if other.end > shift.start]
            for other in active:
                issues.append(f"Overlap for {shift.volunteer} on {shift.date}: "
                              f"{other.label()} and {shift.label()}")
            active.append(shift)
    return count, issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rota", help="path to a UTF-8 CSV rota")
    args = parser.parse_args()
    try:
        with open(args.rota, encoding="utf-8-sig", newline="") as stream:
            count, issues = check(stream)
    except (OSError, ValueError, csv.Error) as error:
        print(f"Cannot check {args.rota}: {error}", file=sys.stderr)
        return 2
    for issue in issues:
        print(issue)
    print(f"Assignment rows: {count}. Issues: {len(issues)}.")
    return int(bool(issues))


if __name__ == "__main__":
    sys.exit(main())
