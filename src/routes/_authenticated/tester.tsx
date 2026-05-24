import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { listApiKeys } from "@/lib/api-keys.functions";
import { SERVICES, SERVICE_MAP } from "@/lib/services";
import { ArrowLeft, Play, Loader2, Copy, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tester")({
  component: TesterPage,
  head: () => ({ meta: [{ title: "Tester — OSINT Panel" }, { name: "robots", content: "noindex" }] }),
});

type ApiKeyRow = {
  id: string; name: string; api_key: string; services: string[];
  is_active: boolean; expires_at: string | null;
};

function TesterPage() {
  const list = useServerFn(listApiKeys);
  const { data, isLoading } = useQuery({ queryKey: ["api_keys"], queryFn: () => list({}) });
  const keys = (data?.keys ?? []) as ApiKeyRow[];

  const [keyId, setKeyId] = useState<string>("");
  const [serviceKey, setServiceKey] = useState<string>(SERVICES[0]?.key ?? "");
  const [input, setInput] = useState<string>(SERVICES[0]?.example ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string; ms: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const activeKey = keys.find((k) => k.id === keyId);
  const svc = SERVICE_MAP[serviceKey];

  // Pick first active key by default
  useEffect(() => {
    if (!keyId && keys.length) {
      const first = keys.find((k) => k.is_active) || keys[0];
      setKeyId(first.id);
    }
  }, [keys, keyId]);

  // Filter services to those enabled on selected key
  const allowedServices = useMemo(() => {
    if (!activeKey) return SERVICES;
    return SERVICES.filter((s) => activeKey.services.includes(s.key));
  }, [activeKey]);

  // If selected service isn't allowed on key, switch
  useEffect(() => {
    if (activeKey && !activeKey.services.includes(serviceKey) && allowedServices[0]) {
      setServiceKey(allowedServices[0].key);
      setInput(allowedServices[0].example);
    }
  }, [activeKey, serviceKey, allowedServices]);

  const onServiceChange = (k: string) => {
    setServiceKey(k);
    setInput(SERVICE_MAP[k]?.example ?? "");
    setResult(null);
  };

  async function run() {
    if (!activeKey || !svc || !input.trim()) return;
    setRunning(true); setResult(null);
    const t0 = performance.now();
    try {
      const r = await fetch(`/api/v1/${svc.key}?${svc.param}=${encodeURIComponent(input.trim())}`, {
        headers: { "X-Api-Key": activeKey.api_key },
      });
      const txt = await r.text();
      let pretty = txt;
      try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch { /* keep raw */ }
      setResult({ status: r.status, body: pretty, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setResult({ status: 0, body: String((e as Error).message ?? e), ms: Math.round(performance.now() - t0) });
    } finally {
      setRunning(false);
    }
  }

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.body);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-indigo-600" /> Service Tester
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Test any service in one click</h1>
        <p className="text-slate-600 mt-2">
          Pick an API key, choose a service, hit Run. Response, status code and latency show up below.
        </p>

        {isLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-indigo-600" />
          </div>
        ) : keys.length === 0 ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-slate-600">No API keys yet — create one first.</p>
            <Link to="/dashboard" className="inline-block mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {/* Controls */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">API Key</label>
                  <select
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  >
                    {keys.map((k) => (
                      <option key={k.id} value={k.id} disabled={!k.is_active}>
                        {k.name} {!k.is_active ? "(disabled)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Service</label>
                  <select
                    value={serviceKey}
                    onChange={(e) => onServiceChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  >
                    {allowedServices.map((s) => (
                      <option key={s.key} value={s.key}>{s.label} (/{s.key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    {svc?.param ?? "input"} <span className="text-slate-400 font-normal normal-case">— {svc?.paramDesc}</span>
                  </label>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={svc?.example}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-slate-500">
                  Endpoint: <code className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">GET /api/v1/{serviceKey}</code>
                </div>
                <button
                  onClick={run}
                  disabled={running || !activeKey || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {running ? "Running…" : "Run lookup"}
                </button>
              </div>
            </div>

            {/* Response */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">Response</div>
                {result && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-mono font-semibold ${
                      result.status >= 200 && result.status < 300
                        ? "bg-emerald-100 text-emerald-700"
                        : result.status === 0
                        ? "bg-slate-100 text-slate-700"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {result.status || "ERR"}
                    </span>
                    <span className="text-slate-500 font-mono">{result.ms}ms</span>
                    <button onClick={copyResult} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Copy">
                      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                )}
              </div>
              <pre className="bg-slate-950 text-emerald-300 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all min-h-[200px] max-h-[60vh]">
                {result?.body ?? "// Response will appear here after you hit Run"}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
