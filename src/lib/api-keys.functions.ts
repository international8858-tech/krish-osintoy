import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICE_MAP } from "./services";
import { genRandom } from "./upstream.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// ── ADMIN: list ALL keys ──
export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("api_keys").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

// ── USER: list own keys ──
export const listMyKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("api_keys").select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

// ── CREATE key (admin assigns to user; OR user creates their own) ──
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  services: z.array(z.string().min(1).max(40)).min(1).max(50),
  credits_total: z.number().int().positive().nullable(),
  days: z.number().int().positive().nullable(),
  notes: z.string().max(500).optional().nullable(),
  save_history: z.boolean().default(false),
  user_id: z.string().uuid().optional().nullable(),
});

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const valid = data.services.filter((s) => SERVICE_MAP[s]);
    if (valid.length === 0) throw new Error("No valid services selected");

    // Admin can assign to any user; non-admin always = self
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    const ownerId = isAdmin ? (data.user_id ?? context.userId) : context.userId;

    // Non-admin: enforce not suspended
    if (!isAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("is_suspended").eq("user_id", context.userId).maybeSingle();
      if (profile?.is_suspended) throw new Error("Account suspended. Contact admin.");
    }

    const expires_at = data.days
      ? new Date(Date.now() + data.days * 86400_000).toISOString()
      : null;

    const safeName = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) || "user";
    const api_key = `${safeName}-${genRandom(24)}`;
    const public_slug = genRandom(48);

    const { data: inserted, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        name: data.name,
        api_key, public_slug,
        services: valid,
        credits_total: data.credits_total,
        expires_at,
        notes: data.notes ?? null,
        save_history: data.save_history,
        user_id: ownerId,
        created_by: context.userId,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return { key: inserted };
  });

// ── TOGGLE (owner or admin) ──
async function assertOwnerOrAdmin(userId: string, keyId: string) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (roleRow) return;
  const { data: k } = await supabaseAdmin
    .from("api_keys").select("user_id").eq("id", keyId).maybeSingle();
  if (!k || k.user_id !== userId) throw new Error("Forbidden");
}

export const toggleApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context.userId, data.id);
    const { error } = await supabaseAdmin
      .from("api_keys").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context.userId, data.id);
    // logs cascade automatically via FK ON DELETE CASCADE
    const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context.userId, data.id);
    const newSlug = genRandom(48);
    const { error } = await supabaseAdmin
      .from("api_keys").update({ public_slug: newSlug }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { public_slug: newSlug };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  credits_total: z.number().int().positive().nullable().optional(),
  extend_days: z.number().int().positive().nullable().optional(),
  save_history: z.boolean().optional(),
});

export const updateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context.userId, data.id);
    const patch: Record<string, unknown> = {};
    if (data.credits_total !== undefined) patch.credits_total = data.credits_total;
    if (data.save_history !== undefined) patch.save_history = data.save_history;
    if (data.extend_days) {
      const { data: row } = await supabaseAdmin
        .from("api_keys").select("expires_at").eq("id", data.id).single();
      const base = row?.expires_at ? new Date(row.expires_at) : new Date();
      patch.expires_at = new Date(base.getTime() + data.extend_days * 86400000).toISOString();
    }
    const { error } = await supabaseAdmin.from("api_keys").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Public by slug (legacy panel) ──
export const getKeyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(10).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, api_key, public_slug, services, credits_total, credits_used, expires_at, is_active, created_at, save_history")
      .eq("public_slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { key: null };
    return { key: row };
  });

// ── Request history (owner or admin) ──
export const listKeyHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      key_id: z.string().uuid(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(context.userId, data.key_id);
    const { data: logs, error } = await supabaseAdmin
      .from("api_request_logs")
      .select("*")
      .eq("api_key_id", data.key_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { logs: logs ?? [] };
  });
