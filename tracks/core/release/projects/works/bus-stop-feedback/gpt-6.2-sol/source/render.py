"""Render the meeting poster and handout from the survey counts."""

import csv
from decimal import Decimal, ROUND_HALF_UP
from html import escape
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
STOPS = ("Mill Street", "Orchard Lane", "Market Square")
MONTHS = ("May", "August")
CHOICES = (("bench", "Bench"), ("shade", "Shade"), ("route_map", "Route map"))

INK = "#142F35"
MUTED = "#405E63"
PAPER = "#F4F2E9"
WHITE = "#FFFFFF"
GRID = "#D4DEDB"
TEAL = "#087669"
PALE = "#E3F1EB"
GOLD = "#F7CE76"


def read_counts():
    with (ROOT / "survey-counts.csv").open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    return {
        (row["stop"], row["month"]): tuple(int(row[key]) for key, _ in CHOICES)
        for row in rows
    }


def share(count, total):
    return Decimal(100) * count / total


def percent(value, places=0):
    unit = Decimal(1).scaleb(-places)
    return f"{value.quantize(unit, rounding=ROUND_HALF_UP):f}%"


class Drawing:
    def __init__(self, width, height, title):
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}pt" '
            f'height="{height}pt" viewBox="0 0 {width} {height}">',
            f"<title>{escape(title)}</title>",
        ]

    def rect(self, x, y, width, height, fill, radius=0, stroke="none", weight=1):
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{weight}"/>'
        )

    def line(self, x1, y1, x2, y2, color, weight=1):
        self.parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{color}" stroke-width="{weight}"/>'
        )

    def text(self, x, y, content, size, weight=400, color=INK, align="start", spacing=0):
        self.parts.append(
            f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" '
            f'font-family="Helvetica, sans-serif" font-weight="{weight}" '
            f'text-anchor="{align}" letter-spacing="{spacing}">{escape(content)}</text>'
        )

    def bus(self):
        self.parts.append(f"""
          <g transform="translate(983 103)" fill="none" stroke="{GOLD}"
             stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="108" cy="104" r="101" stroke="#537573" stroke-width="2"/>
            <path d="M70 147v13m76-13v13M60 110V68q0-15 15-15h66q15 0 15 15v63q0 14-14 14H74q-14 0-14-14v-21zm0-10h96M93 53v47"/>
            <circle cx="80" cy="124" r="4" fill="{GOLD}"/>
            <circle cx="136" cy="124" r="4" fill="{GOLD}"/>
          </g>
        """)

    def pdf(self, filename):
        svg = "\n".join([*self.parts, "</svg>"]).encode("utf-8")
        result = subprocess.run(
            ["rsvg-convert", "--format=pdf1.4"],
            input=svg,
            capture_output=True,
            check=True,
        )
        # Blank the automatic producer field while preserving PDF byte offsets.
        pdf = re.sub(rb"/Producer \([^\r\n]*\)", lambda match: b" " * len(match[0]), result.stdout)
        (ROOT / filename).write_bytes(pdf)


def render_poster(counts):
    poster = Drawing(1296, 1728, "What riders wanted at their bus stop")
    poster.rect(0, 0, 1296, 1728, PAPER)
    poster.rect(0, 0, 1296, 386, INK)
    poster.rect(76, 47, 45, 6, GOLD)
    poster.text(76, 89, "NEIGHBORHOOD BUS STOP SURVEY", 23, 600, GOLD, spacing=2.1)
    poster.text(72, 184, "What riders wanted", 92, 700, WHITE)
    poster.text(72, 278, "at their bus stop", 92, 700, WHITE)
    poster.text(76, 338, "May and August results from fictional surveys", 31, 400, WHITE)
    poster.bus()

    poster.text(76, 464, "Share of responses", 38, 700)
    poster.rect(822, 439, 48, 24, WHITE, 4, TEAL, 3)
    poster.text(888, 463, "May", 30, 600)
    poster.rect(1004, 439, 48, 24, TEAL, 4)
    poster.text(1070, 463, "August", 30, 600)
    poster.line(76, 494, 1220, 494, GRID, 2)

    columns = (106, 486, 866)
    scale = 252 / 60
    for x, (_, label) in zip(columns, CHOICES):
        poster.text(x, 550, label, 40, 700)
        for tick in (0, 20, 40, 60):
            poster.text(x + tick * scale, 589, f"{tick}%", 23, 400, MUTED, "middle")

    for stop, top in zip(STOPS, (610, 866, 1122)):
        may, august = (counts[stop, month] for month in MONTHS)
        poster.rect(76, top, 1144, 232, WHITE, 16)
        poster.text(106, top + 52, stop, 43, 700)
        poster.text(
            1186, top + 49, f"Responses   May {sum(may)}  ·  August {sum(august)}",
            25, 500, MUTED, "end",
        )
        for choice_index, x in enumerate(columns):
            for tick in (0, 20, 40, 60):
                color = MUTED if tick == 0 else GRID
                poster.line(x + tick * scale, top + 76, x + tick * scale, top + 207, color, 2)
            for row, bar_y, filled in ((may, top + 91, False), (august, top + 154, True)):
                value = share(row[choice_index], sum(row))
                width = float(value) * scale
                fill = TEAL if filled else WHITE
                poster.rect(x, bar_y, round(width, 3), 29, fill, 3, TEAL, 3)
                poster.text(x + width + 12, bar_y + 25, percent(value), 31, 700)

    poster.rect(76, 1385, 1144, 173, PALE, 16)
    poster.rect(96, 1410, 7, 122, TEAL, 3)
    poster.text(121, 1453, "Shade moved into first place at Mill Street.", 44, 700)
    poster.text(121, 1505, "Shade stayed first at Orchard Lane. A route map stayed first at Market Square.", 29)

    poster.line(76, 1600, 1220, 1600, GRID, 2)
    poster.text(76, 1642, "Each respondent picked one option. Shares use each stop’s total for that month", 26, 400, MUTED)
    poster.text(76, 1678, "and are rounded to the nearest whole percent. See the handout for counts.", 26, 400, MUTED)
    poster.pdf("bus-stop-poster.pdf")


def render_handout(counts):
    handout = Drawing(612, 792, "Bus stop survey details")
    handout.rect(0, 0, 612, 792, WHITE)
    handout.rect(36, 33, 26, 4, TEAL)
    handout.text(36, 56, "NEIGHBORHOOD BUS STOP SURVEY", 10.5, 600, TEAL, spacing=1.35)
    handout.text(35, 94, "Bus stop survey details", 35, 700)
    handout.text(36, 119, "Passenger preferences in fictional May and August surveys", 14, 400, MUTED)
    handout.rect(36, 137, 540, 56, PALE, 5)
    handout.text(48, 159, "Shade moved into first place at Mill Street in August.", 15, 700)
    handout.text(48, 178, "Shade stayed first at Orchard Lane. A route map stayed first at Market Square.", 12.1)

    numeric_columns = (280, 367, 459, 548)
    for stop, top in zip(STOPS, (213, 371, 529)):
        may, august = (counts[stop, month] for month in MONTHS)
        handout.rect(36, top, 540, 28, INK, 4)
        handout.text(48, top + 19, stop, 15, 700, WHITE)
        handout.text(323.5, top + 45, "May", 12, 700, INK, "middle")
        handout.text(503.5, top + 45, "August", 12, 700, INK, "middle")
        for x, header in zip(numeric_columns, ("Count", "Share", "Count", "Share")):
            handout.text(x, top + 62, header, 10.5, 500, MUTED, "end")
        handout.text(48, top + 62, "Choice", 10.5, 500, MUTED)
        handout.line(36, top + 68, 576, top + 68, GRID)
        for index, (_, label) in enumerate(CHOICES):
            y = top + 84 + index * 18
            handout.text(48, y, label, 12)
            row = (
                str(may[index]), percent(share(may[index], sum(may)), 1),
                str(august[index]), percent(share(august[index], sum(august)), 1),
            )
            for x, value in zip(numeric_columns, row):
                handout.text(x, y, value, 12, 400, INK, "end")
        handout.rect(36, top + 125, 540, 22, PALE, 3)
        handout.text(48, top + 140, "Total responses", 12, 700)
        for x, value in zip(numeric_columns, (str(sum(may)), "100%", str(sum(august)), "100%")):
            handout.text(x, top + 140, value, 12, 700, INK, "end")

    handout.line(36, 698, 576, 698, GRID)
    handout.text(36, 719, "Each respondent picked one option. A share is the count for an option divided by the", 11.5, 400, MUTED)
    handout.text(36, 736, "total responses at that stop in that month. Shares are rounded to one decimal place.", 11.5, 400, MUTED)
    handout.text(36, 753, "Rounded shares can add up to slightly more or less than 100%.", 11.5, 400, MUTED)
    handout.pdf("bus-stop-handout.pdf")


if __name__ == "__main__":
    survey = read_counts()
    render_poster(survey)
    render_handout(survey)
