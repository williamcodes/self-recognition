"use strict";
const FoldFind = (() => {
  const tables = [
    {number: 1, letter: "F", name: "Paper folds", prompts: [
      "Find a fold.", "Which way does the paper open?", "Trace a crease with your eyes.",
      "Find two edges that meet.", "Where does one page end?", "Spot a shape made by folding."
    ], icon: [
      [[2,25],[2,7],[12,2],[22,7],[32,2],[32,20],[22,25],[12,20],[2,25]],
      [[12,2],[12,20]], [[22,7],[22,25]]
    ]},
    {number: 2, letter: "M", name: "Movable pieces", prompts: [
      "What could move?", "Spot a piece you could lift, slide or turn.", "Look for a piece with room to move.",
      "Where would the moving piece go?", "Look for two pieces that overlap.", "What might be hiding underneath?"
    ], icon: [
      [[20,5],[2,5],[2,23],[25,23],[25,17]], [[11,10],[32,10],[32,17],[11,17],[11,10]], [[26,10],[26,17]]
    ]},
    {number: 3, letter: "S", name: "Illustrated stories", prompts: [
      "Find a clue in a picture.", "What might happen next?", "Which detail did you see first?",
      "Find a small shape.", "Where might this story take place?", "Tell someone what you notice."
    ], icon: [
      [[2,5],[9,4],[17,8],[25,4],[32,5],[32,22],[25,21],[17,25],[9,21],[2,22],[2,5]],
      [[17,8],[17,25]], [[6,16],[10,12],[13,15]], [[22,14],[28,12]], [[22,18],[27,16]]
    ]}
  ];
  const starter = tables.flatMap(table => table.prompts.map((prompt, i) => ({
    id: table.letter + "0" + (i + 1), title: "", prompt, handling: i < 2
  })));
  const language = handling => handling
    ? ["TRY IT", "Use gentle hands. Put it back."]
    : ["LOOK ONLY", "Leave the book where it is."];
  const statusIcon = handling => handling ? [
    [[3,15],[6,13],[10,16],[10,5],[11,3],[14,3],[15,5],[15,12],
     [17,10],[20,11],[21,13],[23,12],[26,14],[26,20],[24,24],
     [20,27],[12,27],[7,22],[3,18],[3,15]],
    [[3,7],[5,9]], [[21,6],[19,8]]
  ] : [
    [[1,14],[5,10],[9,7],[14,6],[19,7],[23,10],[27,14],[23,18],[19,21],[14,22],[9,21],[5,18],[1,14]],
    [[14,10.6],[16.4,11.6],[17.4,14],[16.4,16.4],[14,17.4],[11.6,16.4],[10.6,14],[11.6,11.6],[14,10.6]]
  ];
  const clean = value => value.normalize("NFC").trim().replace(/\s+/gu, " ");
  const punctuation = "€\u0000‚ƒ„…†‡ˆ‰Š‹Œ\u0000Ž\u0000\u0000‘’“”•–—˜™š›œ\u0000žŸ";
  function winAnsi(character) {
    const code = character.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) return code;
    const index = punctuation.indexOf(character);
    return character !== "\u0000" && index >= 0 ? 128 + index : -1;
  }

  // Advance widths for the three standard PDF typefaces, indexed by WinAnsi byte.
  const widths = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 260, 0, 0, 0, 260, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500, 333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520, 0, 500, 0, 333, 500, 500, 1000, 500, 500, 333, 1000, 556, 333, 1000, 0, 667, 0, 0, 333, 333, 500, 500, 350, 500, 1000, 333, 1000, 389, 333, 722, 0, 444, 722, 250, 333, 500, 500, 500, 500, 220, 500, 333, 747, 300, 500, 570, 333, 747, 333, 400, 570, 300, 300, 333, 556, 540, 250, 333, 300, 330, 500, 750, 750, 750, 500, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 389, 389, 389, 389, 722, 722, 778, 778, 778, 778, 778, 570, 778, 722, 722, 722, 722, 722, 611, 556, 500, 500, 500, 500, 500, 500, 722, 444, 444, 444, 444, 444, 278, 278, 278, 278, 500, 556, 500, 500, 500, 500, 500, 570, 500, 556, 556, 556, 556, 500, 556, 500],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 260, 0, 0, 0, 260, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 260, 0, 0, 0, 260, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556]
  ];
  const measure = (value, font, size) => [...value].reduce(
    (sum, character) => sum + (widths[font][winAnsi(character)] || 0) * size / 1000, 0
  );
  function wrap(value, font, size, maximum) {
    const lines = [""];
    for (const word of value.split(" ")) {
      const current = lines.at(-1);
      const next = current ? current + " " + word : word;
      if (measure(next, font, size) <= maximum) {
        lines[lines.length - 1] = next;
      } else {
        if (measure(word, font, size) > maximum) return null;
        lines.push(word);
      }
    }
    return lines;
  }
  function layout(book) {
    const title = clean(book.title);
    const prompt = clean(book.prompt);
    const errors = {};
    if (!prompt) errors.prompt = "Enter a looking prompt.";
    for (const [field, value] of Object.entries({title, prompt})) {
      if ([...value].some(character => winAnsi(character) < 0)) {
        errors[field] = "Use Western European letters, numbers and standard punctuation for this PDF.";
      }
    }
    let heading;
    for (const size of [28, 25, 22, 19]) {
      const lines = wrap(title || prompt, 0, size, 232);
      if (lines && lines.length <= (title ? 2 : 3)) {
        heading = {lines, size};
        break;
      }
    }
    if (!heading) {
      const field = title ? "title" : "prompt";
      errors[field] ||= "Shorten this text or add spaces so it fits the label.";
    }
    const promptLines = title ? wrap(prompt, 1, 14, 232) : [];
    if (title && (!promptLines || promptLines.length > 2)) {
      errors.prompt ||= "Shorten the looking prompt so it fits on two lines.";
    }
    return {errors, heading, promptLines};
  }
  const tableFor = id => tables.find(table => table.letter === id[0]);
  const approved = (books, table) => books.filter(book => book.id[0] === table.letter && book.handling);
  function readBackup(value) {
    if (value?.version !== 1 || !Array.isArray(value.books) || value.books.length !== starter.length) {
      throw new Error("Choose a Fold and Find register backup with all 18 book IDs.");
    }
    const books = new Map(value.books.map(book => [book?.id, book]));
    return starter.map(({id}) => {
      const book = books.get(id);
      if (!book || typeof book.title !== "string" || book.title.length > 110 ||
          typeof book.prompt !== "string" || book.prompt.length > 125 ||
          typeof book.handling !== "boolean") {
        throw new Error("The backup has a missing or invalid book record.");
      }
      return {id, title: book.title, prompt: book.prompt, handling: book.handling};
    });
  }
  const backup = books => JSON.stringify({version: 1, books}, null, 2);
  const black = "0 0 0 1 K 0 0 0 1 k";
  const accent = "/Vermilion CS 1 SCN /Vermilion cs 1 scn";
  const number = n => Number(n.toFixed(3));
  function drawCard(book, left, top) {
    const table = tableFor(book.id);
    const {errors, heading, promptLines} = layout(book);
    if (Object.keys(errors).length) throw new Error("Fix the label for " + book.id + " before downloading.");
    const output = [];
    const x = left + 18;
    const text = (value, dx, dy, size, font) => {
      const hex = [...value].map(c => winAnsi(c).toString(16).padStart(2, "0")).join("");
      output.push(`BT /F${font} ${size} Tf ${number(x + dx)} ${number(792 - top - dy)} Td <${hex}> Tj ET`);
    };
    const path = (points, ink, weight) => {
      const commands = points.map(([dx, dy], i) =>
        `${number(x + dx)} ${number(792 - top - dy)} ${i ? "l" : "m"}`);
      output.push(`${ink} ${weight} w ${commands.join(" ")} S`);
    };
    output.push("q 1 J 1 j");
    table.icon.forEach(points => path(points.map(([px, py]) => [px * .69, 16 + py * .69]), black, 1.35));
    output.push(black);
    text(table.number + "  " + table.name, 31, 29, 11, 2);
    text(book.id, 234 - measure(book.id, 2, 14), 29, 14, 2);
    path([[0, 45], [234, 45]], accent, 2.2);
    output.push(black);
    heading.lines.forEach((line, i) => text(line, 0, 64 + heading.size + i * (heading.size + 2), heading.size, 0));
    const afterTitle = 64 + heading.size + (heading.lines.length - 1) * (heading.size + 2);
    promptLines.forEach((line, i) => text(line, 0, afterTitle + 22 + i * 16, 14, 1));
    path([[0, 178], [234, 178]], black, .7);
    const [status, guidance] = language(book.handling);
    text(status, 0, 201, 15, 2);
    text(guidance, 0, 220, 12, 1);
    statusIcon(book.handling).forEach(points => path(points.map(([px, py]) => [205 + px, 191 + py]), black, 1.8));
    output.push("Q");
    return output.join("\n");
  }

  function sheets(books, onlyId) {
    const groups = onlyId
      ? [[books.find(book => book.id === onlyId)]]
      : tables.map(table => books.filter(book => book.id[0] === table.letter));
    const objects = [];
    const add = object => objects.push(object);
    const root = add("<< /Type /Catalog /Pages 2 0 R >>");
    const pageTree = add("");
    const info = add(`<< /Title (Fold and Find - ${onlyId ? onlyId + " book label" : "Book labels"}) >>`);
    const serif = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
    const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const resource = add(`<< /Font << /F0 ${serif} 0 R /F1 ${regular} 0 R /F2 ${bold} 0 R >>
      /ColorSpace << /Vermilion [/Separation /Vermilion /DeviceCMYK
        << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 .86 .89 .07] /N 1 >>] >> >>`);
    const pages = groups.map(group => {
      const rows = Math.ceil(group.length / 2);
      const columns = Math.min(group.length, 2);
      const xEnd = 36 + 270 * columns;
      const yEnd = 756 - 240 * rows;
      const cuts = [`36 ${yEnd} ${xEnd - 36} ${756 - yEnd} re S`];
      if (columns === 2) cuts.push(`306 756 m 306 ${yEnd} l S`);
      for (let row = 1; row < rows; row++) {
        const y = 756 - row * 240;
        cuts.push(`36 ${y} m ${xEnd} ${y} l S`);
      }
      const labels = group.map((book, i) => drawCard(book, 36 + (i % 2) * 270, 36 + Math.floor(i / 2) * 240));
      const stream = [`q ${black} .5 w [3 3] 0 d`, ...cuts, "Q", ...labels, ""].join("\n");
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
      return add(`<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 612 792]
        /Resources ${resource} 0 R /Contents ${content} 0 R >>`);
    });
    objects[pageTree - 1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(p => p + " 0 R").join(" ")}] >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    });
    const index = pdf.length;
    pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
    return pdf + `trailer\n<< /Size ${offsets.length} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${index}\n%%EOF\n`;
  }

  return {tables, starter, tableFor, approved, layout, clean, language, statusIcon, readBackup, backup, sheets};
})();

if (typeof module === "object") module.exports = FoldFind;
