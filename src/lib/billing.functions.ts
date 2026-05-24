import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// Mark a billing cycle paid → resets next_due, unsuspends, re-enables keys.
export const adminMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      amount: z.number().min(0).max(1_000_000),
      note: z.string().max(200).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("*").eq("user_id", data.user_id).maybeSingle();
    if (!profile) throw new Error("User not found");

    const now = new Date();
    const periodStart = profile.last_paid_at ? new Date(profile.last_paid_at) : now;
    const cycleDays = profile.billing_cycle_days || 3;
    const nextDue = new Date(now.getTime() + cycleDays * 86400_000);

    await supabaseAdmin.from("payments").insert({
      user_id: data.user_id,
      amount: data.amount,
      paid_at: now.toISOString(),
      period_start: periodStart.toISOString(),
      period_end: nextDue.toISOString(),
      marked_by: context.userId,
      note: data.note ?? null,
    });

    await supabaseAdmin.from("profiles").update({
      last_paid_at: now.toISOString(),
      next_due_at: nextDue.toISOString(),
      is_suspended: false,
      suspended_reason: null,
    }).eq("user_id", data.user_id);

    // Re-enable user's keys (only those that weren't manually disabled separately)
    await supabaseAdmin.from("api_keys")
      .update({ is_active: true })
      .eq("user_id", data.user_id);

    return { ok: true, next_due_at: nextDue.toISOString() };
  });

// Update charge / cycle (admin)
export const adminUpdateBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      charge_amount: z.number().min(0).max(1_000_000).optional(),
      billing_cycle_days: z.number().int().min(1).max(365).optional(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.charge_amount !== undefined) patch.charge_amount = data.charge_amount;
    if (data.billing_cycle_days !== undefined) patch.billing_cycle_days = data.billing_cycle_days;
    if (data.notes !== undefined) patch.notes = data.notes;
    await supabaseAdmin.from("profiles").update(patch).eq("user_id", data.user_id);
    return { ok: true };
  });

// Run the suspension sweep on demand (admin trigger; also called by cron)
export const adminRunSuspendSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("suspend_overdue_users");
    if (error) throw new Error(error.message);
    return { suspended: data ?? 0 };
  });

// View payments of one user (admin)
export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("payments").select("*")
      .eq("user_id", data.user_id)
      .order("paid_at", { ascending: false });
    return { payments: rows ?? [] };
  });
