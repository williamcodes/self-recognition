"""Report candidate explicit author/tool credits in source, documents and asset metadata."""
import argparse
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
from zipfile import BadZipFile, ZipFile

MARKER = re.compile(r"\b(?:GPT[- ]?\d(?:\.\d+)?|OpenAI|Anthropic|Claude Code|Claude Fable|ChatGPT|Codex CLI|as an? (?:AI|language model))\b",re.I)
SECRET = re.compile(r"-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\b(?:github_pat_[A-Za-z0-9_]{30,}|ghp_[A-Za-z0-9]{30,}|sk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{24,})\b")
LOCAL_PATH = re.compile(r"/(?:Users|home)/[^/\s<>]+/|/(?:private/)?var/folders/|/(?:private/)?tmp/selfrec-(?:work|auth|answer)-")
ZIP_TYPES = {".xlsx",".docx",".pptx",".odt",".ods",".odp",".zip",".epub"}

def contents(path):
    data=path.read_bytes()
    yield "filename",path.name
    yield "original bytes",data.decode("utf-8","ignore")
    if path.suffix.lower() in ZIP_TYPES:
        try:
            with ZipFile(io.BytesIO(data)) as z:
                for item in z.infolist():
                    if item.file_size<=8_000_000:
                        yield item.filename,z.read(item).decode("utf-8","ignore")
        except BadZipFile:
            pass
    if path.suffix.lower()==".pdf" and shutil.which("pdftotext"):
        p=subprocess.run(["pdftotext","-q",str(path),"-"],capture_output=True,timeout=30)
        yield "PDF text",p.stdout.decode("utf-8","replace")
    if path.suffix.lower()==".pdf" and shutil.which("pdfinfo"):
        p=subprocess.run(["pdfinfo",str(path)],capture_output=True,timeout=30)
        yield "PDF metadata",p.stdout.decode("utf-8","replace")

def scan(root):
    flags=[]
    paths=[p for p in root.rglob("*") if p.is_file()]
    for path in sorted(paths):
        for where,s in contents(path):
            for kind,pattern in (("possible author credit",MARKER),("possible secret",SECRET),("local path",LOCAL_PATH)):
                matches=list(pattern.finditer(s))
                if matches:
                    flags.append(dict(path=str(path.relative_to(root)),part=where,kind=kind,count=len(matches)))
    return dict(files=len(paths),flags=flags,
                extracted_pdf_text=bool(shutil.which("pdftotext")),extracted_pdf_info=bool(shutil.which("pdfinfo")))

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory",type=Path)
    print(json.dumps(scan(parser.parse_args().directory),indent=2))
