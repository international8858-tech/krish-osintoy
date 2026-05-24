import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyKeys, createApiKey, toggleApiKey, deleteApiKey, updateApiKey, listKeyHistory,
} from "@/lib/api-keys.functions";
import { getMyProfile } from "@/lib/users.functions";
import { SERVICES } from "@/lib/services";
import { Tester } from "@/components/Tester";
import { toast } from "sonner";
import {
  Loader2, Plus, Copy, Check, Power, Trash2, LogOut, History, KeyRound,
  AlertTriangle, CreditCard, Shield, X, Eye, EyeOff,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard" }, { name: "robots", content: "noindex" }] }),
});

type KeyRow = {
  id: string; name: string; api_key: string; public_slug: string;
  services: string[]; credits_total: number | null; credits_used: number;
  expires_at: string | null; is_active: boolean; created_at: string;
  save_history: boolean; user_id: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listMyKeys);
  const createFn = useServerFn(createApiKey);
  const toggleFn = useServerFn(toggleApiKey);
  const delFn = useServerFn(deleteApiKey);
  const updFn = useServerFn(updateApiKey);

  const { data: prof, isLoading: pLoading } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });
  const { data: keysRes } = useQuery({ queryKey: ["my-keys"], queryFn: () => listFn() });

  const [showCreate, setShowCreate] = useState(false);
  const [historyFor, setHistoryFor] = useState<KeyRow | null>(null);

  const createMut = useMutation({
    mutationFn: (d: { name: string; services: string[]; credits_total: number | null; days: number | null; notes?: string; save_history: boolean }) => createFn({ data: d }),
    onSuccess: () => { toast.success("Key created"); setShowCreate(false); qc.invalidateQueries({ queryKey: ["my-keys"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) => toggleFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-keys"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted (database wiped)"); qc.invalidateQueries({ queryKey: ["my-keys"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updMut = useMutation({
    mutationFn: (d: { id: string; save_history?: boolean }) => updFn({ data: d }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["my-keys"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  if (pLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>;

  const isAdmin = prof?.isAdmin ?? false;
  const profile = prof?.profile;
  const keys = (keysRes?.keys ?? []) as KeyRow[];
  const firstActiveKey = keys.find((k) => k.is_active)?.api_key ?? "";

  const daysUntilDue = profile?.next_due_at
    ? Math.ceil((new Date(profile.next_due_at).getTime() - Date.now()) / 86400_000)
    : null;
  const overdue = daysUntilDue !== null && daysUntilDue <= 0 && (profile?.charge_amount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-mono font-bold text-slate-900">
            <span className="size-2 rounded-full bg-indigo-600" />
            <span>OSINT_PANEL</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">@{profile?.username}</span>
            {isAdmin && (
              <Link to="/admin" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                <Shield className="inline size-3.5 mr-1" /> Admin
              </Link>
            )}
            <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1">
              <LogOut className="size-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-8">
        {/* Billing banner */}
        {profile && (profile.charge_amount ?? 0) > 0 && (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${
            overdue ? "border-red-300 bg-red-50" :
            daysUntilDue !== null && daysUntilDue <= 1 ? "border-amber-300 bg-amber-50" :
            "border-slate-200 bg-slate-50"
          }`}>
            <CreditCard className={`size-5 mt-0.5 ${overdue ? "text-red-600" : "text-slate-600"}`} />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-slate-900">
                {overdue ? "Payment overdue — account suspended"
                  : `Next payment in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`}
              </div>
              <div className="text-slate-600 mt-0.5">
                Cycle: ₹{profile.charge_amount} every {profile.billing_cycle_days} days.
                Due: <strong>{new Date(profile.next_due_at).toLocaleString()}</strong>.
                {overdue && " Contact your admin to clear the dues."}
              </div>
            </div>
          </div>
        )}

        {profile?.is_suspended && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-900">
              <div className="font-semibold">Account suspended</div>
              <div className="mt-0.5">{profile.suspended_reason ?? "Contact admin to reactivate."}</div>
            </div>
          </div>
        )}

        {/* Tester */}
        <section>
          <Tester initialKey={firstActiveKey} />
        </section>

        {/* My keys */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">My API Keys</h2>
              <p className="text-sm text-slate-600">{keys.length} key{keys.length === 1 ? "" : "s"}</p>
            </div>
            {!profile?.is_suspended && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="size-4" /> New Key
              </button>
            )}
          </div>

          {keys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
              No API keys yet. Create one to start.
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <KeyCard
                  key={k.id} k={k}
                  onToggle={() => toggleMut.mutate({ id: k.id, is_active: !k.is_active })}
                  onDelete={() => {
                    if (confirm(`Delete "${k.name}"? This also wipes ALL request history from the database. This cannot be undone.`))
                      delMut.mutate(k.id);
                  }}
                  onToggleHistory={() => updMut.mutate({ id: k.id, save_history: !k.save_history })}
                  onShowHistory={() => setHistoryFor(k)}
                />
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-500 pt-6 border-t border-slate-200">
          Need a service tested? Use the tester at the top — your key is auto-filled.
        </p>
      </main>

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreate={(d) => createMut.mutate(d)}
          busy={createMut.isPending}
        />
      )}
      {historyFor && (
        <HistoryModal k={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function KeyCard({
  k, onToggle, onDelete, onToggleHistory, onShowHistory,
}: {
  k: KeyRow;
  onToggle: () => void;
  onDelete: () => void;
  onToggleHistory: () => void;
  onShowHistory: () => void;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(k.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const creditsLeft = k.credits_total === null ? "∞" : Math.max(0, k.credits_total - k.credits_used);
  const daysLeft = k.expires_at
    ? Math.max(0, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const masked = k.api_key.slice(0, 8) + "•".repeat(Math.max(0, k.api_key.length - 12)) + k.api_key.slice(-4);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{k.name}</h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              expired || !k.is_active ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {expired ? "EXPIRED" : k.is_active ? "ACTIVE" : "DISABLED"}
            </span>
            {k.save_history && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                HISTORY ON
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 max-w-full">
            <code className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 px-2 py-1.5 rounded truncate text-slate-800">
              {show ? k.api_key : masked}
            </code>
            <button onClick={() => setShow((v) => !v)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={show ? "Hide" : "Show"}>
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button onClick={copy} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Copy">
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleHistory}
            className={`p-2 rounded-md text-xs flex items-center gap-1 ${
              k.save_history ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            title="Toggle history logging"
          >
            <History className="size-3.5" />
            {k.save_history ? "On" : "Off"}
          </button>
          {k.save_history && (
            <button onClick={onShowHistory} className="text-xs px-2 py-2 rounded-md hover:bg-slate-100 text-slate-700">
              View
            </button>
          )}
          <button onClick={onToggle} className="p-2 rounded-md hover:bg-slate-100" title={k.is_active ? "Disable" : "Enable"}>
            <Power className={`size-4 ${k.is_active ? "text-emerald-600" : "text-slate-400"}`} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-md hover:bg-red-50 text-red-600" title="Delete (also wipes history)">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="CREDITS" value={`${creditsLeft}${k.credits_total !== null ? ` / ${k.credits_total}` : ""}`} />
        <Stat label="DAYS LEFT" value={daysLeft === null ? "∞" : `${daysLeft}d`} />
        <Stat label="SERVICES" value={`${k.services.length}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
      <div className="text-[10px] font-semibold text-slate-500">{label}</div>
      <div className="font-mono font-semibold text-sm text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

function CreateKeyModal({
  onClose, onCreate, busy,
}: {
  onClose: () => void;
  onCreate: (d: { name: string; services: string[]; credits_total: number | null; days: number | null; notes?: string; save_history: boolean }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [credits, setCredits] = useState("100");
  const [unlimitedDays, setUnlimitedDays] = useState(false);
  const [days, setDays] = useState("30");
  const [saveHistory, setSaveHistory] = useState(false);

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    if (selected.size === 0) return toast.error("Pick at least one service");
    onCreate({
      name: name.trim(),
      services: Array.from(selected),
      credits_total: unlimitedCredits ? null : Math.max(1, Number(credits) || 1),
      days: unlimitedDays ? null : Math.max(1, Number(days) || 1),
      save_history: saveHistory,
    });
  };

  const allSelected = selected.size === SERVICES.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="rounded-2xl bg-white border border-slate-200 p-6 w-full max-w-xl my-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Create API Key</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="size-4 text-slate-500" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">LABEL</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              required maxLength={80} placeholder="e.g. my-bot-key"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">CREDITS</label>
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input type="checkbox" checked={unlimitedCredits} onChange={(e) => setUnlimitedCredits(e.target.checked)} /> Unlimited
                </label>
              </div>
              <input
                type="number" min="1" disabled={unlimitedCredits}
                value={unlimitedCredits ? "" : credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder={unlimitedCredits ? "∞" : "100"}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">DAYS</label>
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input type="checkbox" checked={unlimitedDays} onChange={(e) => setUnlimitedDays(e.target.checked)} /> Never
                </label>
              </div>
              <input
                type="number" min="1" disabled={unlimitedDays}
                value={unlimitedDays ? "" : days}
                onChange={(e) => setDays(e.target.value)}
                placeholder={unlimitedDays ? "∞" : "30"}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 p-3 rounded-md border border-slate-200 bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={saveHistory} onChange={(e) => setSaveHistory(e.target.checked)} className="mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <History className="size-3.5 text-indigo-600" /> Save request history (with IP)
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Every request via this key will be stored with IP, query, status &amp; timestamp.
                You can view and delete this data later.
              </div>
            </div>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">SERVICES ({selected.size})</label>
              <button type="button"
                onClick={() => setSelected(allSelected ? new Set() : new Set(SERVICES.map((s) => s.key)))}
                className="text-[11px] text-indigo-600 hover:underline">
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
              {SERVICES.map((s) => {
                const on = selected.has(s.key);
                return (
                  <button type="button" key={s.key} onClick={() => toggle(s.key)}
                    className={`text-left text-xs px-2 py-1.5 rounded font-mono ${on ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}>
                    {on ? "✓ " : ""}/{s.key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />} Create
          </button>
        </div>
      </form>
    </div>
  );
}

function HistoryModal({ k, onClose }: { k: KeyRow; onClose: () => void }) {
  const histFn = useServerFn(listKeyHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["history", k.id],
    queryFn: () => histFn({ data: { key_id: k.id, limit: 200 } }),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="rounded-2xl bg-white border border-slate-200 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><History className="size-4 text-indigo-600" /> Request history</h2>
            <p className="text-xs text-slate-500">{k.name} — last 200 requests</p>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-100"><X className="size-4 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="size-5 animate-spin text-indigo-600" /></div>
          ) : !data?.logs?.length ? (
            <div className="text-center py-10 text-sm text-slate-500">No requests yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr><th className="py-2">Time</th><th>Service</th><th>Query</th><th>IP</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-700">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="font-mono text-slate-900">/{l.service}</td>
                    <td className="font-mono text-slate-700 max-w-[200px] truncate">{l.query_param ?? "—"}</td>
                    <td className="font-mono text-slate-500">{l.ip ?? "—"}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded font-mono ${
                        l.status >= 200 && l.status < 300 ? "bg-emerald-100 text-emerald-700"
                        : l.status === 429 ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                      }`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
