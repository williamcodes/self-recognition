"""Screen completed local project writer receipts. Output counts, never matched text."""
import argparse
from collections import Counter, defaultdict
import json
import os
from pathlib import Path
import pwd
import re


def screen(root):
    patterns={
        "email":r"(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])",
        "other account home":r"/(?:Users|home)/[\w.-]+",
        "credential assignment":r"""(?i)\b(?:password|api[_-]?key|access[_-]?token|secret[_-]?key|authorization)\s*[:=]\s*["']?[\w+/=-]{8,}""",
        "provider token or private key":r"\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{12,})|-----BEGIN [\w ]*PRIVATE KEY-----",
        "US phone":r"(?<!\d)(?:\+1[- .]?)?\(\d{3}\)[- .]?\d{3}[- .]\d{4}(?!\d)",
        "operator account":re.escape(Path.home().name),
    }
    realname=pwd.getpwuid(os.getuid()).pw_gecos.split(",")[0].strip()
    if realname:
        patterns["operator name"]=re.escape(realname)
    by_model=defaultdict(Counter)
    signatures=Counter()
    exposed=Counter()
    refs={"UI manual":"ui-ux-pro-max/SKILL.md","UI search":"ui-ux-pro-max/scripts/search.py",
          "image manual":"imagegen/SKILL.md"}
    for path in (root/"provenance"/"attempts"/"writer").glob("*/*.json"):
        row=json.loads(path.read_text())
        if row.get("kind")!="writer" or row["status"]!="complete":
            continue
        bucket=by_model[row["subject"]["writer"]]
        bucket["receipts"]+=1
        commands=row["commands"]
        for field,body in (("commands","\n".join(commands)),("reply",row["reply"])):
            if str(Path.home()) in body or (field=="commands" and row.get("command_redaction")):
                exposed[field]+=1
            safe=body.replace(str(Path.home()),"<OPERATOR_HOME>")
            for label,pattern in patterns.items():
                matches=re.findall(pattern,safe,re.I)
                if matches: signatures[field+" | "+label]+=len(matches)
                if label=="email":
                    for match in matches:
                        domain=match.rsplit("@",1)[-1].lower()
                        if domain in ("example.com","example.org","example.net"):
                            signatures[field+" | email on reserved example domain"]+=1
        for label,token in refs.items():
            count=sum(token in cmd for cmd in commands)
            if count:
                bucket[label+" sessions"]+=1
                bucket[label+" commands"]+=count
    return dict(models=by_model,home_receipts=exposed,sensitive_screen=signatures)


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive",type=Path)
    print(json.dumps(screen(p.parse_args().archive),indent=2,sort_keys=True))
