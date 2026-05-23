import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo, useRef } from "react";
import { getKeyBySlug } from "@/lib/api-keys.functions";
import { SERVICE_MAP, CATEGORIES, type ServiceDef } from "@/lib/services";
import {
  Copy, Check, Loader2, Activity, Clock, Database, Shield, Eye, EyeOff,
  Play, Code2, Terminal, Globe, AlertTriangle, KeyRound, Send, Download,
} from "lucide-react";
import { buildDocPdf } from "@/lib/pdf-doc";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPanel,
  head: () => ({ meta: [{ title: "API Documentation" }, { name: "robots", content: "noindex" }] }),
});

type KeyRow = {
  id: string; name: string; api_key: string; public_slug: string;
  services: string[]; credits_total: number | null; credits_used: number;
  expires_at: string | null; is_active: boolean; created_at: string;
};

function PublicPanel() {
  const { slug } = Route.useParams();
  const fetcher = useServerFn(getKeyBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["pub", slug],
    queryFn: () => fetcher({ data: { slug } }),
    refetchInterval: 20000,
  });

  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data?.key) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="panel border rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold">Panel not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This dashboard link is invalid or has been revoked.
          </p>
        </div>
      </div>
    );
  }
  return <Panel k={data.key as KeyRow} origin={origin} />;
}

function Panel({ k, origin }: { k: KeyRow; origin: string }) {
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const active = k.is_active && !expired;
  const creditsLeft = k.credits_total === null ? null : Math.max(0, k.credits_total - k.credits_used);
  const daysLeft = k.expires_at
    ? Math.max(0, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const grouped = useMemo(() => {
    const m: Record<string, ServiceDef[]> = {};
    for (const s of k.services) {
      const d = SERVICE_MAP[s]; if (!d) continue;
      (m[d.category] ||= []).push(d);
    }
    return m;
  }, [k.services]);

  const orderedCats = CATEGORIES.filter((c) => grouped[c]?.length);
  const base = origin || "https://your-domain";

  return (
    <div className="min-h-screen grid-bg overflow-x-hidden w-full">
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-20 bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold text-sm">
            <span className="size-2 rounded-full bg-primary glow" />
            <span>API_DOCS</span>
            <span className="text-muted-foreground font-normal hidden sm:inline">· {k.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const pdf = buildDocPdf({
                  customerName: k.name, apiKey: k.api_key, baseUrl: base,
                  services: k.services, creditsTotal: k.credits_total,
                  creditsUsed: k.credits_used, expiresAt: k.expires_at,
                });
                pdf.save(`${k.name.replace(/[^a-z0-9]+/gi, "_")}_api_docs.pdf`);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 glow"
              title="Download full documentation as PDF"
            >
              <Download className="size-3.5" /> PDF
            </button>
            <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${
              active ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
            }`}>{expired ? "EXPIRED" : k.is_active ? "● ACTIVE" : "DISABLED"}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 grid lg:grid-cols-[220px_1fr] gap-6 py-6">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <NavSection title="Overview" items={[
              ["overview", "Introduction"],
              ["auth", "Authentication"],
              ["limits", "Rate Limits & Security"],
              ["errors", "Error Codes"],
              ["html", "HTML Tester"],
              ["telegram", "Telegram Bot"],
            ]} />
            {orderedCats.map((cat) => (
              <NavSection
                key={cat} title={cat}
                items={grouped[cat].map((s) => [`ep-${s.key}`, s.label])}
              />
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 space-y-10 pb-20">
          {/* Hero / stats */}
          <section id="overview">
            <div className="text-xs font-mono text-muted-foreground">USER</div>
            <h1 className="text-3xl font-bold mt-1">{k.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Private API documentation. Use the key below in every request.
              All endpoints return JSON. Test any endpoint directly in this page.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              <StatCard icon={Database} label="Credits remaining"
                value={creditsLeft === null ? "Unlimited" : `${creditsLeft}`}
                sub={k.credits_total === null ? "no limit" : `of ${k.credits_total} · used ${k.credits_used}`}
                highlight={creditsLeft !== null && creditsLeft <= 10} />
              <StatCard icon={Clock} label="Days remaining"
                value={daysLeft === null ? "Unlimited" : `${daysLeft}`}
                sub={k.expires_at ? `expires ${new Date(k.expires_at).toLocaleDateString()}` : "no expiry"}
                highlight={daysLeft !== null && daysLeft <= 3} />
              <StatCard icon={Activity} label="Endpoints enabled"
                value={`${k.services.length}`} sub="services accessible" />
            </div>
          </section>

          {/* Auth */}
          <section id="auth" className="panel border rounded-xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <KeyRound className="size-4 text-primary" /> Authentication
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your API key is private — do not share it, do not commit it to public repos,
              and do not embed it in client-side JavaScript on a public website.
              Anyone with this key can use your credits.
            </p>
            <ApiKeyDisplay apiKey={k.api_key} />
            <p className="text-xs text-muted-foreground mt-4">
              Pass the key as <code className="font-mono bg-muted px-1.5 py-0.5 rounded">?key=YOUR_KEY</code> in
              the query string, or as an <code className="font-mono bg-muted px-1.5 py-0.5 rounded">X-Api-Key</code> header.
            </p>
          </section>

          {/* Limits */}
          <section id="limits" className="panel border rounded-xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Shield className="size-4 text-primary" /> Rate Limits & Security
            </h2>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
              <li><span className="text-foreground font-mono">60 req/min</span> per IP address.</li>
              <li><span className="text-foreground font-mono">120 req/min</span> per API key.</li>
              <li>
                Exceeding <span className="text-foreground font-mono">120 req/min</span> from one IP
                triggers an automatic <span className="text-destructive">5-minute IP block</span>,
                then it auto-recovers — no manual action needed.
              </li>
              <li>
                Exceeding <span className="text-foreground font-mono">300 req/min</span> on a single key
                triggers a <span className="text-destructive">5-minute key block</span>,
                then it auto-resumes.
              </li>
              <li>Credits are deducted only on successful (HTTP 200) responses.</li>
              <li>Sensitive upstream identifiers are stripped from every response automatically.</li>
            </ul>
            <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs font-mono">
              {[
                ["X-RateLimit-Limit", "per-key per minute"],
                ["X-RateLimit-Remaining", "calls left this minute"],
                ["X-Credits-Remaining", "credits left on key"],
              ].map(([h, d]) => (
                <div key={h} className="px-3 py-2 bg-muted/40 border border-border/30 rounded-md">
                  <div className="text-primary">{h}</div>
                  <div className="text-muted-foreground mt-0.5">{d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="panel border rounded-xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-primary" /> Error Codes
            </h2>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-mono">
              {[
                ["200", "Success — 1 credit used"],
                ["400", "Missing / invalid parameter"],
                ["401", "Missing or invalid API key"],
                ["402", "No credits remaining"],
                ["403", "Disabled, expired, IP blocked, or service not enabled"],
                ["429", "Rate limit exceeded or abuse detected"],
                ["502", "Upstream error"],
                ["504", "Upstream timeout (retry in a moment)"],
              ].map(([c, m]) => (
                <div key={c} className="flex gap-3 px-3 py-2 bg-muted/40 border border-border/30 rounded-md">
                  <span className="text-primary w-8">{c}</span>
                  <span className="text-muted-foreground">{m}</span>
                </div>
              ))}
            </div>
            <CodeBlock label="Error response" className="mt-4">
{`{
  "success": false,
  "error": "Rate limit exceeded. Slow down."
}`}
            </CodeBlock>
          </section>

          {/* HTML tester */}
          <section id="html" className="panel border rounded-xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Code2 className="size-4 text-primary" /> Ready-to-use HTML tester
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Save this as <code className="font-mono bg-muted px-1.5 py-0.5 rounded">test.html</code> and
              open in any browser. <span className="text-warning">Your API key is already filled in</span> —
              keep this file private (do not host on a public website).
            </p>
            <CodeBlock label="test.html" lang="html">
              {buildTesterHtml(base, k.api_key, k.services)}
            </CodeBlock>
          </section>

          {/* Telegram bot docs */}
          <section id="telegram" className="panel border rounded-xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Send className="size-4 text-primary" /> Build your own Telegram bot
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Want a Telegram bot that lets your users query these APIs by sending a command?
              Here is a complete, copy-paste starter. Replace <code className="font-mono">BOT_TOKEN</code> with
              the token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a>.
            </p>

            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5 mb-4">
              <li>Open Telegram → message <span className="font-mono">@BotFather</span> → <span className="font-mono">/newbot</span> → copy the token.</li>
              <li>Install Python 3 and <span className="font-mono">pip install requests</span>.</li>
              <li>Save the code below as <span className="font-mono">bot.py</span> and run <span className="font-mono">python bot.py</span>.</li>
              <li>In Telegram, send <span className="font-mono">/number 9876543210</span> to your bot.</li>
            </ol>

            <CodeBlock label="bot.py" lang="python">
              {buildTelegramBotPy(base, k.api_key, k.services)}
            </CodeBlock>

            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <div><span className="text-primary font-mono">Commands supported:</span> {k.services.map(s => `/${s}`).join(", ")}</div>
              <div className="text-warning">Security: never put your API key in a public GitHub repo. Run the bot on your own machine or VPS.</div>
            </div>
          </section>

          {/* Endpoints grouped by category */}
          {orderedCats.map((cat) => (
            <section key={cat} className="space-y-4">
              <h2 className="text-xl font-bold border-b border-border/40 pb-2">{cat}</h2>
              {grouped[cat].map((def) => (
                <EndpointDoc key={def.key} def={def} base={base} apiKey={k.api_key} />
              ))}
            </section>
          ))}

          <footer className="text-center text-xs text-muted-foreground font-mono pt-10">
            Powered by Krishna · t.me/moneycomming
          </footer>
        </main>
      </div>
    </div>
  );
}

function NavSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider mb-2 px-2">
        {title}
      </div>
      <nav className="space-y-0.5">
        {items.map(([id, label]) => (
          <a key={id} href={`#${id}`}
            className="block text-xs px-2 py-1.5 rounded hover:bg-accent/20 hover:text-primary text-muted-foreground transition-colors">
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <div className={`panel border rounded-xl p-5 ${highlight ? "border-warning/50" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-bold font-mono ${highlight ? "text-warning" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = apiKey.slice(0, 8) + "•".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4);
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-background/80 border border-border/50 font-mono text-sm">
      <KeyRound className="size-4 text-primary shrink-0" />
      <span className="flex-1 break-all">{show ? apiKey : masked}</span>
      <button onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"}
        className="p-1.5 rounded hover:bg-accent/20 text-muted-foreground">
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        onClick={() => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="p-1.5 rounded hover:bg-accent/20 text-muted-foreground" title="Copy">
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function EndpointDoc({ def, base, apiKey }: { def: ServiceDef; base: string; apiKey: string }) {
  const [tab, setTab] = useState<"curl" | "js" | "url">("curl");
  const [input, setInput] = useState(def.example);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: number; body: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const path = `/api/v1/${def.key}`;
  const url = `${base}${path}?key=${apiKey}&${def.param}=${encodeURIComponent(def.example)}`;
  const curl = `curl -H "X-Api-Key: ${apiKey}" "${base}${path}?${def.param}=${encodeURIComponent(def.example)}"`;
  const js =
`const r = await fetch("${base}${path}?${def.param}=${encodeURIComponent(def.example)}", {
  headers: { "X-Api-Key": "${apiKey}" }
});
const data = await r.json();
console.log(data);`;

  async function run() {
    abortRef.current?.abort();
    const ac = new AbortController(); abortRef.current = ac;
    setRunning(true); setResult(null);
    try {
      const r = await fetch(`${path}?${def.param}=${encodeURIComponent(input)}`, {
        headers: { "X-Api-Key": apiKey }, signal: ac.signal,
      });
      const txt = await r.text();
      let pretty = txt;
      try { pretty = JSON.stringify(JSON.parse(txt), null, 2); } catch { /* keep raw */ }
      setResult({ status: r.status, body: pretty });
    } catch (e) {
      setResult({ status: 0, body: String((e as Error).message ?? e) });
    } finally { setRunning(false); }
  }

  return (
    <div id={`ep-${def.key}`} className="panel border rounded-xl overflow-hidden scroll-mt-20">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded">GET</span>
          <span className="font-mono text-sm truncate">{path}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">{def.label}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          param: <span className="text-primary">{def.param}</span>
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-muted-foreground">{def.description}</p>
        {def.notes && (
          <div className="text-xs px-3 py-2 rounded border border-warning/30 bg-warning/5 text-warning">
            Note: {def.notes}
          </div>
        )}

        {/* Params table */}
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Parameters</div>
          <div className="border border-border/40 rounded overflow-x-auto text-xs">
            <table className="w-full font-mono">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><th className="text-left p-2 w-24">Param</th><th className="text-left p-2 w-20">Required</th><th className="text-left p-2">Description</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-border/30"><td className="p-2 text-primary">key</td><td className="p-2">yes</td><td className="p-2 text-muted-foreground">Your API key</td></tr>
                <tr className="border-t border-border/30"><td className="p-2 text-primary">{def.param}</td><td className="p-2">yes</td><td className="p-2 text-muted-foreground">{def.paramDesc}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Code snippets */}
        <div>
          <div className="flex gap-1 mb-2">
            {([
              ["curl", "cURL", Terminal],
              ["js", "JavaScript", Code2],
              ["url", "URL", Globe],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`text-xs px-3 py-1.5 rounded-md font-mono flex items-center gap-1.5 ${
                  tab === id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent/20"
                }`}>
                <Icon className="size-3" /> {label}
              </button>
            ))}
          </div>
          <CodeBlock>{tab === "curl" ? curl : tab === "js" ? js : url}</CodeBlock>
        </div>

        {/* Try it */}
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play className="size-4 text-primary" />
            <span className="text-sm font-semibold">Try it live</span>
            <span className="text-[10px] text-muted-foreground font-mono">uses your real key · costs 1 credit on success</span>
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={def.paramDesc}
              className="flex-1 px-3 py-2 rounded bg-background/80 border border-border/50 text-sm font-mono focus:outline-none focus:border-primary"
            />
            <button onClick={run} disabled={running || !input.trim()}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5" />}
              Run
            </button>
          </div>
          {result && (
            <div className="mt-3">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded ${result.status >= 200 && result.status < 300 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                  {result.status || "ERR"}
                </span>
                response
              </div>
              <pre className="bg-background/80 border border-border/50 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                {result.body}
              </pre>
            </div>
          )}
        </div>

        {/* Sample response */}
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Sample response</div>
          <CodeBlock>{JSON.stringify(def.sampleResponse, null, 2)}</CodeBlock>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({
  children, label, lang, className = "",
}: { children: string; label?: string; lang?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`relative group ${className}`}>
      {(label || lang) && (
        <div className="absolute top-2 left-3 text-[10px] font-mono text-muted-foreground">
          {label}{lang ? ` · ${lang}` : ""}
        </div>
      )}
      <button onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-accent/20 opacity-60 group-hover:opacity-100">
        {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      </button>
      <pre className={`bg-background/80 border border-border/50 rounded-md p-3 ${label || lang ? "pt-6" : ""} text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[500px]`}>
        {children}
      </pre>
    </div>
  );
}

// Build a self-contained, beautiful HTML tester page with the user's API key pre-filled.
function buildTesterHtml(base: string, apiKey: string, services: string[]): string {
  const enabled = services
    .map((k) => SERVICE_MAP[k])
    .filter(Boolean)
    .map((s) => ({ key: s.key, param: s.param, label: s.label, example: s.example }));
  const dataJs = JSON.stringify(enabled);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>API Tester</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0f; color: #e6e6e6; min-height: 100vh; padding: 24px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #888; font-size: 13px; margin-bottom: 24px; }
    .card { background: #14141c; border: 1px solid #26263a; border-radius: 12px; padding: 20px; }
    label { display: block; font-size: 11px; color: #888; text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 6px; font-weight: 600; }
    select, input { width: 100%; padding: 10px 12px; border-radius: 8px;
      background: #0a0a0f; border: 1px solid #2a2a3e; color: #fff;
      font-size: 14px; font-family: ui-monospace, monospace; }
    select:focus, input:focus { outline: none; border-color: #6366f1; }
    .row { display: grid; gap: 12px; margin-bottom: 12px; }
    @media (min-width: 520px) { .row { grid-template-columns: 1fr 1fr; } }
    button { width: 100%; padding: 12px; border-radius: 8px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-weight: 600;
      font-size: 14px; margin-top: 12px; }
    button:hover { opacity: 0.9; } button:disabled { opacity: 0.5; cursor: wait; }
    pre { background: #06060b; border: 1px solid #26263a; border-radius: 8px; padding: 14px;
      font-size: 12px; line-height: 1.5; color: #98f5b4; overflow: auto; max-height: 480px;
      white-space: pre-wrap; word-break: break-all; margin-top: 16px; }
    .meta { display: flex; gap: 8px; margin-top: 12px; font-size: 11px; color: #888; flex-wrap: wrap; }
    .badge { background: #1e1e2e; padding: 4px 8px; border-radius: 4px; font-family: ui-monospace, monospace; }
    .ok { color: #4ade80; } .err { color: #f87171; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>OSINT API Tester</h1>
    <p class="sub">Your private testing page. API key is embedded — keep this file safe.</p>
    <div class="card">
      <div class="row">
        <div>
          <label>Service</label>
          <select id="svc"></select>
        </div>
        <div>
          <label id="paramLabel">Input</label>
          <input id="val" placeholder="" />
        </div>
      </div>
      <button id="go" onclick="run()">Run lookup</button>
      <div class="meta">
        <span class="badge" id="statusBadge">ready</span>
        <span class="badge" id="timeBadge">—</span>
        <span class="badge" id="creditsBadge">credits: —</span>
      </div>
      <pre id="out">// Response will appear here</pre>
    </div>
  </div>
  <script>
    const API_KEY = ${JSON.stringify(apiKey)};
    const BASE = ${JSON.stringify(base)};
    const SERVICES = ${dataJs};
    const sel = document.getElementById("svc");
    const val = document.getElementById("val");
    const lbl = document.getElementById("paramLabel");
    SERVICES.forEach(s => {
      const o = document.createElement("option");
      o.value = s.key; o.textContent = s.label + "  (/" + s.key + ")";
      o.dataset.param = s.param; o.dataset.example = s.example;
      sel.appendChild(o);
    });
    function syncParam() {
      const o = sel.options[sel.selectedIndex];
      lbl.textContent = o.dataset.param;
      val.placeholder = "e.g. " + o.dataset.example;
      val.value = o.dataset.example;
    }
    sel.addEventListener("change", syncParam); syncParam();
    async function run() {
      const svc = sel.value;
      const param = sel.options[sel.selectedIndex].dataset.param;
      const v = val.value.trim();
      if (!v) return;
      const out = document.getElementById("out");
      const sb = document.getElementById("statusBadge");
      const tb = document.getElementById("timeBadge");
      const cb = document.getElementById("creditsBadge");
      const btn = document.getElementById("go");
      btn.disabled = true; sb.textContent = "loading…"; sb.className = "badge";
      out.textContent = "// loading…";
      const t0 = performance.now();
      try {
        const r = await fetch(BASE + "/api/v1/" + svc + "?" + param + "=" + encodeURIComponent(v),
          { headers: { "X-Api-Key": API_KEY } });
        const txt = await r.text();
        let body = txt; try { body = JSON.stringify(JSON.parse(txt), null, 2); } catch(e){}
        out.textContent = body;
        sb.textContent = r.status; sb.className = "badge " + (r.ok ? "ok" : "err");
        cb.textContent = "credits: " + (r.headers.get("X-Credits-Remaining") || "—");
      } catch (e) {
        out.textContent = "// network error: " + e.message;
        sb.textContent = "ERR"; sb.className = "badge err";
      } finally {
        tb.textContent = Math.round(performance.now() - t0) + "ms";
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

// Build a starter Telegram bot in Python using long-polling getUpdates.
function buildTelegramBotPy(base: string, apiKey: string, services: string[]): string {
  const enabled = services
    .map((k) => SERVICE_MAP[k])
    .filter(Boolean)
    .map((s) => ({ key: s.key, param: s.param, label: s.label, example: s.example }));
  return `# pip install requests
import requests, time, json, urllib.parse

BOT_TOKEN = "PASTE_YOUR_BOTFATHER_TOKEN_HERE"
API_BASE  = ${JSON.stringify(base)}
API_KEY   = ${JSON.stringify(apiKey)}  # keep this private

# Commands → (path, query param, friendly label, example)
SERVICES = ${JSON.stringify(enabled, null, 2)}
CMD_MAP = { s["key"]: s for s in SERVICES }

TG = f"https://api.telegram.org/bot{BOT_TOKEN}"

def send(chat_id, text):
    requests.post(f"{TG}/sendMessage", json={
        "chat_id": chat_id, "text": text[:4000],
        "parse_mode": "Markdown", "disable_web_page_preview": True
    })

def help_text():
    lines = ["*Available commands:*"]
    for s in SERVICES:
        lines.append(f"\`/{s['key']} {s['example']}\`  — {s['label']}")
    return "\\n".join(lines)

def handle(msg):
    chat_id = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    if not text.startswith("/"):
        return send(chat_id, "Send /help to see commands.")
    parts = text[1:].split(maxsplit=1)
    cmd = parts[0].split("@")[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ""
    if cmd in ("start", "help"):
        return send(chat_id, help_text())
    svc = CMD_MAP.get(cmd)
    if not svc:
        return send(chat_id, f"Unknown command /{cmd}. Try /help.")
    if not arg:
        return send(chat_id, f"Usage: /{cmd} {svc['example']}")
    url = f"{API_BASE}/api/v1/{svc['key']}?{svc['param']}={urllib.parse.quote(arg)}"
    try:
        r = requests.get(url, headers={"X-Api-Key": API_KEY}, timeout=30)
        data = r.json()
        send(chat_id, f"\`\`\`json\\n{json.dumps(data, indent=2)[:3500]}\\n\`\`\`")
    except Exception as e:
        send(chat_id, f"Error: {e}")

def main():
    print("Bot started. Press Ctrl+C to stop.")
    offset = 0
    # Make sure no webhook is set, otherwise getUpdates returns nothing
    requests.get(f"{TG}/deleteWebhook")
    while True:
        try:
            r = requests.get(f"{TG}/getUpdates",
                params={"offset": offset, "timeout": 25}, timeout=30)
            for upd in r.json().get("result", []):
                offset = upd["update_id"] + 1
                msg = upd.get("message") or upd.get("edited_message")
                if msg: handle(msg)
        except Exception as e:
            print("loop error:", e); time.sleep(3)

if __name__ == "__main__":
    main()
`;
}

