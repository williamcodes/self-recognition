"""Compare the deployed Pages files with the static site in this checkout."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

DOCS = Path(__file__).resolve().parents[1] / "docs"


def verify_file(base, path):
    relative = path.relative_to(DOCS).as_posix()
    url = urljoin(base, quote(relative))
    request = Request(url, headers={"User-Agent": "self-recognition-release-verifier"})
    with urlopen(request, timeout=45) as response:
        served = hashlib.file_digest(response, "sha256").hexdigest()
    with path.open("rb") as local:
        expected = hashlib.file_digest(local, "sha256").hexdigest()
    if served != expected:
        raise ValueError(f"Published file differs from checkout: {relative}")


def verify_site(base):
    paths = sorted(p for p in DOCS.rglob("*") if p.is_file() and not p.name.startswith("."))
    with ThreadPoolExecutor(max_workers=5) as pool:
        for _ in pool.map(lambda path: verify_file(base.rstrip("/") + "/", path), paths):
            pass
    print(f"Verified all {len(paths)} public files against {base}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", nargs="?", default="https://williamcodes.github.io/self-recognition/")
    verify_site(parser.parse_args().base)
