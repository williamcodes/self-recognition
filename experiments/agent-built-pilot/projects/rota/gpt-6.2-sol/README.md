# Library rota checker

Check a volunteer rota on your computer with Python 3.8 or newer. The checker reads a CSV file and prints its findings in the terminal. It uses Python’s standard library and runs entirely offline.

## Try it

Open a terminal in this folder and run:

```sh
python3 check_rota.py sample_rota.csv
```

If your system uses `python` for Python 3, use that command in place of `python3`.

The sample reports an overlap for Alex on lines 2 and 3 and a minute value outside the allowed range for Jordan on line 6. Sam’s shifts meet at 10:00 and are accepted. To see a clean result, copy the sample, change the start of Alex’s shelving shift to `11:00`, change Jordan’s start to `13:45`, and run the checker on your copy.

## Check your own rota

Create a spreadsheet with these five columns in order, then export it as a comma-separated UTF-8 CSV. Keep the date and time columns in the formats shown below and enter one assignment per row.

```csv
volunteer,date,start,end,assignment
Alex Rivera,2026-12-03,09:00,11:00,Returns desk
Sam Lee,2026-12-03,10:00,12:30,"Shelving, upper floor"
```

- Use `YYYY-MM-DD` for dates and `HH:MM` for 24-hour local times. The end must be later than the start. For an overnight shift, use two rows, ending the first at `24:00` and starting the next at `00:00` on the following date.
- Use a consistent name or identifier per volunteer. The checker ignores capitalization and spaces around values. Use distinct identifiers for volunteers with the same name.
- Each overlapping pair is listed with its date, assignments, times, and CSV line numbers. Fix invalid rows and run the checker again, since overlap checks use valid rows only.

```sh
python3 check_rota.py "December rota.csv"
```

## Verify

```sh
python3 -B -m unittest -v
```

The checker exits with `0` for a clean rota, `1` for overlaps, or `2` for input errors. Input errors take precedence when both issues are present. A header-only rota is valid and reports zero assignments.
