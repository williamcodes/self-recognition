#!/usr/bin/env python3
"""Check a library volunteer rota exported as CSV."""

import argparse
import csv
import re
import sys
from dataclasses import dataclass
from datetime import date
from itertools import groupby


HEADER = ["volunteer", "date", "start", "end", "assignment"]
DATE_FORMAT = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
TIME_FORMAT = re.compile(r"[0-9]{2}:[0-9]{2}")


@dataclass(frozen=True)
class Shift:
    line: int
    volunteer: str
    day: date
    start: int
    end: int
    assignment: str


def parse_date(value):
    if DATE_FORMAT.fullmatch(value):
        return date.fromisoformat(value)
    raise ValueError("expected YYYY-MM-DD")


def parse_time(value, *, is_end=False):
    if not TIME_FORMAT.fullmatch(value):
        raise ValueError("expected 24-hour HH:MM, such as 09:30")
    hours, minutes = map(int, value.split(":"))
    if is_end and (hours, minutes) == (24, 0):
        return 24 * 60
    if minutes >= 60:
        raise ValueError("minutes must be 00–59")
    if hours >= 24:
        allowed = "hours must be 00–23, or use 24:00 for midnight" if is_end else "hours must be 00–23"
        raise ValueError(allowed)
    return hours * 60 + minutes


def parse_row(row, line, errors):
    if len(row) != len(HEADER):
        errors.append(f"Line {line}: expected {len(HEADER)} fields, found {len(row)}")
        return None

    volunteer, day_text, start_text, end_text, assignment = map(str.strip, row)
    previous_error_count = len(errors)
    for field, value in (("volunteer", volunteer), ("assignment", assignment)):
        if not value:
            errors.append(f"Line {line}: {field} is required")

    parsed = {}
    for field, value, parse in (
        ("date", day_text, parse_date),
        ("start", start_text, parse_time),
        ("end", end_text, lambda value: parse_time(value, is_end=True)),
    ):
        try:
            parsed[field] = parse(value)
        except ValueError as error:
            errors.append(f"Line {line}: invalid {field} {value!r} ({error})")

    if previous_error_count != len(errors):
        return None
    if parsed["end"] <= parsed["start"]:
        errors.append(
            f"Line {line}: end {end_text} must be later than start {start_text}. "
            "Split overnight shifts at midnight."
        )
        return None
    return Shift(line, volunteer, parsed["date"], parsed["start"], parsed["end"], assignment)


def read_rota(source):
    reader = csv.reader(source, strict=True)
    shifts = []
    errors = []
    line = 1
    try:
        if next(reader, None) != HEADER:
            return shifts, [f"Line 1: expected CSV header {','.join(HEADER)}"]
        while True:
            line = reader.line_num + 1
            row = next(reader, None)
            if row is None:
                break
            if not row or (len(row) == 1 and not row[0].strip()):
                continue
            shift = parse_row(row, line, errors)
            if shift is not None:
                shifts.append(shift)
    except csv.Error as error:
        errors.append(f"Line {line}: malformed CSV ({error})")
    return shifts, errors


def volunteer_day(shift):
    return shift.volunteer.casefold(), shift.day


def find_overlaps(shifts):
    ordered = sorted(shifts, key=lambda shift: (*volunteer_day(shift), shift.start, shift.line))
    for _, group in groupby(ordered, key=volunteer_day):
        same_day = list(group)
        for index, first in enumerate(same_day):
            for later_index in range(index + 1, len(same_day)):
                second = same_day[later_index]
                if second.start >= first.end:
                    break
                yield first, second


def format_time(minutes):
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}"


def describe(shift):
    return (
        f"line {shift.line} {shift.assignment!r} "
        f"({format_time(shift.start)}–{format_time(shift.end)})"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", help="path to a UTF-8 rota CSV file")
    args = parser.parse_args()

    try:
        with open(args.csv_file, encoding="utf-8-sig", newline="") as source:
            shifts, errors = read_rota(source)
    except UnicodeDecodeError:
        print(f"Could not read {args.csv_file!r}. Export the rota as UTF-8 CSV.", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"Could not read {args.csv_file!r} ({error.strerror})", file=sys.stderr)
        return 2

    for error in errors:
        print(error)

    conflict_count = 0
    for first, second in find_overlaps(shifts):
        print(f"Overlap for {first.volunteer!r} on {first.day}: {describe(first)} and {describe(second)}")
        conflict_count += 1

    print(f"Valid assignments checked: {len(shifts)} | Overlapping pairs: {conflict_count}")
    if errors:
        return 2
    return int(conflict_count > 0)


if __name__ == "__main__":
    sys.exit(main())
