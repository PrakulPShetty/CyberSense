export function buildTextPdf(linesRaw: string[], maxLinesPerPage = 54, wrapWidth = 100): string {
  const lines = linesRaw.flatMap((line) => wrap(line, wrapWidth));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) pages.push(lines.slice(i, i + maxLinesPerPage));
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "",
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj",
  ];

  const pageRefs: number[] = [];
  let nextObject = objects.length + 1;
  for (const page of pages) {
    const contentRef = nextObject;
    const pageRef = nextObject + 1;
    nextObject += 2;
    pageRefs.push(pageRef);

    const contentStream = [
      "BT",
      "/F1 11 Tf",
      "50 760 Td",
      "14.5 TL",
      ...page.map((line) => `(${escapePdf(line)}) Tj T*`),
      "ET",
      "BT",
      "/F1 9 Tf",
      "50 24 Td",
      `(CyberSense report - page ${pageRefs.length}) Tj`,
      "ET",
    ].join("\n");
    objects.push(`${contentRef} 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`);
    objects.push(
      `${pageRef} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >> endobj`,
    );
  }

  objects[1] = `2 0 obj << /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(" ")}] /Count ${pageRefs.length} >> endobj`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return btoa(pdf);
}

function wrap(line: string, width: number): string[] {
  if (!line) return [""];
  const out: string[] = [];
  let current = "";
  for (const word of line.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    current = word;
    while (current.length > width) {
      out.push(current.slice(0, width));
      current = current.slice(width);
    }
  }
  if (current) out.push(current);
  return out;
}

function escapePdf(s: string): string {
  return s
    .replace(/[^\x20-\x7e]+/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
