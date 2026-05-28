
CREATE TABLE public.telegram_sessions (
  chat_id BIGINT PRIMARY KEY,
  api_key TEXT,
  pending_service TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_sessions TO service_role;

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server) touches this table.
