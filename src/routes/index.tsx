import { createFileRoute, Link } from "@tanstack/react-router";
import { SERVICES } from "@/lib/services";
import { Shield, Zap, Lock, Database } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "OSINT API Panel — Private" },
      { name: "description", content: "Issue API keys, manage credits, proxy OSINT lookups." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen grid-bg">
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10 bg-background/70">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="size-2 rounded-full bg-primary glow" />
            <span>OSINT_PANEL</span>
          </div>
          <Link
            to="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 glow"
          >
            Admin Login →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-mono text-primary mb-6">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            PRIVATE · INVITE-ONLY
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Your private<br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              OSINT API gateway
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Issue API keys with custom credits and expiry. Resell {SERVICES.length}+ OSINT
            endpoints with full rate-limiting, sanitized responses, and per-key dashboards.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/login"
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 glow"
            >
              Open Admin Panel
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mt-20">
          {[
            { icon: Shield, title: "Secure", desc: "RLS, hashed admin auth, upstream key never leaks." },
            { icon: Zap, title: "Rate-limited", desc: "Per-IP + per-key sliding window protection." },
            { icon: Lock, title: "Sanitized", desc: "Branding/identifier fields stripped from every response." },
            { icon: Database, title: `${SERVICES.length} services`, desc: "Phone, Aadhaar, UPI, vehicle, social & more." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="panel border rounded-xl p-5">
              <Icon className="size-5 text-primary mb-3" />
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 panel border rounded-xl p-6">
          <div className="text-sm text-muted-foreground mb-3 font-mono">SUPPORTED SERVICES</div>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <span
                key={s.key}
                className="text-xs font-mono px-2.5 py-1 rounded-md bg-muted border border-border/50"
              >
                /api/v1/{s.key}
              </span>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground font-mono">
        OSINT_PANEL · access by invitation only
      </footer>
    </div>
  );
}
