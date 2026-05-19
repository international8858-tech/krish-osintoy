
-- Set search_path on the trigger functions
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
-- (RLS policies invoke has_role via the definer context; trigger invokes bootstrap_first_admin via the trigger context)
