// Build a beautifully styled PDF of the API documentation.
// Uses jsPDF (pure JS — works in browser, no deps on canvas).
import { jsPDF } from "jspdf";
import { SERVICE_MAP, CATEGORIES, type ServiceDef } from "@/lib/services";

type Palette = {
  primary: [number, number, number];
  primarySoft: [number, number, number];
  accent: [number, number, number];
  text: [number, number, number];
  mute: [number, number, number];
  bg: [number, number, number];
  card: [number, number, number];
  border: [number, number, number];
  code: [number, number, number];
  codeText: [number, number, number];
};

const PALETTE: Palette = {
  primary: [99, 102, 241],     // indigo-500
  primarySoft: [238, 242, 255],
  accent: [139, 92, 246],      // violet-500
  text: [17, 24, 39],          // slate-900
  mute: [100, 116, 139],       // slate-500
  bg: [255, 255, 255],
  card: [248, 250, 252],       // slate-50
  border: [226, 232, 240],     // slate-200
  code: [15, 23, 42],          // slate-900
  codeText: [134, 239, 172],   // green-300
};

const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function buildDocPdf(opts: {
  customerName: string;
  apiKey: string;
  baseUrl: string;
  services: string[];
  creditsTotal: number | null;
  creditsUsed: number;
  expiresAt: string | null;
}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;

  // ────── Cover page ──────
  paintBg(doc, PALETTE.primary);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text("OSINT API", MARGIN, 90);
  doc.setFontSize(20);
  doc.setFont("helvetica", "normal");
  doc.text("Private Documentation", MARGIN, 102);

  // Glow accent stripe
  doc.setFillColor(...PALETTE.accent);
  doc.rect(MARGIN, 110, 60, 1.2, "F");

  doc.setFontSize(11);
  doc.setTextColor(230, 230, 255);
  doc.text(`Issued to: ${opts.customerName}`, MARGIN, 122);
  doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 130);
  doc.text(`Endpoints: ${opts.services.length}`, MARGIN, 138);
  const credits = opts.creditsTotal === null
    ? "Unlimited"
    : `${Math.max(0, opts.creditsTotal - opts.creditsUsed)} / ${opts.creditsTotal}`;
  doc.text(`Credits remaining: ${credits}`, MARGIN, 146);
  if (opts.expiresAt) doc.text(`Expires: ${new Date(opts.expiresAt).toLocaleDateString()}`, MARGIN, 154);

  // Footer on cover
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 230);
  doc.text("by Krishna · t.me/moneycomming", MARGIN, PAGE_H - 14);

  // ────── Pages ──────
  doc.addPage();
  y = MARGIN;
  y = drawH1(doc, "Introduction", y);
  y = drawParagraph(doc,
    "This document describes every endpoint enabled on your API key. " +
    "All endpoints return JSON over HTTPS. Pass your key as a query parameter or as the X-Api-Key header. " +
    "Each successful response costs 1 credit. Rate limits and security rules are listed below.", y);

  y = drawH2(doc, "Base URL", y + 4);
  y = drawCode(doc, opts.baseUrl, y);

  y = drawH2(doc, "Your API key", y + 4);
  y = drawCode(doc, opts.apiKey, y);

  y = drawH2(doc, "Authentication examples", y + 4);
  y = drawCodeLabel(doc, "cURL", y);
  y = drawCode(doc, `curl -H "X-Api-Key: ${opts.apiKey}" "${opts.baseUrl}/api/v1/number?num=7307841587"`, y);
  y = drawCodeLabel(doc, "JavaScript (fetch)", y);
  y = drawCode(doc,
`const r = await fetch("${opts.baseUrl}/api/v1/number?num=7307841587", {
  headers: { "X-Api-Key": "${opts.apiKey}" }
});
const data = await r.json();
console.log(data);`, y);

  y = drawH2(doc, "Rate limits & security", y + 4);
  y = drawBullets(doc, [
    "180 requests per minute per IP address.",
    "300 requests per minute per API key.",
    "Abuse (>360/min IP or >600/min key) → automatic 5-minute block, auto-recovers.",
    "Credits are charged only on HTTP 200 responses.",
    "Sensitive upstream identifiers are stripped from every response.",
  ], y);

  y = drawH2(doc, "Error codes", y + 4);
  const errs: Array<[string, string]> = [
    ["200", "Success — 1 credit used"],
    ["400", "Missing / invalid parameter"],
    ["401", "Missing or invalid API key"],
    ["402", "No credits remaining"],
    ["403", "Disabled, expired, IP blocked, or service not enabled"],
    ["429", "Rate limit exceeded or abuse detected"],
    ["502", "Upstream error"],
    ["504", "Upstream timeout (retry in a moment)"],
  ];
  y = drawErrorTable(doc, errs, y);

  // ────── Endpoints per category ──────
  const grouped: Record<string, ServiceDef[]> = {};
  for (const k of opts.services) {
    const d = SERVICE_MAP[k]; if (!d) continue;
    (grouped[d.category] ||= []).push(d);
  }
  const cats = CATEGORIES.filter((c) => grouped[c]?.length);

  for (const cat of cats) {
    doc.addPage();
    y = MARGIN;
    y = drawCategoryBanner(doc, cat, y);

    for (const def of grouped[cat]) {
      const need = 60;
      if (y + need > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
      y = drawEndpoint(doc, def, opts.baseUrl, opts.apiKey, y);
      y += 4;
    }
  }

  // Page numbers + footer on every page (skip cover)
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...PALETTE.mute);
    doc.text(`OSINT API · ${opts.customerName}`, MARGIN, PAGE_H - 6);
    doc.text(`${i} / ${total}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
    // top accent bar
    doc.setFillColor(...PALETTE.primary);
    doc.rect(0, 0, PAGE_W, 1.5, "F");
  }

  return doc;
}

// ─── helpers ───

function paintBg(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function ensure(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) { doc.addPage(); return MARGIN; }
  return y;
}

function drawH1(doc: jsPDF, text: string, y: number): number {
  y = ensure(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PALETTE.text);
  doc.text(text, MARGIN, y + 8);
  doc.setDrawColor(...PALETTE.primary);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 11, MARGIN + 30, y + 11);
  return y + 16;
}

function drawH2(doc: jsPDF, text: string, y: number): number {
  y = ensure(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PALETTE.primary);
  doc.text(text, MARGIN, y + 5);
  return y + 8;
}

function drawParagraph(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PALETTE.text);
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
  for (const line of lines) {
    y = ensure(doc, y, 5);
    doc.text(line, MARGIN, y + 4);
    y += 5;
  }
  return y;
}

function drawBullets(doc: jsPDF, items: string[], y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PALETTE.text);
  for (const it of items) {
    const lines = doc.splitTextToSize(it, CONTENT_W - 6) as string[];
    y = ensure(doc, y, lines.length * 5 + 2);
    doc.setFillColor(...PALETTE.primary);
    doc.circle(MARGIN + 1.4, y + 2.5, 0.9, "F");
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], MARGIN + 5, y + 4);
      y += 5;
    }
    y += 1;
  }
  return y;
}

function drawCodeLabel(doc: jsPDF, label: string, y: number): number {
  y = ensure(doc, y, 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.mute);
  doc.text(label.toUpperCase(), MARGIN, y + 3);
  return y + 4;
}

function drawCode(doc: jsPDF, text: string, y: number): number {
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, CONTENT_W - 6) as string[];
  const h = lines.length * 4.2 + 5;
  y = ensure(doc, y, h);
  doc.setFillColor(...PALETTE.code);
  doc.roundedRect(MARGIN, y, CONTENT_W, h, 1.5, 1.5, "F");
  doc.setTextColor(...PALETTE.codeText);
  let cy = y + 5;
  for (const line of lines) {
    doc.text(line, MARGIN + 3, cy);
    cy += 4.2;
  }
  return y + h + 2;
}

function drawErrorTable(doc: jsPDF, rows: Array<[string, string]>, y: number): number {
  const rowH = 7;
  const codeW = 18;
  const need = rows.length * rowH + 2;
  y = ensure(doc, y, need);
  for (let i = 0; i < rows.length; i++) {
    const [code, msg] = rows[i];
    if (i % 2 === 0) {
      doc.setFillColor(...PALETTE.card);
      doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PALETTE.primary);
    doc.text(code, MARGIN + 3, y + 4.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PALETTE.text);
    doc.setFontSize(9.5);
    doc.text(msg, MARGIN + codeW, y + 4.8);
    y += rowH;
  }
  return y + 2;
}

function drawCategoryBanner(doc: jsPDF, cat: string, y: number): number {
  doc.setFillColor(...PALETTE.primary);
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(cat.toUpperCase(), MARGIN + 5, y + 9);
  return y + 20;
}

function drawEndpoint(doc: jsPDF, def: ServiceDef, base: string, apiKey: string, y: number): number {
  // Title pill (GET + path)
  doc.setFillColor(...PALETTE.primarySoft);
  doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PALETTE.primary);
  doc.text("GET", MARGIN + 3, y + 6);
  doc.setTextColor(...PALETTE.text);
  doc.text(`/api/v1/${def.key}`, MARGIN + 14, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(def.label, PAGE_W - MARGIN - 3, y + 6, { align: "right" });
  y += 12;

  // Description
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PALETTE.text);
  const descLines = doc.splitTextToSize(def.description, CONTENT_W) as string[];
  for (const line of descLines) {
    y = ensure(doc, y, 5);
    doc.text(line, MARGIN, y + 4);
    y += 5;
  }
  y += 1;

  // Param
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PALETTE.mute);
  doc.text("PARAMETER", MARGIN, y + 3);
  y += 5;
  doc.setFont("courier", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...PALETTE.accent);
  doc.text(def.param, MARGIN, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PALETTE.text);
  const pdLines = doc.splitTextToSize(def.paramDesc, CONTENT_W - 30) as string[];
  doc.text(pdLines[0] ?? "", MARGIN + 28, y + 3);
  y += 6;

  if (def.notes) {
    y = ensure(doc, y, 8);
    doc.setFillColor(254, 252, 232);
    doc.roundedRect(MARGIN, y, CONTENT_W, 7, 1, 1, "F");
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Note: ${def.notes}`, MARGIN + 3, y + 4.7);
    y += 9;
  }

  // Example URL
  const exampleUrl = `${base}/api/v1/${def.key}?key=${apiKey}&${def.param}=${def.example}`;
  y = drawCodeLabel(doc, "Example request", y);
  y = drawCode(doc, exampleUrl, y);

  // Sample response (truncate big ones)
  const sample = JSON.stringify(def.sampleResponse, null, 2);
  const truncated = sample.length > 1400 ? sample.slice(0, 1400) + "\n... (truncated)" : sample;
  y = drawCodeLabel(doc, "Sample response", y);
  y = drawCode(doc, truncated, y);

  return y;
}
