import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listApiKeys,
  createApiKey,
  toggleApiKey,
  deleteApiKey,
  updateApiKey,
  rotateSlug,
} from "@/lib/api-keys.functions";
import {
  listPanelUsers, createPanelUser, deletePanelUser, resetPanelUserPassword,
} from "@/lib/panel-users.functions";
import { SERVICES } from "@/lib/services";
import { toast } from "sonner";
import {
  Loader2, Plus, Copy, ExternalLink, Power, Trash2, RefreshCw, LogOut, Check, Shuffle, FlaskConical,
  Users, KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — OSINT Panel" }, { name: "robots", content: "noindex" }] }),
});

type ApiKeyRow = {
  id: string;
  name: string;
  api_key: string;
  public_slug: string;
  services: string[];
  credits_total: number | null;
  credits_used: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const toggle = useServerFn(toggleApiKey);
  const del = useServerFn(deleteApiKey);
  const update = useServerFn(updateApiKey);
  const rotate = useServerFn(rotateSlug);

  const { data, isLoading } = useQuery({
    queryKey: ["api_keys"],
    queryFn: () => list({}),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["api_keys"] });

  const createMut = useMutation({
    mutationFn: (d: { name: string; services: string[]; credits_total: number | null; days: number | null; notes?: string }) =>
      create({ data: d }),
    onSuccess: () => { toast.success("API key created"); refresh(); setShowCreate(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) => toggle({ data: d }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updMut = useMutation({
    mutationFn: (d: { id: string; credits_total: number | null; extend_days?: number | null }) =>
      update({ data: d }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: (id: string) => rotate({ data: { id } }),
    onSuccess: () => { toast.success("Dashboard URL rotated — old link is dead"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<"keys" | "users">("keys");
  const [showCreateUser, setShowCreateUser] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const keys = (data?.keys ?? []) as ApiKeyRow[];

  return (
    <div className="min-h-screen grid-bg">
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10 bg-background/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="size-2 rounded-full bg-primary glow" />
            <span>OSINT_PANEL</span>
            <span className="text-muted-foreground ml-2 text-xs">/ admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/tester"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-primary/15 text-primary hover:bg-primary/25"
            >
              <FlaskConical className="size-3.5" /> Tester
            </Link>
            <button
              onClick={refresh}
              className="p-2 hover:bg-accent/20 rounded-md"
              title="Refresh"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs px-3 py-2 hover:bg-accent/20 rounded-md"
            >
              <LogOut className="size-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg mb-6 max-w-md text-sm font-medium">
          <button
            onClick={() => setTab("keys")}
            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              tab === "keys" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <KeyRound className="size-3.5" /> API Keys
          </button>
          <button
            onClick={() => setTab("users")}
            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-1.5 transition ${
              tab === "users" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Users className="size-3.5" /> Panel Users
          </button>
        </div>

        {tab === "keys" ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">API Keys</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {keys.length} key{keys.length === 1 ? "" : "s"} issued
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 glow"
              >
                <Plus className="size-4" /> New API Key
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : keys.length === 0 ? (
              <div className="panel border rounded-xl p-12 text-center">
                <div className="font-mono text-sm text-muted-foreground">No API keys yet</div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Create your first key
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <KeyRow
                    key={k.id}
                    k={k}
                    onToggle={() => toggleMut.mutate({ id: k.id, is_active: !k.is_active })}
                    onDelete={() => {
                      if (confirm(`Delete API key for ${k.name}?`)) delMut.mutate(k.id);
                    }}
                    onRotate={() => {
                      if (confirm(`Rotate dashboard URL for ${k.name}?\n\nThe old link will stop working immediately. Send the new URL to the customer.`))
                        rotateMut.mutate(k.id);
                    }}
                    onAddCredits={(addCredits, addDays) => {
                      const newTotal = k.credits_total === null
                        ? null
                        : k.credits_total + addCredits;
                      updMut.mutate({
                        id: k.id,
                        credits_total: newTotal,
                        extend_days: addDays || null,
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <PanelUsersTab onOpenCreate={() => setShowCreateUser(true)} />
        )}
      </main>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(d) => createMut.mutate(d)}
          busy={createMut.isPending}
        />
      )}
      {showCreateUser && (
        <CreatePanelUserModal onClose={() => setShowCreateUser(false)} />
      )}
    </div>
  );
}

function KeyRow({
  k, onToggle, onDelete, onRotate, onAddCredits,
}: {
  k: ApiKeyRow;
  onToggle: () => void;
  onDelete: () => void;
  onRotate: () => void;
  onAddCredits: (credits: number, days: number) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const daysLeft = k.expires_at
    ? Math.max(0, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000))
    : null;
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const creditsLeft = k.credits_total === null ? null : Math.max(0, k.credits_total - k.credits_used);

  const panelUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${k.public_slug}` : `/p/${k.public_slug}`;

  const [showAdd, setShowAdd] = useState(false);
  const [addC, setAddC] = useState("");
  const [addD, setAddD] = useState("");

  return (
    <div className="panel border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{k.name}</h3>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                expired || !k.is_active
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/20 text-primary"
              }`}
            >
              {expired ? "EXPIRED" : k.is_active ? "ACTIVE" : "DISABLED"}
            </span>
          </div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2 max-w-2xl">
            <button
              onClick={() => copy(k.api_key, "key")}
              className="flex items-center gap-2 text-xs font-mono bg-muted px-3 py-2 rounded-md border border-border/50 hover:border-primary/50 text-left"
            >
              {copied === "key" ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              <span className="truncate">{k.api_key}</span>
            </button>
            <button
              onClick={() => copy(panelUrl, "url")}
              className="flex items-center gap-2 text-xs font-mono bg-muted px-3 py-2 rounded-md border border-border/50 hover:border-primary/50 text-left"
            >
              {copied === "url" ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              <span className="truncate">/p/{k.public_slug.slice(0, 24)}...</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={`/p/${k.public_slug}`}
            target="_blank"
            rel="noreferrer"
            className="p-2 hover:bg-accent/20 rounded-md"
            title="Open panel"
          >
            <ExternalLink className="size-4" />
          </a>
          <button onClick={onToggle} className="p-2 hover:bg-accent/20 rounded-md" title={k.is_active ? "Revoke (disable)" : "Reactivate"}>
            <Power className={`size-4 ${k.is_active ? "text-primary" : "text-muted-foreground"}`} />
          </button>
          <button onClick={onRotate} className="p-2 hover:bg-accent/20 rounded-md" title="Rotate dashboard URL (kills old link)">
            <Shuffle className="size-4 text-warning" />
          </button>
          <button onClick={onDelete} className="p-2 hover:bg-destructive/20 rounded-md text-destructive" title="Delete">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="CREDITS" value={creditsLeft === null ? "∞" : `${creditsLeft} / ${k.credits_total}`} />
        <Stat label="DAYS LEFT" value={daysLeft === null ? "∞" : `${daysLeft}d`} />
        <Stat label="SERVICES" value={`${k.services.length}`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {k.services.map((s) => (
          <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-md border hover:bg-accent/20"
        >
          {showAdd ? "Cancel" : "Top up"}
        </button>
        {showAdd && (
          <>
            <input
              type="number"
              placeholder="+ credits"
              value={addC}
              onChange={(e) => setAddC(e.target.value)}
              className="text-xs bg-input border px-2 py-1.5 rounded-md w-24"
              disabled={k.credits_total === null}
            />
            <input
              type="number"
              placeholder="+ days"
              value={addD}
              onChange={(e) => setAddD(e.target.value)}
              className="text-xs bg-input border px-2 py-1.5 rounded-md w-24"
            />
            <button
              onClick={() => {
                onAddCredits(Number(addC) || 0, Number(addD) || 0);
                setAddC(""); setAddD(""); setShowAdd(false);
              }}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
            >
              Apply
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 border border-border/30 rounded-md p-2.5">
      <div className="text-[10px] font-mono text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-sm mt-0.5">{value}</div>
    </div>
  );
}

function CreateModal({
  onClose, onCreate, busy,
}: {
  onClose: () => void;
  onCreate: (d: { name: string; services: string[]; credits_total: number | null; days: number | null; notes?: string; fast_mode?: boolean }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [credits, setCredits] = useState("100");
  const [unlimitedDays, setUnlimitedDays] = useState(false);
  const [days, setDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [fastMode, setFastMode] = useState(true);

  const toggle = (k: string) => {
    const next = new Set(selected);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelected(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    if (selected.size === 0) return toast.error("Select at least one service");
    onCreate({
      name: name.trim(),
      services: Array.from(selected),
      credits_total: unlimitedCredits ? null : Math.max(1, Number(credits) || 1),
      days: unlimitedDays ? null : Math.max(1, Number(days) || 1),
      notes: notes.trim() || undefined,
      fast_mode: fastMode,
    });
  };

  const allChecked = selected.size === SERVICES.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="panel border rounded-2xl p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-1">Create API Key</h2>
        <p className="text-xs text-muted-foreground mb-6">Define ownership, limits, and services.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground">CUSTOMER NAME / LABEL</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              required maxLength={80}
              placeholder="e.g. Rahul Sharma"
              className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-muted-foreground">CREDITS</label>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={unlimitedCredits} onChange={(e) => setUnlimitedCredits(e.target.checked)} />
                  Unlimited
                </label>
              </div>
              <input
                type="number" min="1" disabled={unlimitedCredits}
                value={unlimitedCredits ? "" : credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder={unlimitedCredits ? "∞" : "100"}
                className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-muted-foreground">DAYS</label>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={unlimitedDays} onChange={(e) => setUnlimitedDays(e.target.checked)} />
                  Never expires
                </label>
              </div>
              <input
                type="number" min="1" disabled={unlimitedDays}
                value={unlimitedDays ? "" : days}
                onChange={(e) => setDays(e.target.value)}
                placeholder={unlimitedDays ? "∞" : "30"}
                className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-muted-foreground">SERVICES ({selected.size})</label>
              <button
                type="button"
                onClick={() => setSelected(allChecked ? new Set() : new Set(SERVICES.map((s) => s.key)))}
                className="text-[11px] underline text-muted-foreground hover:text-foreground"
              >
                {allChecked ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto p-1 border rounded-md bg-background/50">
              {SERVICES.map((s) => {
                const on = selected.has(s.key);
                return (
                  <button
                    type="button" key={s.key} onClick={() => toggle(s.key)}
                    className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-md border transition ${
                      on ? "bg-primary/10 border-primary/50" : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <span className={`size-3 rounded-sm border flex items-center justify-center ${on ? "bg-primary border-primary" : "border-muted-foreground/50"}`}>
                      {on && <Check className="size-2.5 text-primary-foreground" />}
                    </span>
                    <span className="font-mono">{s.key}</span>
                    <span className="text-muted-foreground ml-auto truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground">NOTES (optional)</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
              placeholder="Internal note about this customer"
              className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 p-3 border rounded-md bg-muted/30 cursor-pointer">
            <input
              type="checkbox"
              checked={fastMode}
              onChange={(e) => setFastMode(e.target.checked)}
              className="mt-0.5"
            />
            <div className="text-xs">
              <div className="font-semibold">⚡ Fast Reply Mode</div>
              <div className="text-muted-foreground mt-0.5">
                Skips per-key rate-count queries and request logging. Calls go straight
                to the master upstream — fastest possible response, lowest panel load.
                Recommended for production keys.
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-accent/20">
            Cancel
          </button>
          <button
            type="submit" disabled={busy}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 glow"
          >
            {busy && <Loader2 className="size-4 animate-spin" />} Create Key
          </button>
        </div>
      </form>
    </div>
  );
}

// silence "Link unused" import warning if applicable
void Link;

/* ------------------ Panel Users (admin-created username/password accounts) ------------------ */

function PanelUsersTab({ onOpenCreate }: { onOpenCreate: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listPanelUsers);
  const del = useServerFn(deletePanelUser);
  const reset = useServerFn(resetPanelUserPassword);

  const { data, isLoading } = useQuery({
    queryKey: ["panel_users"],
    queryFn: () => list({}),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["panel_users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (d: { user_id: string; password: string }) => reset({ data: d }),
    onSuccess: () => toast.success("Password reset"),
    onError: (e: Error) => toast.error(e.message),
  });

  const users = (data?.users ?? []) as Array<{
    user_id: string; username: string; full_name: string | null; created_at: string; is_suspended: boolean;
  }>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} account{users.length === 1 ? "" : "s"} — login via the <b>Panel</b> tab on the login page.
          </p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 glow"
        >
          <Plus className="size-4" /> Create User
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="panel border rounded-xl p-12 text-center">
          <div className="font-mono text-sm text-muted-foreground">No panel users yet</div>
          <button
            onClick={onOpenCreate}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create first user
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.user_id} className="panel border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold font-mono">{u.username}</span>
                  {u.is_suspended && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                      SUSPENDED
                    </span>
                  )}
                </div>
                {u.full_name && (
                  <div className="text-xs text-muted-foreground mt-0.5">{u.full_name}</div>
                )}
                <div className="text-[11px] text-muted-foreground font-mono mt-1">
                  Created {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const p = prompt(`New password for ${u.username} (min 8 chars)`);
                    if (p && p.length >= 8) resetMut.mutate({ user_id: u.user_id, password: p });
                    else if (p) toast.error("Password too short");
                  }}
                  className="text-xs px-3 py-1.5 rounded-md border hover:bg-accent/20"
                  title="Reset password"
                >
                  Reset password
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete panel user "${u.username}"? This cannot be undone.`))
                      delMut.mutate(u.user_id);
                  }}
                  className="p-2 hover:bg-destructive/20 rounded-md text-destructive"
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CreatePanelUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createPanelUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const mut = useMutation({
    mutationFn: (d: { username: string; password: string; full_name?: string | null }) =>
      create({ data: d }),
    onSuccess: () => {
      toast.success("Panel user created");
      qc.invalidateQueries({ queryKey: ["panel_users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,40}$/.test(username))
      return toast.error("Username: 3–40 chars, lowercase/digits/underscore");
    if (password.length < 8) return toast.error("Password min 8 chars");
    mut.mutate({
      username: username.toLowerCase(),
      password,
      full_name: fullName.trim() || null,
    });
  };

  const randomPwd = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint8Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    setPassword(out);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="panel border rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-1">Create Panel User</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Only the master admin can create accounts. Users log in via the <b>Panel</b> tab on the login page using these credentials.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground">USERNAME</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={40}
              placeholder="e.g. rahul_07"
              className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-muted-foreground">PASSWORD</label>
              <button type="button" onClick={randomPwd} className="text-[11px] underline text-muted-foreground hover:text-foreground">
                Generate strong
              </button>
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={128}
              placeholder="min 8 characters"
              className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-muted-foreground">FULL NAME (optional)</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder="Display name"
              className="mt-1 w-full rounded-md bg-input border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-accent/20">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mut.isPending}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 glow"
          >
            {mut.isPending && <Loader2 className="size-4 animate-spin" />} Create User
          </button>
        </div>
      </form>
    </div>
  );
}

