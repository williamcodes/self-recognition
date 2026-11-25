"""Text-only subscription CLI turns. Each caller supplies a private receipt directory."""
import dataclasses
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path


@dataclasses.dataclass(frozen=True)
class Turn:
    text: str
    session: dict
    model: str


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


@contextmanager
def _lock(path):
    with path.open("a") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        yield


def _save(path, data):
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent) as temp:
        json.dump(data, temp, ensure_ascii=False)
        temp.write("\n")
    os.replace(temp.name, path)


class SubscriptionRunner:
    """Replay completed keys, or execute one CLI turn. Pass returned session to continue."""

    def __init__(self, log_dir, workers=8, timeout=240, offline=False):
        self.logs = Path(log_dir).resolve()
        self.logs.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.private = Path.home() / ".cache" / "self-recognition-runs" / _digest(str(self.logs))[:24]
        self.private.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.slots = threading.BoundedSemaphore(workers)
        self.timeout = timeout
        self.offline = offline
        self._claude_auth_lock = threading.Lock()
        self._claude_auth_verified = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        """Sessions intentionally survive process restarts for checkpointed experiments."""

    def ask(self, model, prompt, *, cwd=None, session=None, key):
        backend = "claude" if model.startswith("claude-") else "codex"
        if session and (session["model"] != model or session["backend"] != backend):
            raise ValueError("A resumed session must use its original model and backend")
        base = self.logs / _digest(str(key))
        fingerprint = _digest([model, prompt, str(Path(cwd).resolve()) if cwd else None, session, key])
        with _lock(base.with_suffix(".lock")):
            receipt = base.with_suffix(".json")
            if receipt.exists():
                data = json.loads(receipt.read_text())
                if data["fingerprint"] != fingerprint:
                    raise ValueError(f"Receipt key already used for a different request: {key}")
                if data["state"] == "complete":
                    return Turn(**data["turn"])
                # The provider may already have advanced this session. Recover a completed log
                # without delivering the same message twice, otherwise leave the failure visible.
                return self._finish(base, data)
            if self.offline:
                raise RuntimeError(f"Offline replay has no receipt for {key}")
            location = Path(session["cwd"]) if session else (Path(cwd).resolve() if cwd else self.private / base.name)
            if cwd and location != Path(cwd).resolve():
                raise ValueError("A resumed session must use its original working directory")
            location.mkdir(mode=0o700, parents=True, exist_ok=True)
            data = dict(key=key, fingerprint=fingerprint, state="started", model=model,
                        backend=backend, cwd=str(location), prior=session)
            if session:
                seat_lock = self.private / (_digest([backend, session["id"]]) + ".lock")
            else:
                seat_lock = self.private / (base.name + ".new.lock")
            with self.slots, _lock(seat_lock):
                command, env = self._command(model, prompt, location, session)
                _save(receipt, data)
                with base.with_suffix(".stdout").open("w") as stdout, base.with_suffix(".stderr").open("w") as stderr:
                    result = subprocess.run(command, cwd=location, env=env, stdin=subprocess.DEVNULL,
                                            stdout=stdout, stderr=stderr, timeout=self.timeout)
                if result.returncode:
                    data["exit_code"] = result.returncode
                    _save(receipt, data)
                    raise RuntimeError(f"Subscription CLI failed for {key}; inspect {base}.stderr and .stdout")
                return self._finish(base, data)

    def _command(self, model, prompt, location, session):
        env = {k: v for k, v in os.environ.items()
               if not k.startswith(("OPENAI_", "ANTHROPIC_", "CLAUDE_CODE_USE_", "CODEX_", "AWS_"))}
        if model.startswith("claude-"):
            exe = shutil.which("claude")
            if not exe:
                raise FileNotFoundError("Claude subscription CLI is unavailable")
            with self._claude_auth_lock:
                if not self._claude_auth_verified:
                    result = subprocess.run([exe, "auth", "status", "--json"], cwd=location, env=env,
                                            capture_output=True, text=True, timeout=20)
                    account = json.loads(result.stdout) if result.returncode == 0 else {}
                    if not (account.get("loggedIn") and account.get("authMethod") == "claude.ai"
                            and account.get("apiProvider") == "firstParty" and account.get("subscriptionType")):
                        raise RuntimeError("A signed-in Claude subscription is required")
                    self._claude_auth_verified = True
            cmd = [exe, "-p", "--model", model, "--effort", "low", "--tools", "",
                   "--disable-slash-commands", "--setting-sources", "", "--output-format", "json"]
            if session:
                cmd += ["--resume", session["id"]]
            return cmd + [prompt], env
        home = self.private / "codex"
        home.mkdir(mode=0o700, exist_ok=True)
        auth = Path.home() / ".codex" / "auth.json"
        if not auth.is_file():
            raise FileNotFoundError("Codex subscription login is unavailable")
        login = json.loads(auth.read_text())
        if login.get("auth_mode") != "chatgpt" or not login.get("tokens") or login.get("OPENAI_API_KEY"):
            raise RuntimeError("A ChatGPT subscription login is required; API-key authentication is disabled")
        with _lock(self.private / "auth.lock"):
            if not (home / "auth.json").exists():
                (home / "auth.json").symlink_to(auth)
        env["CODEX_HOME"] = str(home)
        bundled = Path("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")
        exe = str(bundled) if bundled.exists() else shutil.which("codex")
        if not exe:
            raise FileNotFoundError("Codex subscription CLI is unavailable")
        cmd = [exe, "exec"]
        if session:
            cmd += ["resume"]
        else:
            cmd += ["-C", str(location), "-s", "read-only"]
        cmd += ["--skip-git-repo-check", "--json", "-m", model, "--disable", "shell_tool",
                "--disable", "unified_exec", "-c", 'model_reasoning_effort="low"']
        return cmd + ([session["id"]] if session else []) + [prompt], env

    def _finish(self, base, data):
        try:
            raw = base.with_suffix(".stdout").read_text()
            if data["backend"] == "claude":
                obj = json.loads(raw)
                if obj.get("is_error") or list(obj.get("modelUsage", {})) != [data["model"]]:
                    raise ValueError("Claude returned an error or a different model")
                session_id, answer = obj["session_id"], obj["result"]
            else:
                events = [json.loads(line) for line in raw.splitlines() if line.startswith("{")]
                if not events or events[-1]["type"] != "turn.completed":
                    raise ValueError("No completed Codex turn")
                items = [e["item"] for e in events if e.get("type") == "item.completed"]
                if any(i["type"] not in ("agent_message", "reasoning", "error") for i in items):
                    raise ValueError("A text-only session invoked a tool")
                session_id = next(e["thread_id"] for e in events if e["type"] == "thread.started")
                answer = [i["text"] for i in items if i["type"] == "agent_message"][-1]
            if not isinstance(answer, str) or not answer.strip():
                raise ValueError("Missing assistant text")
            if data["prior"] and session_id != data["prior"]["id"]:
                raise ValueError("CLI resumed a different conversation")
        except (KeyError, ValueError, IndexError, StopIteration, FileNotFoundError) as exc:
            raise RuntimeError(f"Unconfirmed turn {data['key']}; inspect {base}.stdout before resuming") from exc
        turn = Turn(answer.strip(), dict(id=session_id, backend=data["backend"], model=data["model"], cwd=data["cwd"]), data["model"])
        data.update(state="complete", turn=dataclasses.asdict(turn))
        _save(base.with_suffix(".json"), data)
        return turn
