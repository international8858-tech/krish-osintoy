import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICE_MAP } from "@/lib/services";
import { UPSTREAM_BASE, getUpstreamKey, sanitizeResponse } from "@/lib/upstream.server";

const RATE_LIMIT_PER_MIN = 60;   // per IP per minute
const RATE_LIMIT_PER_KEY_MIN = 120; // per API key per minute

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const Route = createFileRoute("/api/v1/$service")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const svc = SERVICE_MAP[params.service];
        if (!svc) return jsonResponse({ error: "Unknown service" }, 404);

        const url = new URL(request.url);
        // Accept key from query param or X-Api-Key header
        const key = url.searchParams.get("key") || request.headers.get("x-api-key");
        const value = url.searchParams.get(svc.param);

        if (!key) return jsonResponse({ error: "Missing API key. Pass ?key=YOUR_KEY or X-Api-Key header." }, 401);
        if (!value) return jsonResponse({ error: `Missing query param '${svc.param}'.` }, 400);
        if (value.length > 200) return jsonResponse({ error: "Query value too long." }, 400);

        const ip = getClientIp(request);

        // Per-IP rate limit (last 60 seconds)
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count: ipCount } = await supabaseAdmin
          .from("api_request_logs")
          .select("*", { count: "exact", head: true })
          .eq("ip", ip)
          .gte("created_at", since);

        if ((ipCount ?? 0) >= RATE_LIMIT_PER_MIN) {
          return jsonResponse({ error: "Rate limit exceeded. Slow down." }, 429);
        }

        // Lookup key
        const { data: keyRow, error: keyErr } = await supabaseAdmin
          .from("api_keys")
          .select("*")
          .eq("api_key", key)
          .maybeSingle();

        if (keyErr || !keyRow) {
          await supabaseAdmin.from("api_request_logs").insert({
            api_key_id: null, service: params.service, ip, status: 401, error_msg: "Invalid key",
          });
          return jsonResponse({ error: "Invalid API key." }, 401);
        }

        if (!keyRow.is_active) {
          return jsonResponse({ error: "This API key has been disabled." }, 403);
        }
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
          return jsonResponse({ error: "This API key has expired." }, 403);
        }
        if (!keyRow.services.includes(params.service)) {
          return jsonResponse({ error: `Service '${params.service}' is not enabled on this key.` }, 403);
        }
        if (keyRow.credits_total !== null && keyRow.credits_used >= keyRow.credits_total) {
          return jsonResponse({ error: "No credits remaining on this key." }, 402);
        }

        // Per-key rate limit
        const { count: keyCount } = await supabaseAdmin
          .from("api_request_logs")
          .select("*", { count: "exact", head: true })
          .eq("api_key_id", keyRow.id)
          .gte("created_at", since);
        if ((keyCount ?? 0) >= RATE_LIMIT_PER_KEY_MIN) {
          return jsonResponse({ error: "Per-key rate limit exceeded." }, 429);
        }

        // Call upstream
        const upstreamUrl = `${UPSTREAM_BASE}/api/${svc.key}?key=${encodeURIComponent(getUpstreamKey())}&${svc.param}=${encodeURIComponent(value)}`;

        let upstreamStatus = 502;
        let payload: unknown = { error: "Upstream unavailable" };
        try {
          const r = await fetch(upstreamUrl, {
            headers: { "User-Agent": "OSINT-Panel/1.0" },
            signal: AbortSignal.timeout(25_000),
          });
          upstreamStatus = r.status;
          const text = await r.text();
          try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
        } catch (e) {
          payload = { error: "Upstream timeout or error" };
        }

        const sanitized = sanitizeResponse(payload);

        // Charge a credit on success (2xx upstream)
        const success = upstreamStatus >= 200 && upstreamStatus < 300;
        if (success) {
          await supabaseAdmin
            .from("api_keys")
            .update({ credits_used: keyRow.credits_used + 1 })
            .eq("id", keyRow.id);
        }

        // Log
        await supabaseAdmin.from("api_request_logs").insert({
          api_key_id: keyRow.id,
          service: params.service,
          query_param: value.slice(0, 100),
          ip,
          status: upstreamStatus,
          error_msg: success ? null : `upstream ${upstreamStatus}`,
        });

        return jsonResponse(sanitized, success ? 200 : upstreamStatus);
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
          },
        }),
    },
  },
});
