CREATE TABLE public.ip_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  blocked_until timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ip_blocks_ip_until ON public.ip_blocks(ip, blocked_until DESC);
ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ip_blocks" ON public.ip_blocks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_logs_ip_created ON public.api_request_logs(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_key_created ON public.api_request_logs(api_key_id, created_at DESC);