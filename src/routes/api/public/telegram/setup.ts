// One-shot helper — open this URL in your browser once to register the webhook.
// GET  /api/public/telegram/setup        → registers the webhook to this host
// GET  /api/public/telegram/setup?info=1 → shows current webhook info
// GET  /api/public/telegram/setup?delete=1 → removes the webhook
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`tg-webhook:${token}`).digest("base64url");
}

export const Route = createFileRoute("/api/public/telegram/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          return new Response("TELEGRAM_BOT_TOKEN not set", { status: 500 });
        }
        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;
        const webhook = `${base}/api/public/telegram/webhook`;

        if (url.searchParams.get("info")) {
          const r = await fetch(
            `https://api.telegram.org/bot${token}/getWebhookInfo`,
          );
          return new Response(await r.text(), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.searchParams.get("delete")) {
          const r = await fetch(
            `https://api.telegram.org/bot${token}/deleteWebhook`,
          );
          return new Response(await r.text(), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const secret = deriveSecret(token);
        const r = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: webhook,
              secret_token: secret,
              allowed_updates: ["message", "edited_message", "callback_query"],
              drop_pending_updates: true,
            }),
          },
        );
        const body = await r.text();
        return new Response(
          `Registered webhook at:\n${webhook}\n\nTelegram response:\n${body}`,
          { status: r.ok ? 200 : 500 },
        );
      },
    },
  },
});
