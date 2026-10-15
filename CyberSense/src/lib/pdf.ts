/**
 * Minimal, dependency-free PDF writer.
 *
 * Only the presentation lives here: a small layout engine that paginates a list
 * of blocks into a branded, print-friendly document (Helvetica family, navy
 * headings, restrained blue/violet accents, severity chips, page numbers and a
 * footer). Report *content* is assembled by the callers from stored scan data —
 * this module never invents a value.
 *
 * All drawn text is forced to the WinAnsi-safe printable ASCII range, so the
 * `/Length` of every content stream equals the byte length actually written.
 */

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN_X = 48;
const TOP_Y = PAGE_H - 56;
const BOTTOM_Y = 64;
const FOOTER_Y = 40;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export type PdfTone = "critical" | "serious" | "moderate" | "minor" | "unknown" | "brand" | "violet";

const TONES: Record<PdfTone, [number, number, number]> = {
  critical: [0.863, 0.149, 0.149],
  serious: [0.851, 0.467, 0.024],
  moderate: [0.008, 0.518, 0.78],
  minor: [0.02, 0.588, 0.412],
  unknown: [0.392, 0.455, 0.545],
  brand: [0.145, 0.388, 0.921],
  violet: [0.486, 0.227, 0.929],
};

const INK = {
  heading: [0.043, 0.071, 0.153] as [number, number, number],
  body: [0.2, 0.25, 0.33] as [number, number, number],
  muted: [0.4, 0.46, 0.55] as [number, number, number],
  navy: [0.043, 0.063, 0.137] as [number, number, number],
  rule: [0.82, 0.85, 0.89] as [number, number, number],
  surface: [0.949, 0.965, 0.98] as [number, number, number],
  white: [1, 1, 1] as [number, number, number],
};

export type PdfBlock =
  | {
      type: "cover";
      brand: string;
      title: string;
      subtitle?: string;
      target?: string;
      meta: Array<[string, string]>;
    }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "kv"; label: string; value: string }
  | { type: "metrics"; items: Array<{ label: string; value: string; tone?: PdfTone }> }
  | {
      type: "finding";
      index: number;
      id: string;
      title: string;
      severity?: string;
      tone?: PdfTone;
      /** Ordered evidence/description lines; `mono` renders in Courier. */
      lines: Array<{ label?: string; text: string; mono?: boolean; tone?: PdfTone }>;
    }
  | { type: "note"; title?: string; text: string }
  | { type: "divider" }
  | { type: "spacer"; height?: number };

const ascii = (value: string) => value.replace(/[^\x20-\x7e]+/g, "?").replace(/[\\()]/g, (m) => `\\${m}`);

/** Conservative width estimate, in points, for the three fonts we embed. */
function estimateWidth(text: string, size: number, font: Font): number {
  const factor = font === "courier" ? 0.6 : font === "bold" ? 0.55 : 0.5;
  return text.length * size * factor;
}

type Font = "regular" | "bold" | "courier";

const FONT_RES: Record<Font, string> = { regular: "/F1", bold: "/F2", courier: "/F3" };

function wrapText(text: string, size: number, maxWidth: number, font: Font): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, size, font) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (estimateWidth(word, size, font) <= maxWidth) {
      current = word;
      continue;
    }
    // Hard-split an over-long token (URLs, selectors, base64-ish HTML).
    let rest = word;
    while (estimateWidth(rest, size, font) > maxWidth) {
      let cut = rest.length;
      while (cut > 1 && estimateWidth(rest.slice(0, cut), size, font) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}

class PdfDoc {
  private pages: string[][] = [];
  private cursor: string[] = [];
  private y = TOP_Y;
  private pageIndex = 0;
  private header = { brand: "CyberSense", context: "" };

  constructor(brand: string, context: string) {
    this.header = { brand, context };
  }

  /** Guarantees a page exists before the first block is drawn. */
  private startIfEmpty() {
    if (this.cursor.length === 0 && this.pages.length === 0) this.newPage();
  }

  get pageNumber(): number {
    return this.pages.length;
  }

  private setFill(color: [number, number, number]) {
    return `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`;
  }

  private setStroke(color: [number, number, number]) {
    return `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG`;
  }

  private rect(x: number, y: number, w: number, h: number, color: [number, number, number]) {
    return `${this.setFill(color)}\n${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`;
  }

  private line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: [number, number, number],
    width = 0.7,
  ) {
    return `${this.setStroke(color)}\n${width} w\n${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
  }

  private textAt(text: string, x: number, y: number, size: number, font: Font, color: [number, number, number]) {
    if (!text) return "";
    return `BT ${this.setFill(color)} ${FONT_RES[font]} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${ascii(text)}) Tj ET`;
  }

  /** Start a new page and stamp the continuation header. */
  newPage() {
    if (this.cursor.length > 0) this.pages.push(this.cursor);
    this.cursor = [];
    this.pageIndex += 1;
    this.y = TOP_Y;
    this.cursor.push(this.rect(0, PAGE_H - 30, PAGE_W, 30, INK.navy));
    this.cursor.push(this.textAt(this.header.brand, MARGIN_X, PAGE_H - 20, 9.5, "bold", INK.white));
    const context = this.header.context.length > 74 ? `${this.header.context.slice(0, 71)}...` : this.header.context;
    const contextWidth = estimateWidth(context, 8.5, "regular");
    this.cursor.push(this.textAt(context, PAGE_W - MARGIN_X - contextWidth, PAGE_H - 20, 8.5, "regular", [0.72, 0.82, 0.95]));
    this.cursor.push(this.line(MARGIN_X, PAGE_H - 40, PAGE_W - MARGIN_X, PAGE_H - 40, INK.rule, 0.6));
    this.y = PAGE_H - 62;
  }

  private ensure(space: number) {
    this.startIfEmpty();
    if (this.y - space < BOTTOM_Y) this.newPage();
  }

  space(height: number) {
    this.y -= height;
  }

  divider(gapBefore = 8, gapAfter = 14) {
    this.space(gapBefore);
    this.ensure(gapAfter + 2);
    this.cursor.push(this.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y, INK.rule));
    this.space(gapAfter);
  }

  heading(text: string, size = 15) {
    const lines = wrapText(text, size, CONTENT_W, "bold");
    this.ensure(lines.length * (size + 4) + 14);
    for (const line of lines) {
      this.cursor.push(this.textAt(line, MARGIN_X, this.y - size, size, "bold", INK.heading));
      this.y -= size + 3.5;
    }
    this.cursor.push(this.line(MARGIN_X, this.y, MARGIN_X + 46, this.y, TONES.brand, 1.6));
    this.space(13);
  }

  subheading(text: string, size = 11.5) {
    const lines = wrapText(text, size, CONTENT_W, "bold");
    this.ensure(lines.length * (size + 3) + 8);
    for (const line of lines) {
      this.cursor.push(this.textAt(line, MARGIN_X, this.y - size, size, "bold", INK.heading));
      this.y -= size + 3;
    }
    this.space(5);
  }

  paragraph(text: string, size = 9.5, color: [number, number, number] = INK.body, indent = 0) {
    const lines = wrapText(text, size, CONTENT_W - indent, "regular");
    this.ensure(lines.length * (size + 4) + 2);
    for (const line of lines) {
      this.cursor.push(this.textAt(line, MARGIN_X + indent, this.y - size, size, "regular", color));
      this.y -= size + 3.6;
    }
    this.space(1);
  }

  bullet(text: string, size = 9.5) {
    const lines = wrapText(text, size, CONTENT_W - 14, "regular");
    this.ensure(lines.length * (size + 4) + 2);
    this.cursor.push(this.rect(MARGIN_X + 2, this.y - size + 2.5, 2.6, 2.6, TONES.brand));
    for (const line of lines) {
      this.cursor.push(this.textAt(line, MARGIN_X + 14, this.y - size, size, "regular", INK.body));
      this.y -= size + 3.6;
    }
    this.space(1);
  }

  keyValue(label: string, value: string, size = 9.5) {
    const labelWidth = 108;
    const valueLines = wrapText(value, size, CONTENT_W - labelWidth, "regular");
    this.ensure(Math.max(valueLines.length, 1) * (size + 4) + 3);
    this.cursor.push(this.textAt(label, MARGIN_X, this.y - size, size, "bold", INK.muted));
    for (const line of valueLines) {
      this.cursor.push(this.textAt(line, MARGIN_X + labelWidth, this.y - size, size, "regular", INK.body));
      this.y -= size + 3.6;
    }
    this.space(1.5);
  }

  /** Row of boxed metrics (used for the executive summary counts). */
  metrics(items: Array<{ label: string; value: string; tone?: PdfTone }>, columns = 4) {
    const rows = Math.ceil(items.length / columns);
    const cellW = CONTENT_W / columns;
    const cellH = 52;
    this.ensure(rows * (cellH + 8) + 6);
    const topY = this.y;
    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = MARGIN_X + col * cellW;
      const y = topY - row * (cellH + 8) - cellH;
      this.cursor.push(this.rect(x, y, cellW - 8, cellH, INK.surface));
      this.cursor.push(
        this.textAt(item.label.toUpperCase(), x + 9, y + cellH - 16, 7, "bold", INK.muted),
      );
      this.cursor.push(
        this.textAt(item.value, x + 9, y + 12, 17, "bold", item.tone ? TONES[item.tone] : INK.heading),
      );
    });
    this.space(rows * (cellH + 8) + 6);
  }

  /** Colour chip (severity / status). */
  chip(text: string, tone: PdfTone, x: number, y: number, size = 8) {
    const label = text.toUpperCase();
    const width = estimateWidth(label, size, "bold") + 14;
    this.cursor.push(this.rect(x, y, width, size + 8, TONES[tone]));
    this.cursor.push(this.textAt(label, x + 7, y + 4.5, size, "bold", INK.white));
    return width;
  }

  /** Finding card: title row, severity chip, then the supplied evidence lines. */
  finding(block: Extract<PdfBlock, { type: "finding" }>) {
    const tone: PdfTone = block.tone ?? "unknown";
    // Keep the header with at least the first evidence line.
    this.ensure(58);
    const boxTop = this.y;
    this.cursor.push(this.rect(MARGIN_X, this.y - 26, CONTENT_W, 26, INK.surface));
    this.cursor.push(this.line(MARGIN_X, this.y - 26, MARGIN_X, this.y, TONES[block.tone ?? "brand"], 2));
    const ordinal = `#${String(block.index).padStart(2, "0")}`;
    this.cursor.push(this.textAt(ordinal, MARGIN_X + 9, this.y - 17, 8.5, "bold", INK.muted));
    const idText = `${block.id}`;
    const idWidth = estimateWidth(idText, 9, "bold");
    this.cursor.push(this.textAt(idText, MARGIN_X + 36, this.y - 17, 9, "bold", TONES.brand));
    const titleLimit = CONTENT_W - 46 - idWidth - 12;
    const titleLines = wrapText(block.title, 8.5, Math.max(80, titleLimit), "regular");
    this.cursor.push(this.textAt(titleLines[0], MARGIN_X + 36 + idWidth + 10, this.y - 17, 8.5, "regular", INK.body));
    if (block.severity) this.chip(block.severity, tone, PAGE_W - MARGIN_X - 6 - (estimateWidth(block.severity.toUpperCase(), 8, "bold") + 14), this.y - 21, 8);
    this.space(32);
    if (titleLines.length > 1) {
      for (const line of titleLines.slice(1)) {
        this.paragraph(line, 8.5, INK.muted, 36);
      }
    }

    for (const line of block.lines) {
      if (line.mono) {
        const lines = wrapText(line.text, 8, CONTENT_W - 46, "courier");
        this.ensure(lines.length * 11 + 8);
        this.cursor.push(this.rect(MARGIN_X + 14, this.y - lines.length * 11 - 4, CONTENT_W - 14, lines.length * 11 + 8, INK.surface));
        let textY = this.y - 10;
        for (const value of lines) {
          this.cursor.push(this.textAt(value, MARGIN_X + 22, textY, 8, "courier", [0.15, 0.22, 0.33]));
          textY -= 11;
        }
        this.space(lines.length * 11 + 12);
        continue;
      }
      if (line.label) {
        const label = `${line.label} `;
        const labelWidth = estimateWidth(label, 8.5, "bold");
        const lines = wrapText(line.text, 8.5, CONTENT_W - 14 - labelWidth, "regular");
        this.ensure(lines.length * 12 + 4);
        lines.forEach((value, index) => {
          if (index === 0) {
            this.cursor.push(this.textAt(label, MARGIN_X + 14, this.y - 9, 8.5, "bold", INK.muted));
          }
          this.cursor.push(
            this.textAt(value, MARGIN_X + 14 + (index === 0 ? labelWidth : 0), this.y - 9, 8.5, "regular", line.tone ? TONES[line.tone] : INK.body),
          );
          this.y -= 12;
        });
      } else {
        const lines = wrapText(line.text, 8.5, CONTENT_W - 14, "regular");
        this.ensure(lines.length * 12 + 4);
        for (const value of lines) {
          this.cursor.push(this.textAt(value, MARGIN_X + 14, this.y - 9, 8.5, "regular", line.tone ? TONES[line.tone] : INK.body));
          this.y -= 12;
        }
      }
    }
    this.space(10);
    const boxBottom = this.y;
    this.cursor.push(this.line(MARGIN_X, boxBottom + 4, PAGE_W - MARGIN_X, boxBottom + 4, INK.rule, 0.5));
    void boxTop;
  }

  /** Highlighted advisory note. */
  note(title: string | undefined, text: string) {
    const lines = wrapText(text, 9, CONTENT_W - 22, "regular");
    const height = lines.length * 12 + (title ? 20 : 8) + 8;
    this.ensure(height + 6);
    this.cursor.push(this.rect(MARGIN_X, this.y - height, CONTENT_W, height, INK.surface));
    this.cursor.push(this.line(MARGIN_X, this.y - height, MARGIN_X, this.y, TONES.violet, 2));
    let textY = this.y - 12;
    if (title) {
      this.cursor.push(this.textAt(title, MARGIN_X + 12, textY, 9, "bold", INK.heading));
      textY -= 14;
    }
    for (const line of lines) {
      this.cursor.push(this.textAt(line, MARGIN_X + 12, textY, 9, "regular", INK.body));
      textY -= 12;
    }
    this.space(height + 8);
  }

  /** Branded cover band and document identity block (page 1 only). */
  cover(block: Extract<PdfBlock, { type: "cover" }>) {
    this.cursor.push(this.rect(0, PAGE_H - 168, PAGE_W, 168, INK.navy));
    this.cursor.push(this.rect(0, PAGE_H - 168, PAGE_W, 3, TONES.brand));
    // Brand wordmark
    this.cursor.push(this.rect(MARGIN_X, PAGE_H - 74, 14, 14, TONES.brand));
    this.cursor.push(this.textAt(block.brand, MARGIN_X + 22, PAGE_H - 72, 13, "bold", INK.white));
    this.cursor.push(this.textAt("ACCESSIBILITY & SECURITY ASSESSMENT REPORT", MARGIN_X, PAGE_H - 96, 8, "bold", [0.55, 0.75, 0.95]));
    const titleLines = wrapText(block.title, 20, CONTENT_W, "bold");
    let titleY = PAGE_H - 122;
    for (const line of titleLines.slice(0, 2)) {
      this.cursor.push(this.textAt(line, MARGIN_X, titleY, 20, "bold", INK.white));
      titleY -= 24;
    }
    if (block.subtitle) {
      this.cursor.push(this.textAt(block.subtitle, MARGIN_X, titleY - 2, 9.5, "regular", [0.72, 0.82, 0.95]));
    }
    this.y = PAGE_H - 190;

    if (block.target) {
      this.cursor.push(this.rect(MARGIN_X, this.y - 34, CONTENT_W, 34, INK.surface));
      this.cursor.push(this.textAt("TARGET", MARGIN_X + 10, this.y - 13, 7, "bold", INK.muted));
      const targetLines = wrapText(block.target, 11, CONTENT_W - 24, "bold");
      this.cursor.push(this.textAt(targetLines[0], MARGIN_X + 10, this.y - 27, 11, "bold", INK.heading));
      this.space(42);
      if (targetLines.length > 1) {
        for (const extra of targetLines.slice(1)) this.paragraph(extra, 9, INK.muted);
      }
    }

    for (const [label, value] of block.meta) this.keyValue(label, value, 9);
    this.space(4);
  }

  finish(): string {
    if (this.cursor.length > 0) this.pages.push(this.cursor);
    const total = this.pages.length;

    // Footers (page numbers) are appended last so the total is known.
    this.pages.forEach((ops, index) => {
      ops.push(this.line(MARGIN_X, FOOTER_Y + 16, PAGE_W - MARGIN_X, FOOTER_Y + 16, INK.rule, 0.5));
      ops.push(this.textAt(this.header.brand, MARGIN_X, FOOTER_Y, 7.5, "regular", INK.muted));
      const pageLabel = `Page ${index + 1} of ${total}`;
      ops.push(
        this.textAt(pageLabel, PAGE_W - MARGIN_X - estimateWidth(pageLabel, 7.5, "regular"), FOOTER_Y, 7.5, "regular", INK.muted),
      );
      ops.push(this.textAt("Generated from stored scan records. Automated checks do not prove WCAG conformance.", MARGIN_X + 70, FOOTER_Y, 7, "regular", INK.muted));
    });

    const objects: string[] = [];
    objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
    objects.push(""); // Pages placeholder
    objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj");
    objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj");
    objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >> endobj");

    const pageRefs: number[] = [];
    let nextObject = objects.length + 1;
    for (const ops of this.pages) {
      const contentRef = nextObject;
      const pageRef = nextObject + 1;
      nextObject += 2;
      pageRefs.push(pageRef);
      const stream = ops.join("\n");
      objects.push(`${contentRef} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
      objects.push(
        `${pageRef} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentRef} 0 R >> endobj`,
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
}

/**
 * Render a branded multi-page document from blocks and return it base64-encoded
 * (the transport format the report server functions already return).
 */
export function buildReportPdf(options: {
  brand?: string;
  context?: string;
  blocks: PdfBlock[];
}): string {
  const brand = options.brand ?? "CyberSense";
  const doc = new PdfDoc(brand, options.context ?? "");
  for (const block of options.blocks) {
    switch (block.type) {
      case "cover":
        doc.cover(block);
        break;
      case "heading":
        doc.heading(block.text);
        break;
      case "subheading":
        doc.subheading(block.text);
        break;
      case "paragraph":
        doc.paragraph(block.text);
        break;
      case "bullets":
        for (const item of block.items) doc.bullet(item);
        doc.space(4);
        break;
      case "kv":
        doc.keyValue(block.label, block.value);
        break;
      case "metrics":
        doc.metrics(block.items);
        break;
      case "finding":
        doc.finding(block);
        break;
      case "note":
        doc.note(block.title, block.text);
        break;
      case "divider":
        doc.divider();
        break;
      case "spacer":
        doc.space(block.height ?? 10);
        break;
    }
  }
  return doc.finish();
}

/** Map an axe-core impact or security status onto a report tone. */
export function toneFor(value: string | null | undefined): PdfTone {
  switch ((value ?? "").toLowerCase()) {
    case "critical":
    case "fail":
    case "failed":
      return "critical";
    case "serious":
    case "not-verified":
      return "serious";
    case "moderate":
      return "moderate";
    case "minor":
    case "pass":
    case "completed":
      return "minor";
    default:
      return "unknown";
  }
}

/**
 * Original plain-text PDF helper. Kept for callers that only need a simple
 * paginated text dump.
 */
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
