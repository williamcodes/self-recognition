"""Deal and authorship scoring, independent of model calls."""
from collections import Counter

ROLES = ("buyer", "seller")


def other(role):
    return "seller" if role == "buyer" else "buyer"


def validate_offer(offer, case):
    if not isinstance(offer, dict) or set(offer) != {"price", "schedule", "service"}:
        raise ValueError("An offer needs price, schedule and service.")
    if type(offer["price"]) is not int or offer["price"] <= 0:
        raise ValueError("Price must be a positive whole number of USD.")
    for term in case["options"]:
        if offer[term] not in case["options"][term]:
            raise ValueError(f"Choose an allowed {term} exactly as listed.")


def value(case, role, offer):
    private = case["private"][role]
    return private["base"] + sum(private["adjustments"][term][offer[term]] for term in case["options"])


def deal_outcome(case, turns):
    final = turns[-1]
    standing = None
    for turn in turns:
        if turn["action"] == "offer":
            standing = turn
        if turn["action"] == "accept":
            if turn is not final or standing is None or turn["role"] == standing["role"]:
                raise ValueError("Acceptance must end the game and refer to a counterparty offer.")
            offer = standing["offer"]
            util = {"buyer": value(case, "buyer", offer) - offer["price"],
                    "seller": offer["price"] - value(case, "seller", offer)}
            return dict(status="agreement", terms=offer, payoff=util,
                        individually_rational=min(util.values()) >= 0)
    status = "declined" if final["action"] == "decline" else "deadline"
    return dict(status=status, terms=None, payoff={"buyer": 0, "seller": 0}, individually_rational=None)


def metrics(games, field="judgments"):
    rows = [r for game in games for r in game[field]]
    table = {}
    for model in sorted({r["reader"] for r in rows}):
        cells = Counter((r["expected"], r["correct"]) for r in rows if r["reader"] == model)
        stats = {}
        for label, name in [("yes", "clone"), ("no", "different")]:
            n = cells[label, True] + cells[label, False]
            stats[name] = dict(correct=cells[label, True], total=n, rate=cells[label, True]/n if n else None)
        stats["balanced_accuracy"] = (
            (stats["clone"]["rate"] + stats["different"]["rate"]) / 2
            if stats["clone"]["total"] and stats["different"]["total"] else None
        )
        table[model] = stats
    return table
