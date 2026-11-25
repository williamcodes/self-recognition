"""Build or verify the offline board brief from orchard-accounts.csv."""

import argparse
import csv
from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

DIRECTORY = Path(__file__).resolve().parent
SOURCE = DIRECTORY / "orchard-accounts.csv"
REPORT = DIRECTORY / "orchard-board-brief.html"


@dataclass(frozen=True)
class Accounts:
    season: str
    crates: int
    revenue: int
    cost: int

    @property
    def surplus(self):
        return self.revenue - self.cost

    @property
    def margin(self):
        return Fraction(100 * self.surplus, self.revenue)

    @property
    def revenue_per_crate(self):
        return Fraction(self.revenue, self.crates)

    @property
    def cost_per_crate(self):
        return Fraction(self.cost, self.crates)

    @property
    def surplus_per_crate(self):
        return Fraction(self.surplus, self.crates)


def read_accounts():
    with SOURCE.open(encoding="utf-8", newline="") as source:
        rows = [
            Accounts(row["season"], int(row["crates_sold"]),
                     int(row["revenue_crowns"]), int(row["operating_cost_crowns"]))
            for row in csv.DictReader(source)
        ]
    if [row.season for row in rows] != [str(year) for year in range(1924, 1930)]:
        raise ValueError("Expected one row per season, in order, from 1924 to 1929.")
    if any(row.crates <= 0 or row.revenue <= 0 or row.cost < 0 for row in rows):
        raise ValueError("Expected positive crates and revenue and nonnegative operating cost.")
    return rows


def combine(label, rows):
    return Accounts(label, sum(row.crates for row in rows),
                    sum(row.revenue for row in rows), sum(row.cost for row in rows))


def bridge(start, end):
    volume = (end.crates - start.crates) * start.surplus_per_crate
    revenue = end.crates * (end.revenue_per_crate - start.revenue_per_crate)
    cost = end.crates * (start.cost_per_crate - end.cost_per_crate)
    change = end.surplus - start.surplus
    if volume + revenue + cost != change:
        raise ArithmeticError(f"Surplus bridge failed for {start.season} to {end.season}.")
    return volume, revenue, cost, change


def number(value, places=0, signed=False):
    value = Fraction(value)
    decimal = Decimal(value.numerator) / Decimal(value.denominator)
    return format(decimal, f"{'+' if signed else ''},.{places}f").replace("-", "−")


def table_row(label, cells):
    return f'<tr><th scope="row">{label}</th>' + "".join(
        f"<td>{cell}</td>" for cell in cells
    ) + "</tr>"


def render(rows):
    first, _, prior, low, rebound, last = rows
    early = combine("1924–26 pooled", rows[:3])
    late = combine("1928–29 pooled", rows[4:])

    annual = "\n".join(table_row(row.season, [
        number(row.crates), number(row.revenue), number(row.cost), number(row.surplus),
        f"{number(row.margin, 2)}%", number(row.revenue_per_crate, 2),
        number(row.cost_per_crate, 2), number(row.surplus_per_crate, 2),
    ]) for row in rows)

    periods = "\n".join(table_row(row.season, [
        number(row.revenue), number(row.cost), number(row.surplus),
        f"{number(row.margin, 2)}%",
    ]) for row in (early, low, late))

    comparisons = ((prior, low), (low, rebound), (rebound, last), (first, last))
    bridge_rows = []
    for start, end in comparisons:
        volume, revenue, cost, change = bridge(start, end)
        bridge_rows.append(table_row(f"{start.season} → {end.season}", [
            number(volume, 2, True), number(revenue, 2, True),
            number(cost, 2, True), number(change, signed=True),
        ]))
    bridges = "\n".join(bridge_rows)

    scale = max(20, max(row.margin for row in rows))
    bars = "\n".join(
        f'<li><span>{row.season}</span><div class="track" aria-hidden="true">'
        f'<div class="bar {"arrival" if row == low else ""}" '
        f'style="--width:{float(100 * row.margin / scale):.6f}%"></div></div>'
        f'<strong>{number(row.margin, 2)}%</strong></li>'
        for row in rows
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Orchard Packing Cooperative | 1924–1929 Board Brief</title>
<style>
  :root {{
    color-scheme: light;
    --ink: #202820;
    --green: #254c36;
    --muted: #506052;
    --paper: #f7f6ef;
    --line: #ced6c9;
    --warm: #985126;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--paper); color: var(--ink);
          font: 1rem/1.55 system-ui, sans-serif; }}
  main {{ max-width: 73rem; margin: auto; padding: 3rem clamp(1rem, 4vw, 4rem); }}
  header {{ padding: 0 0 1.6rem; border-bottom: 3px solid var(--green); }}
  .context {{ margin: 0; color: var(--green); font-size: .82rem; font-weight: 750;
              letter-spacing: .12em; text-transform: uppercase; }}
  h1, h2 {{ font-family: Georgia, serif; color: var(--green); line-height: 1.14; }}
  h1 {{ font-size: clamp(2.35rem, 6vw, 4.25rem); margin: .35rem 0 .8rem; }}
  h2 {{ font-size: 1.75rem; margin: 0 0 .8rem; }}
  p {{ margin: 0 0 .8rem; }}
  header p:last-child, section p:last-child {{ margin-bottom: 0; }}
  .lead {{ font-size: 1.15rem; max-width: 49rem; }}
  .overview {{ display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }}
  section {{ padding: 1.55rem 0; border-bottom: 1px solid var(--line); }}
  .overview section {{ min-width: 0; }}
  .bars {{ padding: 0; list-style: none; margin: 0; }}
  .bars li {{ display: grid; grid-template-columns: 3rem 1fr 5rem; align-items: center;
              gap: .65rem; margin: .4rem 0; }}
  .bars strong {{ text-align: right; }}
  .track {{ background: #e4e9df; height: .65rem; border-radius: .2rem; }}
  .bar {{ width: var(--width); height: 100%; border-radius: inherit; background: var(--green); }}
  .bar.arrival {{ background: var(--warm); }}
  .scroll {{ overflow-x: auto; }}
  table {{ border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }}
  caption {{ text-align: left; color: var(--muted); margin-bottom: .45rem; }}
  th, td {{ padding: .45rem .6rem; border-bottom: 1px solid var(--line); text-align: right; }}
  th:first-child, td:first-child {{ text-align: left; white-space: nowrap; }}
  thead {{ background: #e6ebe1; color: var(--green); }}
  .annual td {{ white-space: nowrap; }}
  .note {{ color: var(--muted); font-size: .9rem; margin-top: .7rem; }}
  .method li {{ margin-bottom: .45rem; }}
  a {{ color: var(--green); text-underline-offset: .17em; }}
  code {{ overflow-wrap: anywhere; }}
  @media (max-width: 750px) {{
    main {{ padding-top: 1.5rem; }}
    .overview {{ grid-template-columns: 1fr; gap: 0; }}
  }}
  @media print {{
    body {{ background: white; font-size: 10pt; }}
    main {{ padding: 0; }}
    h1 {{ font-size: 28pt; }}
    section {{ break-inside: avoid; padding: 1rem 0; }}
    .overview {{ grid-template-columns: 1fr 1fr; gap: 1.4rem; }}
    .track, .bar, thead {{ print-color-adjust: exact; }}
  }}
</style>
</head>
<body>
<main>
<header>
  <p class="context">Board retrospective · 1924–1929</p>
  <h1>Orchard Packing Cooperative</h1>
  <p class="lead">Operating margin fell from <strong>{number(first.margin, 2)}%</strong> in 1924 to
  <strong>{number(low.margin, 2)}%</strong> in 1927, rebounded to
  <strong>{number(rebound.margin, 2)}%</strong> in 1928, and slipped to
  <strong>{number(last.margin, 2)}%</strong> in 1929. The rebound followed the late-1927 arrival of new
  sorting equipment. The accounts establish the timing and the change in recorded costs, while
  the equipment’s contribution remains unknown.</p>
</header>

<div class="overview">
<section aria-labelledby="margin-title">
  <h2 id="margin-title">Operating margin by season</h2>
  <ul class="bars" aria-label="Operating margin by season, percent of revenue">{bars}</ul>
  <p class="note">Bars start at zero. Sorting equipment arrived in late 1927.</p>
</section>
<section aria-labelledby="changes-title">
  <h2 id="changes-title">What changed</h2>
  <p><strong>1924–26 decline.</strong> Revenue per crate fell from {number(first.revenue_per_crate, 2)}
  to {number(prior.revenue_per_crate, 2)} crowns. Cost per crate also fell, but by less,
  and the margin narrowed even as crates sold increased.</p>
  <p><strong>1927 trough.</strong> From 1926, crates fell by {number(prior.crates - low.crates)} and
  cost per crate rose from {number(prior.cost_per_crate, 2)} to {number(low.cost_per_crate, 2)} crowns.
  Higher revenue per crate only partly offset the cost increase and lower volume.</p>
  <p><strong>1928 recovery.</strong> Surplus rose by {number(rebound.surplus - low.surplus)} crowns.
  The largest contribution in the surplus bridge came from lower recorded operating cost per crate.
  Volume rose, while revenue per crate fell.</p>
  <p><strong>1929 pullback.</strong> Crates reached a six-season high of {number(last.crates)}.
  Lower revenue per crate and higher operating cost per crate outweighed the volume gain.
  Surplus fell by {number(rebound.surplus - last.surplus)} crowns from 1928 and ended
  {number(first.surplus - last.surplus)} crowns below 1924.</p>
</section>
</div>

<section aria-labelledby="annual-title">
  <h2 id="annual-title">Annual accounts and margins</h2>
  <div class="scroll" tabindex="0" role="region" aria-label="Scrollable annual accounts table">
  <table class="annual">
    <caption>Monetary values in crowns. Per-crate columns use crates sold.</caption>
    <thead><tr><th scope="col">Season</th><th scope="col">Crates sold</th><th scope="col">Revenue</th>
    <th scope="col">Operating cost</th><th scope="col">Surplus</th><th scope="col">Margin</th>
    <th scope="col">Revenue / crate</th><th scope="col">Cost / crate</th>
    <th scope="col">Surplus / crate</th></tr></thead>
    <tbody>{annual}</tbody>
  </table>
  </div>
</section>

<section aria-labelledby="limits-title">
  <h2 id="limits-title">What the records support</h2>
  <p>The pooled 1928–29 margin was {number(late.margin, 2)}%, or
  {number(early.margin - late.margin, 2)} percentage points below 1924–26.
  The post-arrival seasons improved on the 1927 trough, and both remained below the 1924 margin.
  The pooled comparison places 1927 on its own because the equipment arrived late that year.</p>
  <div class="scroll" tabindex="0" role="region" aria-label="Scrollable period comparison table">
  <table>
    <caption>Pooled margins use total surplus divided by total revenue within each period.</caption>
    <thead><tr><th scope="col">Period</th><th scope="col">Revenue</th>
    <th scope="col">Operating cost</th><th scope="col">Surplus</th><th scope="col">Margin</th></tr></thead>
    <tbody>{periods}</tbody>
  </table>
  </div>
  <p class="note">The six annual totals provide no comparison that isolates the sorter’s effect.
  The accounts do not break out varieties, so changes in average revenue per crate cannot be
  separated into selling-price and variety-mix effects. Changes in operating cost per crate
  also cannot be assigned to sorting efficiency from these totals. Capital spending is not
  separately identified, so the records cannot establish the equipment’s full cost, payback,
  or return on investment.</p>
</section>

<section class="method" aria-labelledby="audit-title">
  <h2 id="audit-title">Surplus bridge and audit trail</h2>
  <div class="scroll" tabindex="0" role="region" aria-label="Scrollable surplus bridge table">
  <table>
    <caption>Change in operating surplus, in crowns. Positive contributions raise surplus.</caption>
    <thead><tr><th scope="col">Seasons</th><th scope="col">Crate volume</th>
    <th scope="col">Revenue per crate</th><th scope="col">Operating cost per crate</th>
    <th scope="col">Surplus change</th></tr></thead>
    <tbody>{bridges}</tbody>
  </table>
  </div>
  <ul>
    <li>Operating surplus = revenue − operating cost. Operating margin = 100 × surplus ÷ revenue.</li>
    <li>Volume contribution = change in crates × starting surplus per crate.</li>
    <li>Revenue contribution = ending crates × (ending revenue per crate − starting revenue per crate).</li>
    <li>Cost contribution = ending crates × (starting cost per crate − ending cost per crate).</li>
  </ul>
  <p>The bridge values the change in volume at starting rates and applies the change in unit rates to
  ending volume. Contributions reconcile to the observed surplus change before display rounding.
  They describe changes in the accounts without attributing them to the sorter.</p>
  <p>Source data and the reproducible report script ship with this brief. Run
  <code>python3 build_report.py --check</code> in this folder to verify the saved report against the CSV.
  Run <code>python3 build_report.py</code> to regenerate it.
  <a href="orchard-accounts.csv">Source accounts (CSV)</a> ·
  <a href="build_report.py">Report script (Python)</a></p>
</section>
</main>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the saved HTML.")
    args = parser.parse_args()
    report = render(read_accounts())
    if args.check:
        if not REPORT.is_file() or REPORT.read_text(encoding="utf-8") != report:
            parser.exit(1, f"{REPORT.name} is missing or differs from the calculated report.\n")
        print(f"Verified {REPORT.name} against {SOURCE.name}.")
    else:
        REPORT.write_text(report, encoding="utf-8")
        print(f"Wrote {REPORT.name}.")


if __name__ == "__main__":
    main()
