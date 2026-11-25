import AppKit
import CoreText

let ink = CGColor(red: 0.13, green: 0.12, blue: 0.19, alpha: 1)
let muted = CGColor(red: 0.34, green: 0.32, blue: 0.38, alpha: 1)
let rule = CGColor(red: 0.72, green: 0.71, blue: 0.73, alpha: 1)
let orange = CGColor(red: 0.99, green: 0.79, blue: 0.70, alpha: 1)
let green = CGColor(red: 0.83, green: 0.91, blue: 0.83, alpha: 1)
let yellow = CGColor(red: 0.99, green: 0.91, blue: 0.63, alpha: 1)
let white = CGColor(gray: 1, alpha: 1)
let heavy = "HelveticaNeue-Bold"
let regular = "HelveticaNeue"
let medium = "HelveticaNeue-Medium"

final class Sheet {
    let ctx: CGContext
    let width: CGFloat
    let height: CGFloat

    init(_ ctx: CGContext, _ width: CGFloat, _ height: CGFloat) {
        self.ctx = ctx
        self.width = width
        self.height = height
    }

    func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat,
             fill: CGColor? = nil, stroke: CGColor? = nil, radius: CGFloat = 0) {
        let rect = CGRect(x: x, y: height-y-h, width: w, height: h)
        let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
        if let fill { ctx.setFillColor(fill); ctx.addPath(path); ctx.fillPath() }
        if let stroke { ctx.setStrokeColor(stroke); ctx.setLineWidth(1); ctx.addPath(path); ctx.strokePath() }
    }

    func circle(_ x: CGFloat, _ y: CGFloat, _ d: CGFloat, fill: CGColor) {
        ctx.setFillColor(fill)
        ctx.fillEllipse(in: CGRect(x: x, y: height-y-d, width: d, height: d))
    }

    func path(_ points: [(CGFloat, CGFloat)], color: CGColor = ink,
              width: CGFloat = 2, dash: [CGFloat] = []) {
        guard let first = points.first else { return }
        ctx.setStrokeColor(color)
        ctx.setLineWidth(width)
        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)
        ctx.setLineDash(phase: 0, lengths: dash)
        ctx.beginPath()
        ctx.move(to: CGPoint(x: first.0, y: height-first.1))
        for (x, y) in points.dropFirst() { ctx.addLine(to: CGPoint(x: x, y: height-y)) }
        ctx.strokePath()
        ctx.setLineDash(phase: 0, lengths: [])
    }

    func text(_ string: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat,
              font: String = regular, color: CGColor = ink,
              centered: Bool = false, limit: CGFloat? = nil) {
        let face = CTFontCreateWithName(font as CFString, size, nil)
        let attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): face,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color
        ]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: string, attributes: attributes))
        let advance = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        let start = centered ? x-advance/2 : x
        precondition(start >= 0 && start+advance <= width && y >= size && y < height, "Text outside page: \(string)")
        if let limit { precondition(advance <= limit, "Text too wide: \(string) (\(advance) > \(limit))") }
        ctx.textMatrix = .identity
        ctx.textPosition = CGPoint(x: start, y: height-y)
        CTLineDraw(line, ctx)
    }

    func icon(_ name: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, color: CGColor = ink) {
        let unit = size/100
        func line(_ points: [(CGFloat, CGFloat)]) {
            path(points.map { (x+$0.0*unit, y+$0.1*unit) }, color: color, width: 6*unit)
        }
        func dot(_ a: CGFloat, _ b: CGFloat, _ d: CGFloat) {
            circle(x+a*unit, y+b*unit, d*unit, fill: color)
        }
        switch name {
        case "check":
            line([(34,23),(19,23),(19,90),(79,90),(79,23),(65,23)])
            line([(34,32),(34,16),(65,16),(65,32),(34,32)])
            line([(32,61),(45,74),(66,48)])
        case "box", "small":
            if name == "small" {
                line([(15,51),(84,51),(77,84),(23,84),(15,51)])
                line([(15,51),(30,40),(41,40)])
                line([(84,51),(69,40),(57,40)])
                line([(49,51),(49,36),(58,25)])
                line([(38,67),(61,67)])
            } else {
                line([(10,43),(90,43),(81,85),(19,85),(10,43)])
                line([(10,43),(25,32),(34,32)])
                line([(90,43),(75,32),(64,32)])
                line([(50,43),(50,25),(62,13)])
                line([(50,31),(39,20)])
                line([(34,64),(66,64)])
            }
        case "swap":
            line([(17,34),(79,34),(65,20)])
            line([(79,34),(65,48)])
            line([(83,67),(21,67),(35,53)])
            line([(21,67),(35,81)])
        case "carrot":
            line([(55,30),(74,49),(15,87),(55,30)])
            line([(64,39),(82,22)])
            line([(58,33),(61,15)])
            line([(71,46),(89,44)])
            line([(46,45),(53,51)])
            line([(35,61),(42,66)])
        case "apple":
            line([(48,37),(35,32),(22,37),(15,50),(16,65),(25,80),(36,86),(49,82),(62,86),(74,78),(83,63),(84,50),(77,38),(64,32),(48,37)])
            line([(48,37),(48,23),(43,16)])
            line([(50,30),(61,19),(72,19)])
        case "help":
            line([(14,18),(86,18),(86,71),(49,71),(30,86),(30,71),(14,71),(14,18)])
            line([(39,36),(45,30),(55,30),(61,36),(60,42),(50,49),(50,54)])
            dot(47,59,6)
        default:
            preconditionFailure("Unknown icon: \(name)")
        }
    }

    func lines(_ content: [String], _ x: CGFloat, _ y: CGFloat,
               size: CGFloat = 12, leading: CGFloat = 16, limit: CGFloat = 524) {
        for (index, line) in content.enumerated() {
            text(line, x, y+CGFloat(index)*leading, size, limit: limit)
        }
    }

    func section(_ title: String, _ y: CGFloat, _ content: [String]) {
        text(title, 44, y, 17, font: heavy)
        lines(content, 44, y+22)
    }

    func header(_ title: String, _ label: String) {
        path([(44,41),(568,41)], width: 3)
        text("NEIGHBORHOOD PRODUCE SHARE", 44, 63, 11, font: heavy)
        text(label, 568-100, 63, 10, font: medium, limit: 100)
        text(title, 44, 111, 36, font: heavy, limit: 524)
    }

    func footer(_ label: String) {
        path([(44,748),(568,748)], color: rule, width: 1)
        text(label, 44, 766, 10, font: medium, color: muted)
    }

    func memberHeader(_ strap: String) {
        path([(42,42),(750,42)], width: 4)
        text(strap, 42, 82, 21, font: heavy)
        icon("carrot", 655, 55, 86)
    }
}

func makePDF(_ name: String, title: String, pages: [(CGFloat, CGFloat, (Sheet) -> Void)]) {
    let url = URL(fileURLWithPath: "print/"+name)
    var first = CGRect(x: 0, y: 0, width: pages[0].0, height: pages[0].1)
    let info = [kCGPDFContextTitle as String: title] as CFDictionary
    guard let context = CGContext(url as CFURL, mediaBox: &first, info) else {
        fatalError("Could not open "+name)
    }
    for (width, height, render) in pages {
        var rect = CGRect(x: 0, y: 0, width: width, height: height)
        let data = Data(bytes: &rect, count: MemoryLayout<CGRect>.size)
        context.beginPDFPage([kCGPDFContextMediaBox as String: data] as CFDictionary)
        render(Sheet(context, width, height))
        context.endPDFPage()
    }
    context.closePDF()
    try! removeGeneratedMetadata(from: url)
}

// Blank automatically added fields without moving byte offsets in the PDF.
func removeGeneratedMetadata(from url: URL) throws {
    var data = try Data(contentsOf: url)
    for key in ["Producer", "Creator", "Author", "CreationDate", "ModDate"] {
        guard let field = data.range(of: Data("/\(key) (".utf8), options: .backwards) else { continue }
        var end = field.upperBound
        var depth = 1
        while end < data.count && depth > 0 {
            switch data[end] {
            case 0x5C: end += 1 // Escaped character.
            case 0x28: depth += 1
            case 0x29: depth -= 1
            default: break
            }
            end += 1
        }
        precondition(depth == 0, "Invalid PDF metadata field")
        let span = field.lowerBound..<end
        data.replaceSubrange(span, with: repeatElement(UInt8(0x20), count: span.count))
    }
    try data.write(to: url, options: .atomic)
}

func entry(_ s: Sheet) {
    s.memberHeader("NEIGHBORHOOD PRODUCE SHARE")
    s.text("Produce pickup", 42, 195, 93, font: heavy, limit: 708)
    s.text("Recoge tu caja", 45, 261, 55, font: medium)
    let rows: [(String, CGColor, String, String, String, String)] = [
        ("check", orange, "Check in", "Regístrate", "Tell us your name.", "Dinos tu nombre."),
        ("box", green, "Pick up your box", "Recoge tu caja", "Standard or small", "Estándar o pequeña"),
        ("swap", yellow, "Swap one item", "Cambia un producto", "Optional", "Opcional")
    ]
    for (i, row) in rows.enumerated() {
        let y = 306+CGFloat(i)*252
        s.box(42, y, 708, 230, fill: row.1, radius: 16)
        s.circle(63, y+23, 47, fill: ink)
        s.text(String(i+1), 86.5, y+58, 30, font: heavy, color: white, centered: true)
        s.icon(row.0, 77, y+84, 114)
        s.text(row.2, 223, y+65, 56, font: heavy, limit: 500)
        s.text(row.3, 225, y+115, 43, font: medium, limit: 500)
        s.text(row.4, 226, y+166, 29, font: heavy, limit: 490)
        s.text(row.5, 226, y+201, 27, limit: 490)
    }
    s.path([(42,1078),(750,1078)], width: 2)
    s.icon("help", 46, 1097, 69)
    s.text("Need help? Point to a picture.", 128, 1130, 32, font: heavy)
    s.text("¿Necesitas ayuda? Señala un dibujo.", 128, 1166, 28)
}

func swap(_ s: Sheet) {
    s.memberHeader("NEIGHBORHOOD PRODUCE SHARE")
    s.text("Swap one item", 42, 195, 92, font: heavy, limit: 708)
    s.text("Cambia un producto", 45, 258, 55, font: medium)
    s.text("Optional  /  Opcional", 45, 314, 33, font: heavy)
    s.box(42, 352, 708, 365, fill: yellow, radius: 16)
    s.path([(396,386),(396,682)], width: 2)
    s.icon("carrot", 116, 398, 203)
    s.icon("apple", 477, 398, 203)
    s.text("Give 1", 219, 626, 55, font: heavy, centered: true)
    s.text("Da 1", 219, 678, 39, font: medium, centered: true)
    s.text("Take 1", 573, 626, 55, font: heavy, centered: true)
    s.text("Lleva 1", 573, 678, 39, font: medium, centered: true)
    s.text("Show your swap ticket.", 45, 796, 46, font: heavy)
    s.text("Muestra tu boleto de intercambio.", 45, 848, 38, font: medium)
    s.path([(45,889),(747,889)], width: 2)
    s.text("Use an item from your box.", 45, 956, 43, font: heavy)
    s.text("Usa un producto de tu caja.", 45, 1004, 37)
    s.text("One swap per household.", 45, 1115, 37, font: heavy)
    s.text("Un intercambio por hogar.", 45, 1163, 33)
}

func cards(_ s: Sheet) {
    s.path([(36,40),(1188,40)], width: 3)
    s.text("TABLE SIGNS  /  CUT ON DASHED LINES", 36, 68, 16, font: heavy)
    let cards: [(String, String, String, CGColor)] = [
        ("Check in", "Regístrate", "check", orange),
        ("Standard", "Estándar", "box", green),
        ("Small", "Pequeña", "small", yellow)
    ]
    let dash: [CGFloat] = [5,5]
    for y: CGFloat in [122,650] {
        s.path([(30,y),(1194,y)], color: muted, width: 1, dash: dash)
    }
    for x: CGFloat in [30,416,808,1194] {
        s.path([(x,122),(x,650)], color: muted, width: 1, dash: dash)
    }
    for (i, card) in cards.enumerated() {
        let x = 36+CGFloat(i)*392
        s.box(x, 155, 368, 462, fill: card.3, radius: 14)
        s.icon(card.2, x+112, 211, 144)
        s.text(card.0, x+184, 444, 61, font: heavy, centered: true, limit: 340)
        s.text(card.1, x+184, 514, 47, font: medium, centered: true, limit: 340)
    }
    s.text("Attach to the member-facing edge of the table, or lay flat facing members.",
           36, 737, 18, font: medium)
}

func tickets(_ s: Sheet) {
    s.path([(36,39),(756,39)], width: 3)
    s.text("SWAP TICKETS", 36, 70, 19, font: heavy)
    s.text("64 tickets  /  Cut on dashed lines", 36, 98, 14)
    let x: CGFloat = 36, y: CGFloat = 130, w: CGFloat = 90, h: CGFloat = 128
    for row in 0..<8 {
        for column in 0..<8 {
            let left = x+CGFloat(column)*w
            let top = y+CGFloat(row)*h
            s.icon("swap", left+26, top+11, 38)
            s.text("1 swap", left+45, top+68, 16, font: heavy, centered: true)
            s.text("1 intercambio", left+45, top+86, 10, centered: true)
        }
    }
    for index in 0...8 {
        let offset = CGFloat(index)
        s.path([(x+offset*w,y),(x+offset*w,y+8*h)], color: muted, width: 0.8, dash: [3,4])
        s.path([(x,y+offset*h),(x+8*w,y+offset*h)], color: muted, width: 0.8, dash: [3,4])
    }
    s.text("Hand out one at box pickup. Collect it only when a swap is completed.", 36, 1193, 14)
}

func setup(_ s: Sheet) {
    s.header("Set up the lobby", "VOLUNTEER GUIDE")
    s.lines([
        "Confirm the pickup window, approved queue space and usable exit with center staff.",
        "If the same door serves both ways, let people leaving pass before admitting the next group."
    ], 44, 140)
    s.box(44, 184, 524, 251, stroke: rule, radius: 9)
    s.text("LAYOUT EXAMPLE  /  MIRROR TO FIT THE ROOM", 60, 207, 10, font: heavy)
    s.text("VOLUNTEER SIDE", 195, 234, 9, font: heavy)
    s.text("Box stock", 333, 234, 10)
    let blocks: [(CGFloat, CGFloat, CGColor, String, String)] = [
        (184, 82, orange, "Check in", "2 ft"),
        (266, 123, green, "Boxes", "3 ft"),
        (389, 123, yellow, "Swap", "3 ft")
    ]
    for (x, w, color, title, size) in blocks {
        s.box(x, 248, w, 59, fill: color, stroke: ink)
        s.text(title, x+w/2, 271, 13, font: heavy, centered: true)
        s.text(size, x+w/2, 292, 11, centered: true)
    }
    s.text("8-FOOT TABLE", 60, 279, 10, font: heavy)
    s.text("Entry sign", 60, 321, 10, font: medium)
    s.text("Swap sign", 466, 321, 10, font: medium)
    s.path([(111,342),(513,342),(506,337)], width: 2)
    s.path([(513,342),(506,347)], width: 2)
    s.text("Pickup line", 256, 332, 10, font: medium)
    s.path([(524,346),(524,386),(111,386),(118,381)], width: 2, dash: [4,4])
    s.path([(111,386),(118,391)], width: 2)
    s.text("Clear exit path", 250, 407, 10, font: medium)
    s.box(60, 348, 42, 32, fill: ink, radius: 3)
    s.text("DOOR", 81, 369, 10, font: heavy, color: white, centered: true)
    s.path([(102,356),(111,356),(111,342)], width: 1)
    s.path([(111,386),(111,372),(102,372)], width: 1, dash: [3,3])

    s.section("Place the signs", 469, [
        "Put the entry sign on the first stand at the start of the line, clear of the door swing.",
        "Put the swap sign on the second stand beside the far end of the table.",
        "Set the cut signs at check-in and in front of the two box stacks. Keep paths clear.",
        "Mark a waiting point clear of the doorway. Admit people as table space opens."
    ])
    s.section("Get boxes, roster and tickets ready", 578, [
        "Fill the 64 roster rows from the current list using member names or IDs. Record assigned",
        "sizes where known. Count both sizes and write the opening totals on the tally sheet.",
        "Stage a few boxes of each size with labels visible. Keep the rest in approved storage.",
        "Cut 64 swap tickets and keep them at box pickup. Set out swap produce only if there",
        "are approved extras. With an empty table, match two willing members for the first swap.",
        "Give each volunteer a role and point out the clear route and the help signal on the poster."
    ])
    s.footer("VOLUNTEER GUIDE  /  1 OF 2")
}

func operation(_ s: Sheet) {
    s.header("Run the pickup", "VOLUNTEER GUIDE")
    s.lines([
        "Split the six volunteers into two teams of three. Fill in the role and time grid on the tally",
        "sheet. Keep the outgoing volunteers in place until their relief has taken over."
    ], 44, 140)

    let roles: [(String, CGColor, String, [String])] = [
        ("check", orange, "Check-in", [
            "Ask for the member name or ID. Check the roster and confirm their size. If it’s",
            "blank, ask their preference and confirm stock with Box pickup. Give Box pickup",
            "the row number and size. Mark the row only when the volunteer signals that",
            "the box was handed over. Finish that row before checking in the next household."
        ]),
        ("box", green, "Box pickup", [
            "Hand over the confirmed box and one swap ticket. Signal the roster row back",
            "to Check-in. Refill from stock as space opens. Flag size shortages early and",
            "hold back stock needed for households already assigned that size."
        ]),
        ("swap", yellow, "Swap", [
            "Look for a ticket and one sound item from the member’s box. Let the member",
            "choose one available item, then collect the ticket and put their offered item out.",
            "A bunch or bag counts as one if packed that way. If the table is empty, two",
            "members can trade directly if both agree. Collect both tickets only after they",
            "trade. If there’s no match, they keep their items and tickets. Point out the exit."
        ])
    ]
    var start: CGFloat = 183
    for (icon, color, title, copy) in roles {
        let h = CGFloat(44+16*copy.count)
        s.box(44, start, 524, h, fill: color, radius: 8)
        s.icon(icon, 54, start+8, 39)
        s.text(title, 105, start+25, 16, font: heavy)
        s.lines(copy, 105, start+45, limit: 453)
        start += h+9
    }

    s.section("If someone needs help", 554, [
        "Point to the pictures and the two box signs. For a missing name, duplicate claim or size",
        "shortage, ask the pickup lead to verify at the side. Keep the roster behind the table.",
        "Hold the box until resolved. Update approved size changes and log unresolved cases."
    ])
    s.section("At shift change and close", 637, [
        "Pause new arrivals briefly, finish open pickups and count what is left. Record roster",
        "totals and collected tickets. Tell relief which rows are pending and who is waiting.",
        "At close, check box counts and ticket totals against the roster and note any differences.",
        "Follow the organizer’s instructions for unclaimed boxes, swap produce and roster storage."
    ])
    s.footer("VOLUNTEER GUIDE  /  2 OF 2")
}

func roster(_ s: Sheet, start: Int) {
    s.header("Pickup roster", "FIELD SHEET")
    let ending = start+31
    s.text("DATE _______________________     HOUSEHOLDS \(start)–\(ending) OF 64", 44, 139, 11, font: heavy)
    s.lines([
        "S = standard  •  M = small. Enter the actual size if it changes.",
        "Tick “Box given” after handoff. Use the tally sheet for exceptions."
    ], 44, 162, size: 11)
    let x: CGFloat = 44, top: CGFloat = 197, tableWidth: CGFloat = 524
    let headerHeight: CGFloat = 24, rowHeight: CGFloat = 15.7
    s.box(x, top, tableWidth, headerHeight, fill: green)
    let columns: [(CGFloat, String)] = [
        (54, "No."), (94, "Household / member ID"), (401, "Size"), (482, "Box given")
    ]
    for (left, name) in columns { s.text(name, left, top+16, 11, font: heavy) }
    let tableBottom = top+headerHeight+32*rowHeight
    for row in 0..<32 {
        let y = top+headerHeight+CGFloat(row)*rowHeight
        s.path([(x,y),(x+tableWidth,y)], color: rule, width: 0.55)
        s.text(String(start+row), 54, y+11.3, 9.6, color: muted)
        s.box(495, y+3.5, 8.5, 8.5, stroke: muted)
    }
    s.box(x, top, tableWidth, tableBottom-top, stroke: rule)
    for edge: CGFloat in [85,390,471] {
        s.path([(edge,top),(edge,tableBottom)], color: rule, width: 0.65)
    }
    s.footer("PICKUP ROSTER  /  \(start == 1 ? "1" : "2") OF 2")
}

func tally(_ s: Sheet) {
    s.header("Shift & count sheet", "FIELD SHEET")
    s.text("DATE _______________________     PICKUP LEAD __________________________", 44, 141, 11, font: heavy)
    s.text("Volunteer assignments", 44, 176, 17, font: heavy)
    s.text("Shift 1  ________ to ________", 149, 200, 12)
    s.text("Shift 2  ________ to ________", 359, 200, 12)
    let roles = ["Check-in", "Box pickup", "Swap"]
    for (i, role) in roles.enumerated() {
        let y = 221+CGFloat(i)*23
        s.text(role, 44, y, 12, font: medium)
        s.path([(149,y+2),(338,y+2)], color: rule, width: 1)
        s.path([(359,y+2),(568,y+2)], color: rule, width: 1)
    }
    s.text("Counts", 44, 307, 17, font: heavy)
    s.text("Use running totals. Count remaining boxes in all holding areas.", 44, 326, 11)
    let x: CGFloat = 44, top: CGFloat = 342
    let colWidths: [CGFloat] = [236,96,96,96]
    let metrics = ["Standard boxes left", "Small boxes left", "Standard boxes given", "Small boxes given", "Swap tickets collected"]
    s.box(x, top, 524, 26, fill: green)
    var edge = x
    for (i, column) in ["Count", "Opening", "Shift change", "Close"].enumerated() {
        s.text(column, edge+9, top+17, 11, font: heavy)
        edge += colWidths[i]
        if i < 3 { s.path([(edge,top),(edge,488)], color: rule, width: 0.7) }
    }
    for (i, metric) in metrics.enumerated() {
        let y = top+26+CGFloat(i)*24
        s.path([(x,y),(568,y)], color: rule, width: 0.7)
        s.text(metric, x+9, y+16, 12)
        if i >= 2 { s.text("0", 289, y+16, 11) }
    }
    s.box(x, top, 524, 146, stroke: rule)
    s.lines([
        "Match boxes given to roster ticks by size. For each size, opening stock + boxes added",
        "should equal boxes given + boxes left. Tickets collected should be at most boxes given.",
        "Log stock changes and any differences below."
    ], 44, 511, size: 11)
    s.text("Open issues & handoff notes", 44, 564, 17, font: heavy)
    s.text("Use row number or member ID. Record what happened, who owns it and what is next.", 44, 584, 11)
    for i in 0..<4 {
        let y = CGFloat(614+i*28)
        s.path([(44,y),(568,y)], color: rule, width: 1)
    }
    s.text("Unclaimed boxes / swap produce handed to _______________________ at ___________", 44, 727, 11)
    s.footer("SHIFT & COUNT SHEET")
}

makePDF("01-member-signs.pdf", title: "Produce share member signs", pages: [
    (792, 1224, entry), (792, 1224, swap), (1224, 792, cards)
])
makePDF("02-swap-tickets.pdf", title: "Produce share swap tickets", pages: [
    (792, 1224, tickets)
])
makePDF("03-volunteer-kit.pdf", title: "Produce share volunteer kit", pages: [
    (612, 792, setup), (612, 792, operation),
    (612, 792, { roster($0, start: 1) }),
    (612, 792, { roster($0, start: 33) }),
    (612, 792, tally)
])
