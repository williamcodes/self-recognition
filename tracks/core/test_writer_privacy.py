"""Use invented paths and receipts to test public redaction and archive migration."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from .provenance import AttemptLog
from .scoring import read, save
from .writer_privacy import command_hash, migrate, private_path, redact, verify_redaction


class WriterPrivacyTest(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        self.home=self.root/"invented account"
        self.subject=dict(writer="synthetic",brief="one")
        self.folder=self.root/"workspace"
        self.folder.mkdir()
        who=patch("pathlib.Path.home",return_value=self.home)
        who.start()
        self.addCleanup(who.stop)

    def test_only_paths_under_actual_home_change(self):
        self.assertEqual(redact([f"'{self.home}/a' '{self.home}' '{self.home}2/x'"],self.home),
                         [f"'<OPERATOR_HOME>/a' '<OPERATOR_HOME>' '{self.home}2/x'"])

    def test_migration_is_idempotent_and_writer_only(self):
        path=self.root/"provenance/attempts/writer/fixture/000001.json"
        orig=dict(kind="writer",subject=self.subject,status="complete",commands=[f"list '{self.home}/example'"],
                  files={"work.txt":"abc"},stdout_sha256="old-out",stderr_sha256="old-err")
        save(path,orig)
        old=path.read_bytes()
        reader=self.root/"provenance/attempts/reader/fixture/000001.json"
        save(reader,dict(kind="reader",commands=orig["commands"]))
        reader_bytes=reader.read_bytes()
        save(self.root/"inventory.json",[dict(**self.subject,files=orig["files"])])
        self.assertEqual(migrate(self.root)["eligible"],1)
        self.assertEqual(path.read_bytes(),old)
        self.assertFalse(private_path(self.root,path).exists())
        self.assertEqual(migrate(self.root,True)["eligible"],1)
        self.assertEqual(private_path(self.root,path).read_bytes(),old)
        self.assertEqual(reader.read_bytes(),reader_bytes)
        a=read(path)
        self.assertEqual(a["commands"],["list '<OPERATOR_HOME>/example'"])
        self.assertEqual(a["command_redaction"]["original_sha256"],command_hash(orig["commands"]))
        self.assertEqual({k:a[k] for k in orig if k!="commands"},{k:v for k,v in orig.items() if k!="commands"})
        self.assertEqual(migrate(self.root,True)["already_redacted"],1)
        a["commands"]=["different"];a["command_redaction"]["public_sha256"]=command_hash(a["commands"])
        with self.assertRaises(ValueError):
            verify_redaction(self.root,path,a)

    def test_future_writer_has_no_unredacted_public_command(self):
        a=AttemptLog(self.root,"writer",self.subject,"contract")
        with patch("tracks.core.provenance.cli_version",return_value="fixture"):
            a.start("Synthetic prompt","fixture","synthetic","workspace-write",False)
        original=f"list '{self.home}/manual'"
        raw=json.dumps(dict(type="item.completed",item=dict(type="command_execution",command=original)))
        a.observed(raw,"err","reply",self.folder,rc=0)
        fields=read(a.path)
        verify_redaction(self.root,a.path,fields)
        self.assertNotIn(str(self.home),a.path.read_text())
        self.assertEqual(fields["command_redaction"]["original_sha256"],command_hash([original]))
        self.assertEqual(fields["stdout_sha256"],hashlib.sha256(raw.encode()).hexdigest())
        self.assertEqual(read(private_path(self.root,a.path))["commands"],[original])
