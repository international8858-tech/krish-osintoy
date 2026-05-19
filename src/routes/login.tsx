import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Admin Login — OSINT Panel" }, { name: "robots", content: "noindex" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. You're now admin.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Auth failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
      <div className="w-full max-w-md panel border rounded-2xl p-8">
        <Link to="/" className="text-xs font-mono text-muted-foreground hover:text-foreground">
          ← back
        </Link>
        <div className="flex items-center gap-2 mt-2 mb-6">
          <span className="size-2 rounded-full bg-primary glow" />
          <h1 className="text-2xl font-bold font-mono">ADMIN</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup"
            ? "First-time setup. The first signup automatically becomes admin."
            : "Sign in to manage API keys."}
        </p>

        <form onSubmit={submit} className="space-y-4">
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
          <div>
            <label className="text-xs font-mono text-muted-foreground">PASSWORD</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 glow flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signup" ? "Create admin account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-xs text-muted-foreground mt-6 hover:text-foreground"
        >
          {mode === "login" ? "First time? Create admin account →" : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
