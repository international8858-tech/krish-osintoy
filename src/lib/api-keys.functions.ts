import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERVICE_MAP } from "./services";
import { genRandom } from "./upstream.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  services: z.array(z.string().min(1).max(40)).min(1).max(50),
  credits_total: z.number().int().positive().nullable(),  // null = unlimited
  days: z.number().int().positive().nullable(),           // null = never expires
  notes: z.string().max(500).optional().nullable(),
});

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Validate services exist in catalog
    const valid = data.services.filter((s) => SERVICE_MAP[s]);
    if (valid.length === 0) throw new Error("No valid services selected");

    const expires_at = data.days
      ? new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Generate keys/slugs. Slug is long + unguessable per requirement.
    const safeName = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20) || "user";
    const api_key = `${safeName}-${genRandom(24)}`;
    const public_slug = genRandom(48);

    const { data: inserted, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        name: data.name,
        api_key,
        public_slug,
        services: valid,
        credits_total: data.credits_total,
        expires_at,
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { key: inserted };
  });

const toggleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export const toggleApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => toggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Rotate the public dashboard URL slug. Old link stops working immediately.
export const rotateSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const newSlug = genRandom(48);
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ public_slug: newSlug })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { public_slug: newSlug };
  });

const addCreditsSchema = z.object({
  id: z.string().uuid(),
  credits_total: z.number().int().positive().nullable(),
  extend_days: z.number().int().positive().nullable().optional(),
});

export const updateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addCreditsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: { credits_total: number | null; expires_at?: string } = {
      credits_total: data.credits_total,
    };
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

// Public — fetch by slug for the customer panel (no auth required).
// The slug is a 48-char unguessable token, so we can safely return the
// customer's own API key here so they can test inline in their dashboard.
export const getKeyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(10).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, api_key, public_slug, services, credits_total, credits_used, expires_at, is_active, created_at")
      .eq("public_slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { key: null };
    return { key: row };
  });
