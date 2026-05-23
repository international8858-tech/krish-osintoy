import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICE_MAP } from "@/lib/services";
import { UPSTREAM_BASE, getUpstreamKey, sanitizeResponse } from "@/lib/upstream.server";

// Limits — generous so legit traffic flies, abuse still gets blocked.
const IP_LIMIT_PER_MIN = 180;
const IP_ABUSE_THRESHOLD = 360;
const IP_BLOCK_MINUTES = 5;
const KEY_LIMIT_PER_MIN = 300;
const KEY_ABUSE_THRESHOLD = 600;
const KEY_BLOCK_MINUTES = 5;
const MAX_VALUE_LEN = 200;
const UPSTREAM_TIMEOUT_MS = 20_000;

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Powered-By": "OSINT-Panel",
      ...extraHeaders,
    },
  });
}

export const Route = createFileRoute("/api/v1/$service")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
          },
        }),
      GET: async ({ request, params }) => {
        const svc = SERVICE_MAP[params.service];
        if (!svc) return jsonResponse({ success: false, error: "Unknown service" }, 404);

        const url = new URL(request.url);
        const key = url.searchParams.get("key") || request.headers.get("x-api-key");
        const value = url.searchParams.get(svc.param);
        const ip = getClientIp(request);

        // Cheap input validation first — no DB needed.
        if (!key) return jsonResponse({ success: false, error: "Missing API key. Pass ?key=YOUR_KEY or X-Api-Key header." }, 401);
        if (!value) return jsonResponse({ success: false, error: `Missing query param '${svc.param}'.` }, 400);
        if (value.length > MAX_VALUE_LEN) return jsonResponse({ success: false, error: "Query value too long." }, 400);

        const sinceIso = new Date(Date.now() - 60_000).toISOString();
        const nowIso = new Date().toISOString();

        // 🚀 Parallel: block check + IP count + key lookup + key count
        const [blockRes, ipCountRes, keyRes] = await Promise.all([
          supabaseAdmin
            .from("ip_blocks")
            .select("blocked_until")
            .eq("ip", ip)
            .gt("blocked_until", nowIso)
            .order("blocked_until", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("api_request_logs")
            .select("*", { count: "exact", head: true })
            .eq("ip", ip)
            .gte("created_at", sinceIso),
          supabaseAdmin
            .from("api_keys")
            .select("*")
            .eq("api_key", key)
            .maybeSingle(),
        ]);

        if (blockRes.data) {
          return jsonResponse({
            success: false,
            error: "Your IP is temporarily blocked due to abuse. Try again later.",
            blocked_until: blockRes.data.blocked_until,
          }, 403);
        }

        const ipHits = ipCountRes.count ?? 0;
        if (ipHits >= IP_ABUSE_THRESHOLD) {
          const until = new Date(Date.now() + IP_BLOCK_MINUTES * 60_000).toISOString();
          // fire and forget
          supabaseAdmin.from("ip_blocks").insert({ ip, blocked_until: until, reason: `auto: ${ipHits}/min` }).then(() => {});
          return jsonResponse({ success: false, error: "Abuse detected. IP blocked for several minutes." }, 429);
        }
        if (ipHits >= IP_LIMIT_PER_MIN) {
          return jsonResponse({ success: false, error: "Rate limit exceeded. Slow down." }, 429, { "Retry-After": "60" });
        }

        const keyRow = keyRes.data;
        if (keyRes.error || !keyRow) {
          supabaseAdmin.from("api_request_logs").insert({
            api_key_id: null, service: params.service, ip, status: 401, error_msg: "Invalid key",
          }).then(() => {});
          return jsonResponse({ success: false, error: "Invalid API key." }, 401);
        }

        if (!keyRow.is_active) return jsonResponse({ success: false, error: "This API key has been disabled." }, 403);
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())
          return jsonResponse({ success: false, error: "This API key has expired." }, 403);
        if (keyRow.blocked_until && new Date(keyRow.blocked_until) > new Date()) {
          return jsonResponse({
            success: false,
            error: "This API key is temporarily blocked due to abuse. Try again in a few minutes.",
            blocked_until: keyRow.blocked_until,
          }, 429);
        }
        if (!keyRow.services.includes(params.service))
          return jsonResponse({ success: false, error: `Service '${params.service}' is not enabled on this key.` }, 403);
        if (keyRow.credits_total !== null && keyRow.credits_used >= keyRow.credits_total)
          return jsonResponse({ success: false, error: "No credits remaining on this key." }, 402);

        // Per-key count — only one extra query left, do it now.
        const { count: keyCount } = await supabaseAdmin
          .from("api_request_logs")
          .select("*", { count: "exact", head: true })
          .eq("api_key_id", keyRow.id)
          .gte("created_at", sinceIso);
        const keyHits = keyCount ?? 0;
        if (keyHits >= KEY_ABUSE_THRESHOLD) {
          const until = new Date(Date.now() + KEY_BLOCK_MINUTES * 60_000).toISOString();
          supabaseAdmin.from("api_keys").update({ blocked_until: until }).eq("id", keyRow.id).then(() => {});
          return jsonResponse({
            success: false,
            error: `Key temporarily blocked due to abuse. Auto-resumes in ${KEY_BLOCK_MINUTES} minutes.`,
            blocked_until: until,
          }, 429);
        }
        if (keyHits >= KEY_LIMIT_PER_MIN) {
          return jsonResponse({ success: false, error: "Per-key rate limit exceeded." }, 429, { "Retry-After": "60" });
        }

        // 🚀 Call upstream
        const upstreamUrl = `${UPSTREAM_BASE}/api/${svc.key}?key=${encodeURIComponent(getUpstreamKey())}&${svc.param}=${encodeURIComponent(value)}`;

        let upstreamStatus = 502;
        let payload: unknown = { success: false, error: "Upstream unavailable" };
        const t0 = Date.now();
        try {
          const r = await fetch(upstreamUrl, {
            headers: { "User-Agent": "OSINT-Panel/1.0", "Accept": "application/json" },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
          upstreamStatus = r.status;
          const text = await r.text();
          try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
        } catch {
          payload = { success: false, error: "Upstream timeout. Please retry." };
          upstreamStatus = 504;
        }
        const latency = Date.now() - t0;

        const sanitized = sanitizeResponse(payload);
        const success = upstreamStatus >= 200 && upstreamStatus < 300;

        // 🚀 Fire-and-forget: don't make the user wait for logging/credit update.
        if (success) {
          supabaseAdmin
            .from("api_keys")
            .update({ credits_used: keyRow.credits_used + 1 })
            .eq("id", keyRow.id)
            .then(() => {});
        }
        supabaseAdmin.from("api_request_logs").insert({
          api_key_id: keyRow.id,
          service: params.service,
          query_param: value.slice(0, 100),
          ip,
          status: upstreamStatus,
          error_msg: success ? null : `upstream ${upstreamStatus}`,
        }).then(() => {});

        const creditsLeft = keyRow.credits_total === null
          ? "unlimited"
          : Math.max(0, keyRow.credits_total - keyRow.credits_used - (success ? 1 : 0)).toString();

        return jsonResponse(sanitized, success ? 200 : upstreamStatus, {
          "X-RateLimit-Limit": String(KEY_LIMIT_PER_MIN),
          "X-RateLimit-Remaining": String(Math.max(0, KEY_LIMIT_PER_MIN - keyHits - 1)),
          "X-Credits-Remaining": creditsLeft,
          "X-Upstream-Latency": `${latency}ms`,
        });
      },
    },
  },
});
