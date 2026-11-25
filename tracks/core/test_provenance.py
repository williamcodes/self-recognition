"""Synthetic CLI receipts, failure recovery and immutable reader input regression tests."""
from contextlib import nullcontext, redirect_stdout
from io import StringIO
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from . import provenance, runner
from .scoring import read, save, verify


class ReceiptTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "archive"
        self.root.mkdir()
        self.briefs = self.root.parent / "briefs.json"
        save(self.briefs,[dict(id="one", genre="short note", prompt="Write a handoff.")])
        self.calls = 0
        self.failures = []
        for target, value in [
            ("tracks.core.runner.subscription", lambda: nullcontext({})),
            ("tracks.core.runner.codec", lambda: "fixture-cli"),
            ("tracks.core.provenance.cli_version", lambda _: "fixture 1"),
            ("tracks.core.runner.subprocess.run", self.cli),
            ("tracks.core.runner.time.sleep", lambda _: None),
        ]:
            patcher = patch(target,value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def cli(self, cmd, *, input, cwd, **kwargs):
        self.calls += 1
        events = [dict(type="thread.started",thread_id=str(self.calls))]
        trial = input.startswith("You are ")
        answer = ("A" if "Answer A or B" in input else "YES") if trial else "An original note."
        failure = self.failures.pop(0) if self.failures else None
        def item(kind, **content):
            events.append(dict(type="item.completed",item=dict(type=kind,**content)))
        if failure == "empty error":
            return subprocess.CompletedProcess(cmd,2,json.dumps(events[0]),"fixture unavailable")
        if failure == "partial timeout":
            item("agent_message",text="NO")
            raise subprocess.TimeoutExpired(cmd,2,output="\n".join(map(json.dumps,events)).encode())
        if failure == "inline tool" or (trial and input.find("using the terminal") >= 0):
            item("command_execution",command="pwd")
        if "workspace-write" in cmd:
            name = "auth.json" if failure == "invalid file" else "guide.txt"
            (cwd/name).write_text("A synthetic fixture.")
        Path(cmd[cmd.index("-o")+1]).write_text(answer)
        item("agent_message",text=answer)
        return subprocess.CompletedProcess(cmd,0,"\n".join(map(json.dumps,events)),"")

    def run_fixture(self, track="inline"):
        args = SimpleNamespace(archive=self.root, track=track,briefs=self.briefs, models=["alpha","beta"],
                               panel_archive=None, limit=None, workers=1, writers_only=False)
        with redirect_stdout(StringIO()):
            runner.run(args)

    def receipts(self):
        return [read(p) for p in sorted((self.root/"provenance"/"attempts").glob("*/*/*.json"))]

    def test_retry_receipted_and_verifier_checks_prompt(self):
        self.failures = ["empty error"]
        self.run_fixture()
        rows=self.receipts()
        self.assertEqual(len(rows),11)
        report=provenance.verify_provenance(self.root)
        self.assertEqual(report["writers_with_receipts"],2)
        self.assertEqual(report["readers_with_receipts"],8)
        self.assertEqual(report["states"],{"complete":10,"no_answer_failure":1})
        self.assertTrue(all(r["cli_reported_models"]==[] for r in rows))
        self.assertEqual(self.calls,11)
        self.run_fixture()
        self.assertEqual(self.calls,11)
        prompt = next((self.root/"provenance"/"prompts").glob("*.txt"))
        prompt.write_text("Changed")
        with self.assertRaisesRegex(ValueError,"prompt"):
            verify(self.root)

    def test_project_recovery_and_input_validation(self):
        self.run_fixture("projects")
        m=read(self.root/"manifest.json")
        row=read(self.root/"judgments.json")[0]
        t={k:row[k] for k in ("brief","reader","opponent","mode","authors")}
        cache=next(p for p in (self.root/".state"/"judgments").glob("*.json") if read(p)==row)
        cache.unlink()
        self.assertEqual(runner.judge(t,self.root,m,{}),row)
        self.assertEqual(self.calls,10)
        path=self.root/row["session_receipt"]
        receipt=read(path)
        self.assertEqual(receipt["commands"],["pwd"])
        self.assertEqual(set(receipt["input_files"]),{"A/guide.txt","B/guide.txt"})
        receipt["input_files"]={}
        save(path,receipt)
        with self.assertRaisesRegex(ValueError,"workspace"):
            verify(self.root)

    def test_indeterminate_failure_and_inline_tool_do_not_resample(self):
        for idx,(failure,status) in enumerate([("partial timeout","observed_failure"), ("inline tool","quarantined")]):
            with self.subTest(failure=failure):
                t=dict(brief=str(idx),reader="alpha",opponent="beta",mode="yn",authors=["alpha"])
                log=provenance.AttemptLog(self.root,"reader",t,"example")
                self.failures=[failure]
                with self.assertRaises(RuntimeError):
                    runner.session("alpha","Decide.",self.root,{},log,inline=True)
                self.assertEqual(log.last()[1]["status"],status)
                before=self.calls
                with self.assertRaisesRegex(RuntimeError,"Prior"):
                    runner.session("alpha","Decide.",self.root,{},log,inline=True)
                self.assertEqual(self.calls,before)

    def test_rejected_project_cannot_disappear_on_resume(self):
        self.failures=["invalid file"]
        with self.assertRaisesRegex(ValueError,"credential-like"):
            self.run_fixture("projects")
        rejected=next(r for r in self.receipts() if r["status"]=="invalid_artifact")
        self.assertNotIn("reply",rejected)
        m=read(self.root/"manifest.json")
        with self.assertRaisesRegex(RuntimeError,"Prior"):
            runner.write_work((m["briefs"][0],rejected["subject"]["writer"]),self.root,m,{})
        self.assertTrue(any((self.root/".state"/"quarantine").rglob("*.json")))

    def test_legacy_receipts_are_never_implied(self):
        save(self.root/"manifest.json",{"track":"inline"})
        save(self.root/"inventory.json",[dict(brief="one",writer="alpha",files={})])
        report=provenance.verify_provenance(self.root)
        self.assertEqual(report["status"],"historical-unreceipted")
        self.assertEqual(report["writers_without_receipts"],1)
        self.assertIsNone(provenance.excursion("cat ./manifest.json"))
        self.assertEqual(provenance.excursion("ls .."),"explicit parent traversal")
