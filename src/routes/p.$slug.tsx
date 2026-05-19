import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getKeyBySlug } from "@/lib/api-keys.functions";
import { SERVICE_MAP } from "@/lib/services";
import { Copy, Check, Loader2, Activity, Clock, Database, Shield } from "lucide-react";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPanel,
  head: () => ({ meta: [{ title: "API Panel" }, { name: "robots", content: "noindex" }] }),
});

function PublicPanel() {
  const { slug } = Route.useParams();
  const fetcher = useServerFn(getKeyBySlug);
  const { data, isLoading } = useQuery({
    queryKey: ["pub", slug],
    queryFn: () => fetcher({ data: { slug } }),
    refetchInterval: 15000,
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

  const k = data.key;
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const active = k.is_active && !expired;
  const creditsLeft = k.credits_total === null ? null : Math.max(0, k.credits_total - k.credits_used);
  const daysLeft = k.expires_at
    ? Math.max(0, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="min-h-screen grid-bg">
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10 bg-background/70">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="size-2 rounded-full bg-primary glow" />
            <span>OSINT_PANEL</span>
          </div>
          <span className={`text-[11px] font-mono px-2 py-1 rounded-full ${
            active ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
          }`}>
            {expired ? "EXPIRED" : k.is_active ? "● ACTIVE" : "DISABLED"}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Identity */}
        <div className="mb-8">
          <div className="text-xs font-mono text-muted-foreground">USER</div>
          <h1 className="text-3xl font-bold mt-1">{k.name}</h1>
          <p className="text-xs font-mono text-muted-foreground mt-2 break-all">
            id: {k.public_slug}
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <StatCard
            icon={Database}
            label="Credits remaining"
            value={creditsLeft === null ? "Unlimited" : `${creditsLeft}`}
            sub={k.credits_total === null ? "no limit" : `of ${k.credits_total} · used ${k.credits_used}`}
            highlight={creditsLeft !== null && creditsLeft <= 10}
          />
          <StatCard
            icon={Clock}
            label="Days remaining"
            value={daysLeft === null ? "Unlimited" : `${daysLeft}`}
            sub={k.expires_at ? `expires ${new Date(k.expires_at).toLocaleDateString()}` : "no expiry"}
            highlight={daysLeft !== null && daysLeft <= 3}
          />
          <StatCard
            icon={Activity}
            label="Services enabled"
            value={`${k.services.length}`}
            sub="endpoints accessible"
          />
        </div>

        {/* Quick how-to */}
        <section className="panel border rounded-xl p-6 mb-8">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Shield className="size-4 text-primary" /> Authentication
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Use your API key in every request. Pass it as a query parameter <code className="font-mono bg-muted px-1.5 py-0.5 rounded">?key=...</code> or as an <code className="font-mono bg-muted px-1.5 py-0.5 rounded">X-Api-Key</code> header.
          </p>
          <CodeBlock>
            {`# Your private API key (keep it secret)
# Get it from the admin who issued this panel.`}
          </CodeBlock>
        </section>

        {/* Documentation */}
        <section>
          <h2 className="text-xl font-bold mb-1">Available Endpoints</h2>
          <p className="text-sm text-muted-foreground mb-4">
            All endpoints are <span className="font-mono text-primary">GET</span> requests returning JSON.
          </p>

          <div className="space-y-3">
            {k.services.map((sKey) => {
              const def = SERVICE_MAP[sKey];
              if (!def) return null;
              return <EndpointCard key={sKey} def={def} origin={origin} />;
            })}
          </div>

          {k.services.length === 0 && (
            <div className="panel border rounded-xl p-6 text-center text-sm text-muted-foreground">
              No services enabled on this key. Contact the admin.
            </div>
          )}
        </section>

        {/* Response format */}
        <section className="mt-8 panel border rounded-xl p-6">
          <h2 className="font-semibold mb-2">Response format</h2>
          <p className="text-sm text-muted-foreground mb-3">
            All responses are JSON. On success: HTTP 200 with the lookup data. On error: appropriate
            HTTP status with <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{`{"error": "message"}`}</code>.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs font-mono">
            {[
              ["200", "Success — 1 credit used"],
              ["400", "Missing / invalid parameter"],
              ["401", "Invalid API key"],
              ["402", "No credits remaining"],
              ["403", "Service disabled or key inactive"],
              ["429", "Rate limit exceeded"],
              ["502", "Upstream error"],
            ].map(([code, msg]) => (
              <div key={code} className="flex gap-3 px-3 py-2 bg-muted/40 border border-border/30 rounded-md">
                <span className="text-primary">{code}</span>
                <span className="text-muted-foreground">{msg}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground font-mono">
          OSINT_PANEL · powered by Krishna · t.me/moneycomming
        </footer>
      </main>
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

function EndpointCard({ def, origin }: { def: { key: string; param: string; label: string; example: string }; origin: string }) {
  // We don't expose the user's key here — they already have it.
  const base = origin || "https://your-domain";
  const url = `${base}/api/v1/${def.key}?key=YOUR_API_KEY&${def.param}=${def.example}`;
  const curl = `curl -H "X-Api-Key: YOUR_API_KEY" "${base}/api/v1/${def.key}?${def.param}=${def.example}"`;

  return (
    <div className="panel border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded">GET</span>
          <span className="font-mono text-sm">/api/v1/{def.key}</span>
          <span className="text-xs text-muted-foreground">{def.label}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          param: <span className="text-primary">{def.param}</span>
        </span>
      </div>
      <div className="p-4 space-y-2">
        <CodeBlock label="URL">{url}</CodeBlock>
        <CodeBlock label="cURL">{curl}</CodeBlock>
      </div>
    </div>
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      {label && (
        <div className="absolute top-2 left-3 text-[10px] font-mono text-muted-foreground">{label}</div>
      )}
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-accent/20 opacity-60 group-hover:opacity-100"
      >
        {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
      </button>
      <pre className={`bg-background/80 border border-border/50 rounded-md p-3 ${label ? "pt-6" : ""} text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all`}>
        {children}
      </pre>
    </div>
  );
}
