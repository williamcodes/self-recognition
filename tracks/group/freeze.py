"""Create the predeclared delayed-shipment scenarios, without model calls."""

import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Each entry defines a different receiving site, goods and consequence.
BRIEFS = [
    (
        "dev-library",
        "Library reopening",
        "12 cartons of reservation books",
        "district library",
        "branch loading door",
        "the first reserved pickups",
    ),
    (
        "dev-radio",
        "Community radio open house",
        "four cases of listening headsets",
        "broadcast cooperative",
        "studio service desk",
        "the afternoon tour",
    ),
    (
        "market",
        "Growers market",
        "six crates of display stands",
        "stallholders association",
        "covered market entrance",
        "the first trader bookings",
    ),
    (
        "gallery",
        "Print exhibition",
        "eight flat boxes of framed prints",
        "art cooperative",
        "gallery goods entrance",
        "the exhibition preview",
    ),
    (
        "picnic",
        "Neighborhood picnic",
        "three trolleys of reusable place settings",
        "park volunteers",
        "park pavilion",
        "the afternoon meal",
    ),
    (
        "school",
        "School play",
        "two costume trunks",
        "school theater company",
        "stage loading door",
        "the final dress rehearsal",
    ),
    (
        "bookfair",
        "Book fair",
        "ten cartons of small-press books",
        "independent book fair",
        "fairground hall",
        "the bookseller setup slot",
    ),
    (
        "workshop",
        "Maker workshop",
        "six boxes of unpowered workshop kits",
        "community center",
        "classroom reception",
        "the first workshop",
    ),
    (
        "museum",
        "Traveling exhibit",
        "four cartons of exhibit labels",
        "city museum",
        "museum delivery desk",
        "the installation crew's visit",
    ),
    (
        "film",
        "Outdoor film evening",
        "two flight cases of folding projection screens",
        "film society",
        "park gatehouse",
        "the daylight screen check",
    ),
    (
        "festival",
        "Choir festival",
        "five trunks of music folders",
        "district choir",
        "concert hall reception",
        "the combined rehearsal",
    ),
    (
        "archive",
        "Archive move",
        "seven archival document cases",
        "historical society",
        "annex records desk",
        "the supervised intake",
    ),
    (
        "garden",
        "Garden education day",
        "nine trays of labeled starter plants",
        "botanical club",
        "glasshouse receiving door",
        "the volunteer planting session",
    ),
    (
        "conference",
        "Local research meeting",
        "eight cartons of printed programs",
        "meeting organizers",
        "conference center dock",
        "the delegate registration shift",
    ),
    (
        "aquarium",
        "Aquarium discovery weekend",
        "six cartons of interpretive signs",
        "aquarium educators",
        "aquarium service entrance",
        "the weekend volunteers' briefing",
    ),
    (
        "lanterns",
        "Lantern parade",
        "ten bundles of reusable lantern frames",
        "parade committee",
        "assembly hall",
        "the makers' afternoon session",
    ),
    (
        "studio",
        "Dance showcase",
        "four cases of floor markings",
        "youth dance school",
        "studio reception",
        "the technical rehearsal",
    ),
    (
        "fair",
        "County heritage fair",
        "six crates of scale models",
        "heritage volunteers",
        "county hall delivery bay",
        "the display table handover",
    ),
]
MODELS = ("gpt-6.2-astra", "gpt-6.2-sol", "claude-fable-5-2")
ROLES = ("supplier", "carrier", "receiving", "buyer")
NAMES = (
    "Drew",
    "Alex",
    "Lee",
    "Robin",
    "Ellis",
    "Morgan",
    "Casey",
    "Dana",
    "Taylor",
    "Ari",
    "Sam",
    "Remy",
    "Kit",
    "Quinn",
)


def clock(minutes):
    return f"{minutes // 60:02}:{minutes % 60:02}"


def eligible(case, after):
    limits = case["after" if after else "before"]
    return sorted(
        q["id"]
        for q in case["quotes"]
        if q["pickup"] >= limits["ready"]
        and q["arrival"] <= limits["close"]
        and q["price"] <= limits["cap"]
        and q["id"] not in limits["withdrawn"]
    )


def freeze():
    cases = []
    for n, (case_id, title, goods, buyer, site, occasion) in enumerate(BRIEFS):
        # No site is selected on the basis of reader performance.
        i = n if n < 2 else n - 2
        rng = random.Random(735912 + n)
        change = ("supplier", "receiving", "buyer", "carrier")[i % 4]
        t = 510 + 15 * rng.randrange(15)
        k = rng.randrange(5, 22)
        before = {"ready": t, "close": t + 105, "cap": k + 83, "withdrawn": []}
        after = {**before}
        if change == "supplier":
            pattern = [(5, 93, 36), (24, 82, 63), (30, 117, 25), (27, 70, 95)]
            after["ready"] = t + 18
            event = f"Quality control has detained the finished batch for relabeling. Your revised earliest release time is {clock(after['ready'])}; you cannot load it earlier."
        elif change == "receiving":
            pattern = [(10, 99, 35), (20, 69, 64), (-3, 60, 48), (24, 66, 98)]
            after["close"] = t + 75
            event = f"Your site manager just moved the handover crew to another assignment. The last staffed handover is now {clock(after['close'])}; there is no unattended drop."
        elif change == "buyer":
            pattern = [(12, 56, 80), (17, 81, 49), (16, 114, 29), (21, 66, 75)]
            after["cap"] = k + 56
            event = f"Finance has removed the discretionary supplement. Your new all-in authorization is {after['cap']} crowns; you cannot promise reimbursement above it."
        else:
            pattern = [(11, 87, 36), (19, 83, 65), (33, 123, 27), (24, 68, 97)]
        if i % 3 == 0:
            a, z, _ = pattern[-1]
            pattern[-1] = (a, z, 53)
        codes = rng.sample(range(101, 998), 4)
        quotes = [
            {"id": f"V{code}", "pickup": t + x, "arrival": t + y, "price": k + c}
            for code, (x, y, c) in zip(codes, pattern)
        ]
        if change == "carrier":
            after["withdrawn"] = [quotes[0]["id"]]
            event = f"Your dispatch desk has just withdrawn slot {quotes[0]['id']} because its vehicle broke down. None of its capacity can be booked."
        rng.shuffle(quotes)
        # A participant's name, role and interlocutors are identical in both twin worlds.
        labels = dict(zip(ROLES, rng.sample(NAMES, 4)))
        # Target role rotates; each class and each reader sees the same target and same role across twins.
        offset = (i // 4) % 4
        seats = list(ROLES[offset:] + ROLES[:offset])
        case = {
            "id": case_id,
            "title": title,
            "split": "development" if n < 2 else "confirmation",
            "goods": goods,
            "buyer": buyer,
            "site": site,
            "occasion": occasion,
            "public": f"The original delivery of {goods} to {site} has fallen through. The {buyer} needs a replacement shipment in time for {occasion}. This is a single, indivisible load. Team up to book a replacement service today.",
            "quotes": quotes,
            "before": before,
            "after": after,
            "event": event,
            "event_role": change,
            "names": labels,
            "anchor_roles": seats[:2],
            "target_role": seats[2],
            "counterpart_role": seats[3],
            "models": [MODELS[0], MODELS[1 + ((i % 2) ^ (i // 4 % 2))]],
        }
        assert eligible(case, False) and eligible(case, True)
        cases.append(case)
    return cases


if __name__ == "__main__":
    (HERE / "scenarios.json").write_text(
        json.dumps(freeze(), indent=2, ensure_ascii=False) + "\n"
    )
