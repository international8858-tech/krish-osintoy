import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-triggered endpoint to suspend overdue accounts.
// Called hourly by pg_cron. Bypasses auth (under /api/public/*) and uses
// the SECURITY DEFINER `suspend_overdue_users` SQL function (called via admin client).
export const Route = createFileRoute("/api/public/cron/suspend")({
  server: {
    handlers: {
      POST: async () => {
        const { data, error } = await supabaseAdmin.rpc("suspend_overdue_users");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, suspended: data ?? 0, at: new Date().toISOString() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok"),
    },
  },
});
