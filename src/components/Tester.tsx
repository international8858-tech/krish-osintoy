import { useState, useEffect, useRef } from "react";
import { SERVICES, SERVICE_MAP } from "@/lib/services";
import { Loader2, Play, Copy, Check, KeyRound, Zap, Clock } from "lucide-react";
import { toast } from "sonner";

type Result = { status: number; body: string; ms: number };

/**
 * Unified tester used on homepage and dashboard.
 * Plain white interface, no flashy gradients — easy to read.
 */
export function Tester({
  initialKey = "",
  lockKey = false,
}: {
  initialKey?: string;
  lockKey?: boolean;
}) {
  const [apiKey, setApiKey] = useState(initialKey);
  const [serviceKey, setServiceKey] = useState<string>(SERVICES[0].key);
  const svc = SERVICE_MAP[serviceKey];
  const [value, setValue] = useState(svc.example);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setApiKey(initialKey); }, [initialKey]);
  useEffect(() => { setValue(svc.example); setResult(null); }, [serviceKey, svc.example]);

  async function run() {
    if (!apiKey.trim()) {
      toast.error("Enter your API key first");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const r = await fetch(
        `/api/v1/${serviceKey}?${svc.param}=${encodeURIComponent(value.trim())}`,
        {
          headers: { "X-Api-Key": apiKey.trim() },
          signal: ac.signal,
        },
      );
      const txt = await r.text();
      let pretty = txt;
      try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch { /* keep raw */ }
      setResult({ status: r.status, body: pretty, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setResult({ status: 0, body: String((e as Error).message ?? e), ms: Math.round(performance.now() - t0) });
    } finally {
      setBusy(false);
    }
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const statusColor =
    !result ? "bg-slate-200 text-slate-700"
    : result.status >= 200 && result.status < 300 ? "bg-emerald-100 text-emerald-800"
    : result.status === 429 ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-800";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <Zap className="size-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-slate-800">Live API Tester</h2>
        <span className="ml-auto text-xs text-slate-500">{SERVICES.length} endpoints</span>
      </div>

      {/* Form */}
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <KeyRound className="size-3.5" /> API KEY
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            readOnly={lockKey}
            placeholder="paste your key here…"
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
          />
        </div>

        <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">SERVICE</label>
            <select
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {SERVICES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} · /{s.key}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">
              {svc.param.toUpperCase()} <span className="text-slate-400 font-normal">— {svc.paramDesc}</span>
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={svc.example}
                onKeyDown={(e) => e.key === "Enter" && run()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={run}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Test
              </button>
            </div>
          </div>
        </div>

        {svc.notes && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⓘ {svc.notes}
          </div>
        )}
      </div>

      {/* Result */}
      <div className="border-t border-slate-200 bg-slate-50">
        <div className="px-5 py-2.5 flex items-center gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-mono font-semibold ${statusColor}`}>
            {result ? `HTTP ${result.status || "ERR"}` : "READY"}
          </span>
          {result && (
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="size-3" /> {result.ms}ms
            </span>
          )}
          <button
            onClick={copyResult}
            disabled={!result}
            className="ml-auto text-slate-600 hover:text-slate-900 flex items-center gap-1 disabled:opacity-40"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="px-5 pb-5 text-xs font-mono text-slate-800 overflow-x-auto max-h-[420px]">
{result?.body ?? `// Press "Test" to run the request.\n// Response will appear here as formatted JSON.`}
        </pre>
      </div>
    </div>
  );
}
