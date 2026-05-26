import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, User, FileText, X } from "lucide-react";

// Only this Gmail is allowed to create / own the master account.
const MASTER_EMAIL = "krish8858825412@gmail.com";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login — OSINT Panel" }, { name: "robots", content: "noindex" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"email" | "panel">("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let loginEmail = email.trim().toLowerCase();

      if (tab === "panel") {
        // Username/password login — resolve email by username
        const uname = username.trim().toLowerCase();
        if (!uname) throw new Error("Username required");
        const { data: foundEmail, error: rpcErr } = await supabase
          .rpc("find_email_by_username", { uname });
        if (rpcErr) throw rpcErr;
        if (!foundEmail) throw new Error("Username not found");
        loginEmail = foundEmail as unknown as string;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        // If it's the master email and account doesn't exist, allow first-time signup
        if (
          tab === "email" &&
          loginEmail === MASTER_EMAIL &&
          /invalid/i.test(error.message)
        ) {
          const { error: signErr } = await supabase.auth.signUp({
            email: loginEmail,
            password,
            options: { emailRedirectTo: `${window.location.origin}/dashboard` },
          });
          if (signErr) throw signErr;
          toast.success("Master account created. Signed in.");
        } else {
          throw error;
        }
      } else {
        toast.success("Signed in");
      }
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md panel border rounded-2xl p-7">
        <Link to="/" className="text-xs font-mono text-muted-foreground hover:text-foreground">
          ← back
        </Link>
        <div className="flex items-center gap-2 mt-2 mb-5">
          <span className="size-2 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold font-mono">LOGIN</h1>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mb-5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              tab === "email" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Mail className="size-3.5" /> Email
          </button>
          <button
            type="button"
            onClick={() => setTab("panel")}
            className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              tab === "panel" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <User className="size-3.5" /> Panel
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          {tab === "email"
            ? "Sign in with your registered email and password."
            : "Sign in with your panel username and password."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {tab === "email" ? (
            <div>
              <label className="text-xs font-mono text-muted-foreground">EMAIL</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-mono text-muted-foreground">USERNAME</label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-mono text-muted-foreground">PASSWORD</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowTerms(true)}
          className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
        >
          <FileText className="size-3.5" /> Terms and Conditions
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Access by invitation only. Public sign-ups are disabled.
        </p>

        <p className="mt-2 text-center text-xs">
          <Link to="/test" className="text-primary hover:underline">
            Open public API tester →
          </Link>
        </p>
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Terms and Conditions</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
{`This service is provided strictly for educational and research purposes only.
By accessing, using, or testing any endpoint, API key, dashboard or tool on this panel, you acknowledge and agree to every clause written below.

1. Educational use only.
All data, lookups, responses, examples, source code and documentation made available through this panel are intended solely for learning, academic research, lawful security analysis and informational understanding. You are not granted any right to use the service for surveillance, harassment, fraud, doxxing, identity theft, stalking, intimidation, financial scams, or any activity prohibited by the laws of your country, state or jurisdiction.

2. No liability.
The service is offered on a strict "as-is" and "as-available" basis. We make no warranties of any kind, whether express, implied, statutory or otherwise, including but not limited to warranties of merchantability, fitness for a particular purpose, accuracy, completeness, reliability, uptime, non-infringement or freedom from errors. We do not guarantee that any response returned by the API is correct, complete, lawful or safe to act upon.

3. User responsibility.
You are entirely and solely responsible for every action you take with this service, every query you make, every result you store, share, screenshot, forward or redistribute, and every consequence that follows. If you misuse the service in any manner, or use it in a way that violates law, you alone bear the full legal, civil and criminal responsibility. We disclaim all responsibility for your actions and for the actions of anyone you share your API key, dashboard URL, screenshots or downloaded data with.

4. No promise of continuity.
We will make a sincere effort to keep the service running smoothly, to keep the panels online, to keep the upstream APIs reachable, and to keep the response times fast. However, we do not promise, guarantee or warrant that the service will remain permanently available. The service may be paused, throttled, blocked, rate-limited, modified, suspended, taken offline temporarily, or shut down permanently at any time, without notice, without explanation, and without refund. Outages, downtime, latency spikes, expired keys, blocked IPs and similar events are an expected part of using this service.

5. Trust and good faith.
Every panel, login credential, API key and access link issued by us is issued in good faith and through trusted channels only. We do not knowingly issue access to anyone who declares an intent to misuse it. If access is later misused, the responsibility shifts entirely to the person who misused it, and access may be revoked instantly.

6. No personal data collection.
The API itself does not store the search values you submit, does not store your IP address in logs, and does not retain personally identifiable information beyond what is strictly necessary for rate limiting and abuse prevention. Anything beyond that is your own responsibility to keep private on your own side.

7. Revocation and termination.
We reserve the absolute right to disable, revoke, rotate or delete any API key, dashboard URL, user account, panel login or session at any time, for any reason, including but not limited to suspected abuse, payment overdue, security concerns, legal request, or our own discretion. A revoked key, URL or account does not carry forward to a future re-issue. Once revoked, it is permanently gone.

8. No reverse engineering of the upstream.
You agree not to attempt to identify, scrape, contact, reverse engineer, decompile, deduce, locate, reroute around, or otherwise probe the upstream provider that powers this service. The upstream provider is intentionally hidden. Any attempt to bypass this is a serious violation and will result in instant permanent revocation.

9. No support guarantee.
Support, help, replies, fixes, bug responses and feature requests are provided purely on a best-effort basis. There is no service level agreement, no guaranteed response time, no escalation path and no obligation to fix any reported issue.

10. Indemnification.
You agree to indemnify, defend and hold harmless the operator of this service from and against any and all claims, damages, losses, liabilities, costs, fines, penalties, and expenses (including reasonable legal fees) arising from or related to your use of the service, your queries, your distribution of results, your sharing of credentials, and your actions or omissions in connection with this service.

11. Modification of terms.
We may update, amend, expand or rewrite these terms at any time. Continued use of the service after such changes constitutes acceptance of the updated terms.

12. Acceptance.
By signing in, by issuing or receiving an API key, by visiting a dashboard URL, by calling any endpoint, by opening the public tester, or by downloading the PDF documentation, you explicitly and irrevocably accept every clause of this agreement.

If you do not accept these terms in their entirety, you must not use the service. Close this window, do not sign in, do not call the API, do not share or store any data returned by it.

Use it wisely. Use it lawfully. Use it for learning.`}
        </div>
        <div className="px-6 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
