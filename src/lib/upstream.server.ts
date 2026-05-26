// Server-only constants + helpers for the upstream OSINT API.
export const UPSTREAM_BASE = "https://ft-osint-api.duckdns.org";

export function getUpstreamKey(): string {
  return process.env.UPSTREAM_API_KEY || "nobita-neew";
}

// Fields we strip ENTIRELY from every response (branding + leaks).
const STRIP_KEYS = new Set([
  "by", "channel", "promotion", "promo", "promoted_by", "credit", "credits_by",
  "developer", "dev", "creator", "owner", "author",
  "telegram", "tg", "tg_channel", "support_channel", "support",
  "api_key", "apikey", "key", "secret", "token",
  "created_by", "source_url", "upstream", "backend", "powered_by", "made_by",
]);

// Substrings in string VALUES that mean "promotional / branding text"
// — we drop any key whose string value contains one of these.
const STRIP_VALUE_HINTS = [
  "t.me/",
  "telegram.me/",
  "@",
  "join our",
  "subscribe",
  "powered by",
  "made by",
  "developed by",
  "credits to",
];

function looksPromotional(s: string): boolean {
  const lower = s.toLowerCase();
  return STRIP_VALUE_HINTS.some((h) => lower.includes(h));
}

// Recursively sanitize any JSON value.
export function sanitizeResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeResponse);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (STRIP_KEYS.has(lower)) continue;
      // Drop string fields that are obviously promo links / handles.
      if (typeof v === "string" && looksPromotional(v) && v.length < 300) continue;
      out[k] = sanitizeResponse(v);
    }
    return out;
  }
  if (typeof value === "string") {
    const up = getUpstreamKey();
    if (up && value.includes(up)) return value.replaceAll(up, "***");
    return value;
  }
  return value;
}

// Generate a long unguessable key/slug.
export function genRandom(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
