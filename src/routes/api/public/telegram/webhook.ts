// Telegram bot — user pastes their API key, bot auto-detects available services,
// shows them as buttons, and runs queries through the upstream OSINT API.
//
// Webhook URL: https://<host>/api/public/telegram/webhook
// Security: Telegram is asked to send a `X-Telegram-Bot-Api-Secret-Token` header
// derived from the bot token. We reject anything else.
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICES, SERVICE_MAP } from "@/lib/services";
import { UPSTREAM_BASE, getUpstreamKey, sanitizeResponse } from "@/lib/upstream.server";

const TG_API = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

function deriveSecret(token: string): string {
  return createHash("sha256").update(`tg-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function tg(token: string, method: string, body: unknown) {
  try {
    await fetch(TG_API(token, method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // best-effort, never throw out of webhook
  }
}

async function sendMsg(
  token: string,
  chat_id: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return tg(token, "sendMessage", {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

function fmtKeyInfo(k: {
  name: string;
  api_key: string;
  services: string[];
  credits_total: number | null;
  credits_used: number;
  expires_at: string | null;
  is_active: boolean;
}): string {
  const creditsLeft =
    k.credits_total === null ? "∞" : Math.max(0, k.credits_total - k.credits_used);
  const daysLeft = k.expires_at
    ? Math.max(0, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000))
    : "∞";
  return [
    `<b>🔑 ${escapeHtml(k.name)}</b>`,
    `<b>Status:</b> ${k.is_active ? "✅ Active" : "❌ Disabled"}`,
    `<b>Credits left:</b> ${creditsLeft}${k.credits_total !== null ? ` / ${k.credits_total}` : ""}`,
    `<b>Days left:</b> ${daysLeft}`,
    `<b>Services:</b> ${k.services.length}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
}

function buildServiceKeyboard(enabledServices: string[]) {
  // Only show services the key has access to, in pairs of 2 buttons per row.
  const valid = enabledServices.filter((s) => SERVICE_MAP[s]);
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < valid.length; i += 2) {
    rows.push(
      valid.slice(i, i + 2).map((s) => ({
        text: `${SERVICE_MAP[s].label}`,
        callback_data: `svc:${s}`,
      })),
    );
  }
  rows.push([
    { text: "💳 My Info", callback_data: "info" },
    { text: "🔄 Change Key", callback_data: "logout" },
  ]);
  return { inline_keyboard: rows };
}

async function loadKey(api_key: string) {
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select(
      "id, name, api_key, services, credits_total, credits_used, expires_at, is_active",
    )
    .eq("api_key", api_key)
    .maybeSingle();
  return data;
}

async function getSession(chat_id: number) {
  const { data } = await supabaseAdmin
    .from("telegram_sessions")
    .select("api_key, pending_service")
    .eq("chat_id", chat_id)
    .maybeSingle();
  return data;
}

async function saveSession(
  chat_id: number,
  patch: { api_key?: string | null; pending_service?: string | null },
) {
  await supabaseAdmin
    .from("telegram_sessions")
    .upsert(
      { chat_id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "chat_id" },
    );
}

async function callService(api_key: string, serviceKey: string, value: string) {
  const svc = SERVICE_MAP[serviceKey];
  if (!svc) throw new Error("Unknown service");
  const url = `${UPSTREAM_BASE}/api/${svc.key}?key=${encodeURIComponent(
    getUpstreamKey(),
  )}&${svc.param}=${encodeURIComponent(value)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await r.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  // increment credit on success (fire and forget)
  if (r.ok) {
    supabaseAdmin
      .from("api_keys")
      .select("credits_used")
      .eq("api_key", api_key)
      .single()
      .then(({ data }) => {
        if (data) {
          supabaseAdmin
            .from("api_keys")
            .update({ credits_used: (data.credits_used ?? 0) + 1 })
            .eq("api_key", api_key)
            .then(() => {});
        }
      });
  }
  return { ok: r.ok, status: r.status, body: sanitizeResponse(payload) };
}

function formatResult(body: unknown, maxLen = 3500): string {
  const json = JSON.stringify(body, null, 2);
  if (json.length <= maxLen) return `<pre>${escapeHtml(json)}</pre>`;
  return `<pre>${escapeHtml(json.slice(0, maxLen))}\n…(truncated)</pre>`;
}

async function handleStart(token: string, chat_id: number) {
  await saveSession(chat_id, { api_key: null, pending_service: null });
  await sendMsg(
    token,
    chat_id,
    [
      "👋 <b>Welcome to OSINT Tester Bot</b>",
      "",
      "Send me your <b>API key</b> to begin.",
      "I will auto-detect which services are enabled on your key and show them as buttons.",
      "",
      "<i>Commands:</i> /start • /info • /logout",
    ].join("\n"),
  );
}

async function handleApiKeyInput(
  token: string,
  chat_id: number,
  text: string,
) {
  const key = text.trim();
  const row = await loadKey(key);
  if (!row) {
    await sendMsg(
      token,
      chat_id,
      "❌ Invalid API key. Please paste a valid key issued from your panel.",
    );
    return;
  }
  if (!row.is_active) {
    await sendMsg(token, chat_id, "❌ This API key is disabled / revoked.");
    return;
  }
  await saveSession(chat_id, { api_key: key, pending_service: null });
  await sendMsg(
    token,
    chat_id,
    [
      "✅ <b>API key connected</b>",
      "",
      fmtKeyInfo(row),
      "",
      "👇 Tap a service to use it:",
    ].join("\n"),
    { reply_markup: buildServiceKeyboard(row.services) },
  );
}

async function handleServicePick(
  token: string,
  chat_id: number,
  serviceKey: string,
) {
  const session = await getSession(chat_id);
  if (!session?.api_key) {
    await sendMsg(token, chat_id, "Send your API key first. /start");
    return;
  }
  const svc = SERVICE_MAP[serviceKey];
  if (!svc) {
    await sendMsg(token, chat_id, "Unknown service.");
    return;
  }
  const row = await loadKey(session.api_key);
  if (!row || !row.services.includes(serviceKey)) {
    await sendMsg(
      token,
      chat_id,
      "❌ This service is not enabled on your key.",
    );
    return;
  }
  await saveSession(chat_id, { pending_service: serviceKey });
  await sendMsg(
    token,
    chat_id,
    [
      `<b>${escapeHtml(svc.label)}</b>`,
      escapeHtml(svc.description),
      "",
      `Send the <b>${escapeHtml(svc.paramDesc)}</b>`,
      `Example: <code>${escapeHtml(svc.example)}</code>`,
    ].join("\n"),
  );
}

async function handleServiceRun(
  token: string,
  chat_id: number,
  serviceKey: string,
  value: string,
) {
  const session = await getSession(chat_id);
  if (!session?.api_key) {
    await sendMsg(token, chat_id, "Session lost. Send your API key. /start");
    return;
  }
  await sendMsg(token, chat_id, `🔎 Querying <b>${escapeHtml(serviceKey)}</b>…`);
  try {
    const res = await callService(session.api_key, serviceKey, value);
    await saveSession(chat_id, { pending_service: null });
    const updated = await loadKey(session.api_key);
    const footer = updated
      ? `\n\n<b>Credits left:</b> ${
          updated.credits_total === null
            ? "∞"
            : Math.max(0, updated.credits_total - updated.credits_used)
        }`
      : "";
    await sendMsg(
      token,
      chat_id,
      formatResult(res.body) + footer,
      updated
        ? { reply_markup: buildServiceKeyboard(updated.services) }
        : {},
    );
  } catch (e: unknown) {
    await sendMsg(
      token,
      chat_id,
      "❌ Request failed: " + escapeHtml(e instanceof Error ? e.message : "error"),
    );
  }
}

async function handleInfo(token: string, chat_id: number) {
  const session = await getSession(chat_id);
  if (!session?.api_key) {
    await sendMsg(token, chat_id, "No key connected. /start");
    return;
  }
  const row = await loadKey(session.api_key);
  if (!row) {
    await sendMsg(token, chat_id, "Key not found. /start");
    return;
  }
  await sendMsg(token, chat_id, fmtKeyInfo(row), {
    reply_markup: buildServiceKeyboard(row.services),
  });
}

async function processUpdate(token: string, update: Record<string, unknown>) {
  // Callback button
  const cb = update.callback_query as
    | { id: string; data?: string; message?: { chat?: { id?: number } } }
    | undefined;
  if (cb && cb.message?.chat?.id) {
    const chat_id = cb.message.chat.id;
    const data = cb.data ?? "";
    // ack
    tg(token, "answerCallbackQuery", { callback_query_id: cb.id });
    if (data === "info") await handleInfo(token, chat_id);
    else if (data === "logout") await handleStart(token, chat_id);
    else if (data.startsWith("svc:"))
      await handleServicePick(token, chat_id, data.slice(4));
    return;
  }

  const msg = (update.message ?? update.edited_message) as
    | { chat?: { id?: number }; text?: string }
    | undefined;
  const chat_id = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();
  if (!chat_id || !text) return;

  if (text === "/start") return handleStart(token, chat_id);
  if (text === "/info" || text === "/credits") return handleInfo(token, chat_id);
  if (text === "/logout") {
    await saveSession(chat_id, { api_key: null, pending_service: null });
    return sendMsg(token, chat_id, "✅ Logged out. Send /start to begin again.");
  }
  if (text === "/services") {
    return sendMsg(
      token,
      chat_id,
      "Available services in the panel:\n\n" +
        SERVICES.map((s) => `• <code>${s.key}</code> — ${escapeHtml(s.label)}`).join("\n"),
    );
  }

  const session = await getSession(chat_id);

  // No key yet → treat input as API key
  if (!session?.api_key) {
    return handleApiKeyInput(token, chat_id, text);
  }
  // Waiting for service input
  if (session.pending_service) {
    return handleServiceRun(token, chat_id, session.pending_service, text);
  }
  // Otherwise, re-show keyboard
  const row = await loadKey(session.api_key);
  if (!row) {
    await saveSession(chat_id, { api_key: null });
    return sendMsg(token, chat_id, "Your key is no longer valid. /start");
  }
  await sendMsg(
    token,
    chat_id,
    "Tap a service to use it:",
    { reply_markup: buildServiceKeyboard(row.services) },
  );
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      GET: async () =>
        new Response("Telegram webhook ready.", { status: 200 }),
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Bot not configured", { status: 500 });

        const expected = deriveSecret(token);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let update: Record<string, unknown>;
        try {
          update = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        // Always ack fast; Telegram retries on non-200.
        processUpdate(token, update).catch(() => {});
        return new Response("ok");
      },
    },
  },
});
