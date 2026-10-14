import type { A11yScanRecord } from "./types.ts";

export function buildA11yReportPdf(scan: A11yScanRecord): string {
  const lines: string[] = [];
  lines.push("CyberSense Accessibility Report");
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push(`Scan ID: ${scan.id}`);
  lines.push(`Target URL: ${scan.url}`);
  lines.push(`Scan date: ${scan.scannedAt}`);
  lines.push(`Status: ${scan.status}`);
  lines.push(`Engine: ${scan.engine}`);
  lines.push(`Limitations: ${scan.limitations.join(" ")}`);
  lines.push("");
  lines.push("Executive summary (simple academic English):");
  lines.push(
    `This automated scan found ${scan.summary.ruleCount} failing rule(s) affecting ${scan.summary.elementCount} element(s). ` +
      `${scan.summary.passCount} rule(s) passed and ${scan.summary.incompleteCount} rule(s) could not be decided automatically. ` +
      "Automated checks do not prove full WCAG conformance.",
  );
  lines.push("");
  lines.push(
    `Impact counts: critical ${scan.summary.byImpact.critical}, serious ${scan.summary.byImpact.serious}, ` +
      `moderate ${scan.summary.byImpact.moderate}, minor ${scan.summary.byImpact.minor}, unknown ${scan.summary.byImpact.unknown}.`,
  );
  lines.push("");
  lines.push("Findings:");
  for (const v of scan.violations) {
    lines.push(`- Rule: ${v.id} | Impact: ${v.impact ?? "unknown"} | WCAG: ${v.tags.join(", ") || "n/a"}`);
    lines.push(`  Description: ${v.description || v.help}`);
    lines.push(`  Remediation guidance: ${v.helpUrl || v.help}`);
    lines.push(`  Affected elements: ${v.nodeCount}`);
    if (v.nodes.length === 0) {
      lines.push("  Evidence: no stored element evidence for this rule.");
    }
    for (const n of v.nodes.slice(0, 5)) {
      const target = n.target.join(" > ");
      const html = n.html ? ` HTML: ${n.html.slice(0, 240)}` : "";
      const failure = n.failureSummary ? ` Failure: ${n.failureSummary.slice(0, 300)}` : "";
      lines.push(`  Evidence: ${target}${html}${failure}`);
    }
  }
  lines.push("");
  lines.push("Incomplete / manual review items:");
  for (const v of scan.incomplete) lines.push(`- ${v.id}: ${v.help}`);
  lines.push("");
  lines.push("Limitations:");
  for (const l of scan.limitations) lines.push(`- ${l}`);

  // Soft-wrap so long evidence remains on the page instead of running off the right edge.
  const wrapped = lines.flatMap((line) => wrap(line, 100));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 54) pages.push(wrapped.slice(i, i + 54));
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  // Placeholder; rewritten after we know page object references.
  objects.push("");
  objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj");

  const pageRefs: number[] = [];
  let nextObject = objects.length + 1;
  for (const page of pages) {
    const contentRef = nextObject;
    const pageRef = nextObject + 1;
    nextObject += 2;
    pageRefs.push(pageRef);

    const textOps = [
      "BT",
      "/F1 11 Tf",
      "50 760 Td",
      "14.5 TL",
      ...page.map((line) => `(${escapePdf(line)}) Tj T*`),
      "ET",
      "BT",
      "/F1 9 Tf",
      "50 24 Td",
      `(CyberSense accessibility report - page ${pageRefs.length}) Tj`,
      "ET",
    ].join("\n");
    const contentStream = textOps;
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
