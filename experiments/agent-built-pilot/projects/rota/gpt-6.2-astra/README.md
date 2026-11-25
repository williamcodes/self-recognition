# Library rota checker

From this folder, run the checker with Python 3.7 or newer. It reads a local CSV file and prints its findings. It uses only the Python standard library.

    python3 rota.py sample.csv

The sample has five assignments and two issues. Robin's welcome desk shift ends exactly when shelving begins, so that handoff is fine. Story hour overlaps shelving by 15 minutes. Alex's reading room shift has an invalid end time of `10:75`. To try a clean run, copy the sample, change the story hour start to `11:30` and the reading room end to `10:45`, then run the checker on the copy.

## Prepare a rota

Export a comma-separated CSV in UTF-8 with these headers, once each, in any order.

    volunteer,date,start,end,assignment

- Use one row per assignment. Quote fields containing commas, such as `"Returns, east desk"`.
- Enter a calendar date as `YYYY-MM-DD`. Use two-digit 24-hour times from `00:00` through `23:59`. Each shift must end after it starts on the same date. Overnight shifts are outside the supported format.
- Use a consistent, distinct name or identifier for each volunteer. The checker ignores case and extra whitespace in volunteer names. It compares assignments on the same date across all desks and duties.

Findings refer to file line numbers, including the header as line 1. Correct invalid rows and rerun, since only valid rows participate in overlap checks. Each conflicting pair appears once. A blank line is skipped. A summary of zero assignment rows means the file contained only headers and possibly blank lines.

## Verify

    python3 -B -m unittest -v

The tests exercise the CSV checker and command-line exit codes. Exit code 0 means the check completed with no issues, 1 means the rota has findings, and 2 means the command or file could not be processed.
