import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SERVICES, SERVICE_MAP } from "@/lib/services";
import { Play, Loader2, Copy, Check, KeyRound, ArrowLeft, Zap } from "lucide-react";

export const Route = createFileRoute("/test")({
  component: PublicTester,
  head: () => ({
    meta: [
      { title: "Public API Tester" },
      { name: "description", content: "Paste your API key, pick a service, run a live test." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PublicTester() {
  const [apiKey, setApiKey] = useState("");
  const [serviceKey, setServiceKey] = useState<string>(SERVICES[0]?.key ?? "");
  const [input, setInput] = useState<string>(SERVICES[0]?.example ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string; ms: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const svc = SERVICE_MAP[serviceKey];

  const onServiceChange = (k: string) => {
    setServiceKey(k);
    setInput(SERVICE_MAP[k]?.example ?? "");
    setResult(null);
  };

  async function run() {
    if (!apiKey.trim() || !svc || !input.trim()) return;
    setRunning(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const r = await fetch(
        `/api/v1/${svc.key}?${svc.param}=${encodeURIComponent(input.trim())}`,
        { headers: { "X-Api-Key": apiKey.trim() } }
      );
      const txt = await r.text();
      let pretty = txt;
      try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch { /* keep raw */ }
      setResult({ status: r.status, body: pretty, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setResult({
        status: 0,
        body: `Network error: ${String((e as Error).message ?? e)}`,
        ms: Math.round(performance.now() - t0),
      });
    } finally {
      setRunning(false);
    }
  }

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-primary" /> Public API Tester
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold">Test any service in one click</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your API key, choose a service, hit Run. No login required.
        </p>

        <div className="mt-6 rounded-xl border bg-background p-5 panel">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            <KeyRound className="size-3.5 inline mr-1" /> Your API key
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="paste-your-api-key-here"
            className="w-full rounded-md border bg-input px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Service
              </label>
              <select
                value={serviceKey}
                onChange={(e) => onServiceChange(e.target.value)}
                className="w-full rounded-md border bg-input px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SERVICES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label} (/{s.key})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {svc?.param ?? "input"}
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={svc?.example}
                className="w-full rounded-md border bg-input px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-muted-foreground">
              Endpoint: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">GET /api/v1/{serviceKey}</code>
            </div>
            <button
              onClick={run}
              disabled={running || !apiKey.trim() || !input.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border bg-background p-5 panel">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Response</div>
            {result && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-mono font-semibold ${
                  result.status >= 200 && result.status < 300
                    ? "bg-success/15 text-success"
                    : result.status === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-destructive/15 text-destructive"
                }`}>
                  {result.status || "ERR"}
                </span>
                <span className="text-muted-foreground font-mono">{result.ms}ms</span>
                <button onClick={copyResult} className="p-1.5 rounded hover:bg-muted" title="Copy">
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            )}
          </div>
          <pre className="bg-muted/40 border rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all min-h-[180px] max-h-[60vh]">
{result?.body ?? "// Response will appear here after you hit Run"}
          </pre>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Educational use only. By using this tester you accept the{" "}
          <Link to="/login" className="text-primary hover:underline">Terms</Link>.
        </p>
      </main>
    </div>
  );
}
