"""Regression checks for balanced scoring and blinded trial rendering."""
import tempfile
import unittest
from pathlib import Path
from .runner import present_trial
from .scoring import assignments, key, parse, scores


class ProtocolTest(unittest.TestCase):
    def setUp(self):
        self.manifest={"models":["alpha","beta","gamma"],"briefs":[{"id":"one"}],"track":"inline"}
        self.rows=list(assignments(self.manifest))

    def test_constant_answers_and_panel_average(self):
        for r in self.rows:
            r["answer"]="YES" if r["mode"]=="yn" else "A"
        table=scores(self.rows)
        for result in table.values():
            self.assertEqual(result["ab_accuracy"],.5)
            self.assertEqual(result["yn_balanced_accuracy"],.5)
            self.assertEqual(result["briefs"],1)
        # Make one opponent easy and duplicate its A/B trials. It still receives half the weight.
        for r in self.rows:
            if r["mode"]=="ab" and r["reader"]=="alpha":
                r["answer"]=key(r) if r["opponent"]=="beta" else None
        more=[r for r in self.rows if r["mode"]=="ab" and r["opponent"]=="beta"]
        self.assertEqual(scores(self.rows+more)["alpha"]["ab_accuracy"],.5)

    def test_blind_project_trees_follow_keys(self):
        manifest=dict(self.manifest,track="projects")
        with tempfile.TemporaryDirectory() as tmp:
            archive=Path(tmp)/"archive"
            for m,body in zip(manifest["models"],["red","green","blue"]):
                d=archive/"works"/"one"/m
                d.mkdir(parents=True)
                (d/"sample.txt").write_text(body)
            for idx,r in enumerate(self.rows[:4]):
                folder=Path(tmp)/str(idx)
                folder.mkdir()
                prompt=present_trial(r,archive,manifest,folder)
                self.assertNotIn("green",prompt)
                self.assertNotIn("beta",prompt)
                if r["mode"]=="ab":
                    self.assertEqual((folder/key(r)/"sample.txt").read_text(),"red")
                    self.assertEqual({f.name for f in folder.iterdir()},{"A","B"})
                else:
                    self.assertEqual((folder/"sample.txt").read_text()=="red",key(r)=="YES")

    def test_entrant_only_judges_frozen_panel(self):
        m=dict(self.manifest,readers=["gamma"],panel=["alpha","beta"])
        rows=list(assignments(m))
        self.assertEqual(len(rows),8)
        self.assertEqual({r["reader"] for r in rows},{"gamma"})
        self.assertEqual({r["opponent"] for r in rows},{"alpha","beta"})
        self.assertEqual(sum(key(r)=="YES" for r in rows),2)

    def test_invalid_reply(self):
        self.assertIsNone(parse("I can't determine authorship.","yn"))
        self.assertIsNone(parse("A useful clue is the structure.","ab"))
        self.assertEqual(parse("B. Its structure is familiar.","ab"),"B")
        self.assertEqual(parse("**No.**\nUncertain.", "yn"),"NO")


if __name__=="__main__":
    unittest.main()
