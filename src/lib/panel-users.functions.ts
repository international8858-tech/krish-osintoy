// Admin-only: create / list / delete "panel users" (username + password accounts).
// Self-signup is NOT allowed anywhere — only the master admin can create these.
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

const PANEL_EMAIL_DOMAIN = "panel.local";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(40, "Username too long")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, digits, underscore"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  full_name: z.string().trim().max(80).optional().nullable(),
});

export const createPanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Ensure username free
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing) throw new Error("Username already taken");

    const email = `${data.username}@${PANEL_EMAIL_DOMAIN}`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        full_name: data.full_name ?? null,
      },
    });
    if (error) throw new Error(error.message);

    return { user_id: created.user?.id, username: data.username };
  });

export const listPanelUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, full_name, created_at, is_suspended")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { users: data ?? [] };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deletePanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    // Block deletion of any other admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) throw new Error("Cannot delete an admin account");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resetSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8).max(128),
});

export const resetPanelUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
