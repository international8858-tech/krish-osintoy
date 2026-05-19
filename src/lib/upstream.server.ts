// Server-only constants + helpers for the upstream OSINT API.
export const UPSTREAM_BASE = "https://ft-osint-api.duckdns.org";

export function getUpstreamKey(): string {
  return process.env.UPSTREAM_API_KEY || "nobita-neew";
}

// Fields whose VALUES we replace in every response.
const REPLACE_VALUES: Record<string, string> = {
  by: "Krishna",
  channel: "https://t.me/moneycomming",
};

// Fields we strip entirely (potential leaks).
const STRIP_KEYS = new Set([
  "api_key", "apikey", "key", "secret", "token",
  "created_by", "creator", "developer", "dev",
  "source_url", "upstream", "backend",
]);

// Recursively sanitize any JSON value.
export function sanitizeResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeResponse);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (STRIP_KEYS.has(lower)) continue;
      if (lower in REPLACE_VALUES) {
        out[k] = REPLACE_VALUES[lower];
      } else {
        out[k] = sanitizeResponse(v);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    // Replace upstream key if it accidentally appears anywhere in strings.
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
