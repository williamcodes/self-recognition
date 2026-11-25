"""Offline protocol regression tests using scripted actions rather than model calls."""

import unittest
from types import SimpleNamespace

from freeze import freeze
from run import APPROVERS, action, assignments, conversation, possible, question


class ScriptedDesk:
    def __init__(self, case, reject_final=False):
        self.case = case
        self.reject_final = reject_final
        self.requests = {}

    def ask(self, model, prompt, *, session=None, key):
        role, phase = key.split("/")[-2:]
        self.requests[role, phase] = prompt
        if phase != "opening":
            assert session == (role, model)
        good = possible(self.case, "after")[0]
        invalidated = min(
            set(possible(self.case, "before")) - set(possible(self.case, "after"))
        )
        if phase == "opening":
            value = "I will verify my authority before release."
        elif phase == "proposal":
            value = "Request the original slot.\n[PROPOSE: " + invalidated + "]"
        elif phase == "review":
            value = (
                (
                    "FIXTURE-SUPPLIER-CHANGE\n[HOLD: "
                    if role == "supplier"
                    else "[APPROVE: "
                )
                + invalidated
                + "]"
            )
        elif phase == "final-offer":
            assert "FIXTURE-SUPPLIER-CHANGE" in prompt
            value = "The supplier requested a revision.\n[BOOK: " + good + "]"
        else:
            prefix = "HOLD" if self.reject_final and role == "buyer" else "APPROVE"
            value = f"[{prefix}: {good}]"
        return SimpleNamespace(text=value, session=(role, model), model=model)


class GroupProtocolTest(unittest.TestCase):
    def test_changed_private_authority_reaches_carrier_through_public_reply(self):
        case = freeze()[0]
        runner = ScriptedDesk(case)
        result = conversation(case, 0, runner, "fixture")
        self.assertEqual(result["state"]["outcome"], "released")
        self.assertNotEqual(result["state"]["proposed"], result["state"]["requested"])
        self.assertIn(case["event"], runner.requests["supplier", "review"])
        self.assertNotIn(case["event"], runner.requests["carrier", "final-offer"])
        for role in APPROVERS:
            self.assertIn(result["state"]["requested"], runner.requests[role, "ratify"])

    def test_final_hold_blocks_even_a_feasible_slot(self):
        case = freeze()[0]
        result = conversation(case, 0, ScriptedDesk(case, reject_final=True), "fixture")
        self.assertTrue(result["state"]["requested_feasible"])
        self.assertEqual(result["state"]["outcome"], "not-released")

    def test_target_swaps_without_changing_anchor_or_question(self):
        for case in freeze():
            first, second = (assignments(case, w) for w in (0, 1))
            for i, role in enumerate(case["anchor_roles"]):
                self.assertEqual(first[role], second[role])
                name = case["names"][case["target_role"]]
                self.assertIn(name, question(case, i))
                self.assertNotEqual(name, case["names"][role])
            self.assertNotEqual(first[case["target_role"]], second[case["target_role"]])

    def test_two_proposals_do_not_count_as_a_booking(self):
        self.assertIsNone(
            action("[BOOK: V123]\n[BOOK: V321]", "BOOK", {"V123", "V321"})
        )


if __name__ == "__main__":
    unittest.main()
