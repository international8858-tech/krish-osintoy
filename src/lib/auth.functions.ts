import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Resolves username -> internal email so the client can sign in with password.
// Username is validated; not found returns null (client treats both as invalid creds).
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(30)
        .regex(/^[a-z0-9_]+$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("user_id, is_suspended")
      .eq("username", data.username)
      .maybeSingle();
    if (!row) return { email: null, suspended: false };

    // Look up actual auth email via admin API
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    return {
      email: u?.user?.email ?? null,
      suspended: row.is_suspended,
    };
  });
