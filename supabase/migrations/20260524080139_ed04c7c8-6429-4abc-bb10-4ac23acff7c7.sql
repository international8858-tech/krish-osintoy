
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.suspend_overdue_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_email_by_username(TEXT) FROM PUBLIC, anon, authenticated;
