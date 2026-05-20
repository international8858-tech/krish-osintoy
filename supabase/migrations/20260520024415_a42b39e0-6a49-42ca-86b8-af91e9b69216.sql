ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS blocked_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_api_keys_blocked_until ON public.api_keys(blocked_until);