import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, digits, underscore");

// ── List all users (admin) ──
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { users: data ?? [] };
  });

// ── Create user (admin) ──
const createUserSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(72),
  full_name: z.string().trim().max(120).optional().nullable(),
  charge_amount: z.number().min(0).max(1_000_000).default(0),
  billing_cycle_days: z.number().int().min(1).max(365).default(3),
  notes: z.string().max(500).optional().nullable(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Make sure username is free
    const { data: existing } = await supabaseAdmin
      .from("profiles").select("user_id").eq("username", data.username).maybeSingle();
    if (existing) throw new Error("Username already taken");

    const email = `${data.username}@local.osintoy`;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        full_name: data.full_name ?? null,
      },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");

    // Update profile with billing details (profile auto-created by trigger)
    const nextDue = new Date(Date.now() + data.billing_cycle_days * 86400_000).toISOString();
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name ?? null,
        charge_amount: data.charge_amount,
        billing_cycle_days: data.billing_cycle_days,
        next_due_at: nextDue,
        notes: data.notes ?? null,
      })
      .eq("user_id", created.user.id);

    return { user_id: created.user.id, username: data.username };
  });

// ── Reset password (admin) ──
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Delete user (admin) — cascades to keys + logs ──
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Toggle suspend (admin) ──
export const adminSetSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      is_suspended: z.boolean(),
      reason: z.string().max(200).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin
      .from("profiles")
      .update({
        is_suspended: data.is_suspended,
        suspended_reason: data.is_suspended ? (data.reason ?? "Suspended by admin") : null,
      })
      .eq("user_id", data.user_id);
    // Also flip all owned keys
    await supabaseAdmin
      .from("api_keys")
      .update({ is_active: !data.is_suspended })
      .eq("user_id", data.user_id);
    return { ok: true };
  });

// ── Get my profile (any user) ──
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    const { data: payments } = await supabase
      .from("payments").select("*").order("paid_at", { ascending: false }).limit(20);

    return { profile, isAdmin, payments: payments ?? [] };
  });
