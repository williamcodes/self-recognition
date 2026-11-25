"""Build the letter-size print masters using only the Python standard library."""

from pathlib import Path
from random import Random

ROOT = Path(__file__).resolve().parents[1]
INK = "#292822"
RUST = "#8D3A28"
PAPER = "#FAF3E6"
WHEAT = "#F0E0C7"
RULE = "#A5927E"
WHITE = "#FFFFFF"
FONTS = {"sans": "Helvetica", "bold": "Helvetica-Bold",
         "serif": "Times-Bold", "italic": "Times-Italic"}


def literal(text):
    data = text.encode("cp1252")
    return "(" + "".join(
        chr(b) if 32 <= b <= 126 and b not in (40, 41, 92) else f"\\{b:03o}"
        for b in data
    ) + ")"


def color(hexcode):
    return " ".join(f"{int(hexcode[i:i+2], 16) / 255:.4f}" for i in (1, 3, 5))


class Artwork:
    def __init__(self):
        self.commands = []
        self.fields = {}

    def text(self, x, y, value, size, font="sans", ink=INK, tracking=0):
        self.commands.append(
            f"BT /{font} {size} Tf {tracking} Tc {color(ink)} rg "
            f"1 0 0 1 {x} {792-y} Tm {literal(value)} Tj ET"
        )

    def line(self, x1, y1, x2, y2, ink=RULE, weight=0.7, dashed=False):
        dash = "[3 3] 0 d" if dashed else "[] 0 d"
        self.commands.append(
            f"q {dash} {weight} w {color(ink)} RG "
            f"{x1} {792-y1} m {x2} {792-y2} l S Q"
        )

    def rect(self, x, y, w, h, fill=None, stroke=None):
        commands = ["q"]
        if fill:
            commands.append(f"{color(fill)} rg")
        if stroke:
            commands.append(f"{color(stroke)} RG 0.7 w")
        paint = "B" if fill and stroke else "f" if fill else "S"
        commands.append(f"{x} {792-y-h} {w} {h} re {paint} Q")
        self.commands.append(" ".join(commands))

    def path(self, operations, fill=None, stroke=None, weight=1):
        commands = ["q 1 J 1 j", f"{weight} w"]
        if fill:
            commands.append(f"{color(fill)} rg")
        if stroke:
            commands.append(f"{color(stroke)} RG")
        for operator, *coords in operations:
            point = [v if i % 2 == 0 else 792-v for i, v in enumerate(coords)]
            commands.append(" ".join([*(f"{v:.2f}" for v in point), operator]))
        commands.append(("B" if fill and stroke else "f" if fill else "S") + " Q")
        self.commands.append(" ".join(commands))

    def field(self, name, x, y, w, h, size, value="", limit=12):
        field = self.fields.setdefault(name, (size, value, limit, []))
        field[3].append((x, y, w, h))


class PDF:
    def __init__(self):
        self.objects = []

    def add(self, obj):
        self.objects.append(obj.encode("ascii") if isinstance(obj, str) else obj)
        return len(self.objects)

    def stream(self, data, entries=""):
        content = data.encode("ascii")
        return self.add(f"<< /Length {len(content)} {entries} >>\nstream\n".encode()
                        + content + b"\nendstream")

    def save(self, path, root):
        out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for number, obj in enumerate(self.objects, 1):
            offsets.append(len(out))
            out.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
        start = len(out)
        out.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
        for offset in offsets[1:]:
            out.extend(f"{offset:010d} 00000 n \n".encode())
        out.extend(f"trailer\n<< /Size {len(offsets)} /Root {root} 0 R >>\n"
                   f"startxref\n{start}\n%%EOF\n".encode())
        path.write_bytes(out)


def write_pdf(art, filename):
    pdf = PDF()
    root, pages, page = (pdf.add("") for _ in range(3))
    fonts = {tag: pdf.add(f"<< /Type /Font /Subtype /Type1 /BaseFont /{font} "
                          "/Encoding /WinAnsiEncoding >>") for tag, font in FONTS.items()}
    resources = "<< /Font << " + " ".join(f"/{tag} {ref} 0 R" for tag, ref in fonts.items()) + " >> >>"
    contents = pdf.stream("\n".join(art.commands))
    fields = []
    annotations = []
    for name, (size, value, limit, locations) in art.fields.items():
        parent = pdf.add("")
        fields.append(f"{parent} 0 R")
        kids = []
        style = f"/bold {size} Tf {color(INK)} rg"
        for x, y, w, h in locations:
            baseline = (h-size) / 2 + size * .19
            appearance = pdf.stream(
                f"/Tx BMC q BT {style} 1 0 0 1 2 {baseline:.2f} Tm {literal(value)} Tj ET Q EMC",
                f"/Subtype /Form /BBox [0 0 {w} {h}] /Resources {resources}",
            )
            widget = pdf.add(
                f"<< /Type /Annot /Subtype /Widget /Parent {parent} 0 R /P {page} 0 R "
                f"/Rect [{x} {792-y-h} {x+w} {792-y}] /F 4 /AP << /N {appearance} 0 R >> >>"
            )
            kids.append(f"{widget} 0 R")
            annotations.append(f"{widget} 0 R")
        pdf.objects[parent-1] = (
            f"<< /FT /Tx /T {literal(name)} /V {literal(value)} /DV {literal(value)} "
            f"/DA {literal(style)} /MaxLen {limit} /Kids [{' '.join(kids)}] >>"
        ).encode()
    form = (f"/AcroForm << /Fields [{' '.join(fields)}] /DR {resources} "
            "/DA (/bold 12 Tf 0 g) >>") if fields else ""
    pdf.objects[root-1] = f"<< /Type /Catalog /Pages {pages} 0 R {form} >>".encode()
    pdf.objects[pages-1] = f"<< /Type /Pages /Count 1 /Kids [{page} 0 R] >>".encode()
    pdf.objects[page-1] = (
        f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 612 792] "
        f"/Resources {resources} /Contents {contents} 0 R /Annots [{' '.join(annotations)}] >>"
    ).encode()
    write_to = ROOT / "print" / filename
    write_to.parent.mkdir(exist_ok=True)
    pdf.save(write_to, root)


MENU = (
    ("Seeded loaf", "7"),
    ("Plain loaf", "5"),
    ("Box of four buns", "12"),
)


def bread(art):
    art.path([
        ("m", 392, 159), ("c", 397, 142, 416, 125, 444, 114),
        ("c", 475, 102, 507, 102, 532, 113), ("c", 549, 121, 551, 140, 538, 157),
        ("c", 524, 174, 493, 188, 462, 191), ("c", 433, 195, 403, 190, 395, 179),
        ("c", 390, 173, 389, 165, 392, 159), ("h",)
    ], WHEAT, RUST, 2)
    art.path([
        ("m", 394, 165), ("c", 417, 184, 479, 181, 521, 156),
        ("c", 530, 151, 542, 140, 545, 133),
        ("m", 414, 194), ("c", 458, 208, 516, 190, 540, 169),
        ("m", 441, 202), ("c", 467, 204, 503, 195, 520, 184),
    ], stroke=RUST, weight=1)
    for x, y in ((420, 139), (450, 125), (482, 118)):
        art.path([
            ("m", x, y), ("c", x+15, y-5, x+29, y, x+35, y+11),
            ("c", x+23, y+3, x+14, y+6, x, y), ("h",)
        ], RUST)
    rng = Random(28)
    for _ in range(39):
        x = rng.uniform(413, 529)
        y = rng.uniform(143, 174) - (x-413)*.16
        art.path([("m", x, y), ("l", x+rng.uniform(1, 4), y-rng.uniform(1, 3))],
                 stroke=RUST, weight=.75)
    for x, y, dx, dy in ((402, 104, -8, -9), (416, 96, -4, -10),
                          (432, 91, 0, -9), (550, 165, 9, -3),
                          (548, 178, 8, 1)):
        art.line(x, y, x+dx, y+dy, RUST, 1.15)


def display(handwritten=False):
    a = Artwork()
    a.rect(33, 33, 546, 726, PAPER, RUST)
    a.line(57, 65, 555, 65, RUST, 1.2)
    a.text(56, 125, "Saturday", 61, "serif")
    a.text(53, 181, "preorders", 66, "italic", RUST)
    bread(a)
    a.text(58, 236, "Order by Friday at noon", 25, "bold")
    a.line(57, 260, 555, 260, RUST, 1)
    for index, (name, price) in enumerate(MENU):
        top = 260 + index * 85
        a.text(58, top + 54, name, 32, "serif")
        a.text(442, top + 54, "$", 32, "bold")
        if handwritten:
            a.line(466, top + 58, 550, top + 58, RULE, 1)
        else:
            a.field(name + " price", 464, top + 20, 90, 47, 30, price, 5)
        a.line(57, top + 85, 555, top + 85)
    a.rect(57, 555, 498, 113, WHEAT)
    a.text(77, 587, "CHOOSE YOUR SATURDAY PICKUP WINDOW", 11, "bold", RUST, 1.1)
    a.text(77, 634, "8–10 a.m.", 35, "serif")
    a.line(291, 603, 291, 645)
    a.text(313, 634, "10 a.m.–noon", 35, "serif")
    a.text(59, 720, "Place your order here at the counter.", 23, "bold")
    return a


WINDOWS = ("8–10 a.m.", "10 a.m.–noon")


def check(art, x, y, label):
    art.rect(x, y-9, 10, 10, stroke=INK)
    art.text(x+15, y, label, 10)


def tickets():
    a = Artwork()
    left, split, right = 33, 409, 579
    for index in range(4):
        top = 36 + index * 180
        a.rect(left, top, right-left, 33, PAPER)
        a.line(split, top, split, top+180, RULE, .8, dashed=True)
        a.text(45, top+22, "Saturday preorder", 18, "serif")
        a.text(283, top+21, "ORDER #", 9, "bold", RUST, .5)
        a.text(421, top+22, "Pickup claim", 17, "serif")
        a.text(45, top+55, "SATURDAY", 8, "bold", RUST, .6)
        a.text(200, top+55, "PICKUP NAME", 8, "bold", RUST, .6)
        a.line(102, top+58, 180, top+58)
        a.line(274, top+58, 395, top+58)
        a.field("Saturday date", 102, top+41, 77, 17, 11, limit=12)
        a.line(333, top+24, 395, top+24)
        a.field(f"Order number {index+1}", 333, top+7, 62, 17, 11, limit=8)
        a.text(45, top+78, "QUANTITIES", 8, "bold", RUST, .65)
        for x, (name, _) in zip((45, 151, 257), MENU):
            a.text(x+30, top+103, name, 9.5, "bold")
            a.rect(x, top+86, 24, 24, stroke=RULE)
        a.line(45, top+122, 395, top+122)
        a.text(45, top+140, "SATURDAY PICKUP", 8, "bold", RUST, .55)
        check(a, 45, top+162, WINDOWS[0])
        check(a, 123, top+162, WINDOWS[1])
        a.text(257, top+161, "TOTAL  $", 9, "bold", RUST, .4)
        a.line(309, top+164, 395, top+164)
        a.text(421, top+55, "ORDER #", 8, "bold", RUST, .5)
        a.line(480, top+58, 565, top+58)
        a.field(f"Order number {index+1}", 480, top+41, 84, 17, 11, limit=8)
        a.text(421, top+80, "SATURDAY", 8, "bold", RUST, .6)
        a.line(480, top+83, 565, top+83)
        a.field("Saturday date", 480, top+66, 84, 17, 11, limit=12)
        check(a, 421, top+105, WINDOWS[0])
        check(a, 421, top+125, WINDOWS[1])
        a.line(421, top+138, 565, top+138)
        a.text(421, top+159, "Bring this slip to the counter.", 10, "bold")
    a.rect(left, 36, right-left, 720, stroke=RULE)
    for y in (216, 396, 576):
        a.line(left, y, right, y, RULE, .85)
    return a


if __name__ == "__main__":
    write_pdf(display(), "Counter display.pdf")
    write_pdf(display(handwritten=True), "Counter display - write-in prices.pdf")
    write_pdf(tickets(), "Preorder tickets.pdf")
