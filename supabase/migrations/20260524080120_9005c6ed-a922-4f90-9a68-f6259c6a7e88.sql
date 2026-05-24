
-- 1. PROFILES (per-user metadata + billing)
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  notes TEXT,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_reason TEXT,
  charge_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle_days INTEGER NOT NULL DEFAULT 3,
  last_paid_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,30}$')
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own non-billing fields" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup (admin only inserts to auth.users via createUser)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname TEXT;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- ensure uniqueness fallback
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) THEN
    uname := uname || substr(NEW.id::text, 1, 6);
  END IF;
  INSERT INTO public.profiles (user_id, username, full_name)
  VALUES (NEW.id, uname, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  marked_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_payments_user ON public.payments(user_id, paid_at DESC);

-- 3. API KEYS: add owner + history opt-in
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS save_history BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_apikey ON public.api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_slug ON public.api_keys(public_slug);

-- Let users read keys they own (admins already covered by existing ALL policy)
CREATE POLICY "Users read own keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. LOGS: user agent + cascade
ALTER TABLE public.api_request_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add cascade FK (drop existing if any orphan, then add)
ALTER TABLE public.api_request_logs
  DROP CONSTRAINT IF EXISTS api_request_logs_api_key_id_fkey;
ALTER TABLE public.api_request_logs
  ADD CONSTRAINT api_request_logs_api_key_id_fkey
  FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_logs_key_time ON public.api_request_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_ip_time ON public.api_request_logs(ip, created_at DESC);

CREATE POLICY "Users view logs of own keys" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.api_keys k
    WHERE k.id = api_request_logs.api_key_id AND k.user_id = auth.uid()
  ));

-- 5. Suspend overdue users (called by cron OR proxy on-the-fly)
CREATE OR REPLACE FUNCTION public.suspend_overdue_users()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected INTEGER := 0;
BEGIN
  WITH overdue AS (
    UPDATE public.profiles
    SET is_suspended = true,
        suspended_reason = 'Payment overdue (auto)'
    WHERE is_suspended = false
      AND charge_amount > 0
      AND next_due_at < now()
    RETURNING user_id
  ),
  keys_off AS (
    UPDATE public.api_keys
    SET is_active = false
    WHERE user_id IN (SELECT user_id FROM overdue)
  )
  SELECT COUNT(*) INTO affected FROM overdue;
  RETURN affected;
END;
$$;

-- 6. Username -> email helper (login flow)
CREATE OR REPLACE FUNCTION public.find_email_by_username(uname TEXT)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.email FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE p.username = lower(uname)
  LIMIT 1;
$$;
