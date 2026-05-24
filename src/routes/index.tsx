import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tester } from "@/components/Tester";
import { SERVICES, CATEGORIES, SERVICE_MAP } from "@/lib/services";
import { Shield, Zap, Lock, Database, LogIn, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "OSINT API Panel" },
      { name: "description", content: "Live API tester with full documentation. Bring your key, try any endpoint in one click." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const [authedKey, setAuthedKey] = useState("");

  // If user already logged in, auto-fill their first key.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("api_keys")
        .select("api_key")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.api_key) setAuthedKey(data.api_key);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold text-slate-900">
            <span className="size-2 rounded-full bg-indigo-600" />
            <span>OSINT_PANEL</span>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogIn className="size-3.5" /> Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-10 space-y-12">
        {/* HERO */}
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Test any OSINT endpoint <span className="text-indigo-600">in one click</span>
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Bring your API key, pick a service, get JSON back. Full documentation below.
          </p>
        </section>

        {/* TESTER */}
        <section>
          <Tester initialKey={authedKey} />
          {!authedKey && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Don't have a key? Ask the administrator.
              {" "}
              <button onClick={() => navigate({ to: "/login" })} className="text-indigo-600 underline hover:text-indigo-700">
                Sign in
              </button>{" "}
              to auto-fill yours.
            </p>
          )}
        </section>

        {/* FEATURES */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, title: "Secure", desc: "Upstream key sanitized, RLS-locked." },
            { icon: Zap, title: "Fast", desc: "Parallel queries, fire-and-forget logging." },
            { icon: Lock, title: "Rate-limited", desc: "Per-IP + per-key abuse blocking." },
            { icon: Database, title: `${SERVICES.length} services`, desc: "Phone, Aadhaar, UPI, vehicle, social…" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
              <Icon className="size-4 text-indigo-600 mb-2" />
              <div className="font-semibold text-sm text-slate-900">{title}</div>
              <div className="text-xs text-slate-600 mt-0.5">{desc}</div>
            </div>
          ))}
        </section>

        {/* DOCS */}
        <Docs />

        <footer className="text-center text-xs text-slate-500 pt-8 border-t border-slate-200">
          OSINT_PANEL · Powered by Krishna · t.me/moneycomming
        </footer>
      </main>
    </div>
  );
}

function Docs() {
  return (
    <section id="docs" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Documentation</h2>
        <p className="text-sm text-slate-600 mt-1">
          Every endpoint, parameter, and sample response. Click any service to expand.
        </p>
      </div>

      {/* Quick-start */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Quick start</h3>
        <ol className="mt-3 text-sm text-slate-700 space-y-2 list-decimal pl-5">
          <li>Pass your key as <code className="px-1 py-0.5 rounded bg-slate-100 font-mono">?key=YOUR_KEY</code> or in the <code className="px-1 py-0.5 rounded bg-slate-100 font-mono">X-Api-Key</code> header.</li>
          <li>Every successful (HTTP 200) call deducts <strong>1 credit</strong>.</li>
          <li>Rate limits: <strong>180/min per IP</strong>, <strong>300/min per key</strong>. Abuse → auto 5-minute block.</li>
          <li>Sensitive identifiers (upstream key, source URLs) are stripped from every response.</li>
        </ol>
        <pre className="mt-3 rounded-lg bg-slate-900 text-emerald-300 text-xs p-3 overflow-x-auto font-mono">
{`curl -H "X-Api-Key: YOUR_KEY" \\
  "https://krish-osintoy.lovable.app/api/v1/number?num=7307841587"`}
        </pre>
      </div>

      {/* Error codes */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Error codes</h3>
        <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
          {[
            ["200", "Success — 1 credit used"],
            ["400", "Missing / invalid parameter"],
            ["401", "Missing or invalid API key"],
            ["402", "No credits remaining"],
            ["403", "Disabled, expired, suspended, or service not enabled"],
            ["429", "Rate limit exceeded or abuse detected"],
            ["502", "Upstream error"],
            ["504", "Upstream timeout"],
          ].map(([c, m]) => (
            <div key={c} className="flex gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
              <span className="font-mono font-semibold text-indigo-600 w-8">{c}</span>
              <span className="text-slate-700">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints by category */}
      {CATEGORIES.map((cat) => {
        const list = SERVICES.filter((s) => s.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-1">{cat}</h3>
            {list.map((s) => (
              <EndpointCard key={s.key} svcKey={s.key} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function EndpointCard({ svcKey }: { svcKey: string }) {
  const s = SERVICE_MAP[svcKey];
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">GET</span>
          <code className="text-sm font-mono text-slate-900 truncate">/api/v1/{s.key}</code>
          <span className="text-xs text-slate-500 hidden sm:inline truncate">— {s.label}</span>
        </div>
        {open ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-700">{s.description}</p>
          <div className="text-xs">
            <span className="font-semibold text-slate-600">Parameter: </span>
            <code className="font-mono text-indigo-600">{s.param}</code>
            <span className="text-slate-500"> — {s.paramDesc}</span>
          </div>
          {s.notes && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              ⓘ {s.notes}
            </div>
          )}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Example request</div>
            <pre className="rounded bg-slate-900 text-emerald-300 text-xs p-2.5 overflow-x-auto font-mono">
{`curl -H "X-Api-Key: YOUR_KEY" "https://krish-osintoy.lovable.app/api/v1/${s.key}?${s.param}=${encodeURIComponent(s.example)}"`}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Sample response</div>
            <pre className="rounded bg-slate-50 border border-slate-200 text-slate-800 text-xs p-2.5 overflow-x-auto font-mono max-h-64">
{JSON.stringify(s.sampleResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
