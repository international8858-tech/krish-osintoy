
-- Re-attach the bootstrap trigger (function already exists)
DROP TRIGGER IF EXISTS bootstrap_admin_trigger ON auth.users;
CREATE TRIGGER bootstrap_admin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- Seed admin user if no admin exists yet
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    admin_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'admin@local.osintoy',
      crypt('Admin@2026', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"admin","full_name":"Administrator"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', 'admin@local.osintoy'),
      'email', 'admin@local.osintoy',
      now(), now(), now()
    );

    -- profile + admin role (in case trigger order didn't fire as expected)
    INSERT INTO public.profiles (user_id, username, full_name, charge_amount, billing_cycle_days, next_due_at)
    VALUES (admin_uid, 'admin', 'Administrator', 0, 9999, now() + interval '100 years')
    ON CONFLICT (user_id) DO UPDATE SET username = 'admin', charge_amount = 0;

    INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
