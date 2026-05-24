import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListUsers, adminCreateUser, adminResetPassword, adminDeleteUser, adminSetSuspended,
  getMyProfile,
} from "@/lib/users.functions";
import { adminMarkPaid, adminUpdateBilling, adminListPayments } from "@/lib/billing.functions";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, KeyRound, CreditCard, ShieldOff, ShieldCheck,
  ArrowLeft, X, Receipt, Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
  head: () => ({ meta: [{ title: "Admin Panel" }, { name: "robots", content: "noindex" }] }),
});

type Profile = {
  user_id: string; username: string; full_name: string | null;
  is_suspended: boolean; suspended_reason: string | null;
  charge_amount: number; billing_cycle_days: number;
  last_paid_at: string | null; next_due_at: string;
  notes: string | null; created_at: string;
};

function AdminPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meFn = useServerFn(getMyProfile);
  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const resetFn = useServerFn(adminResetPassword);
  const delFn = useServerFn(adminDeleteUser);
  const suspendFn = useServerFn(adminSetSuspended);
  const payFn = useServerFn(adminMarkPaid);
  const billFn = useServerFn(adminUpdateBilling);

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data: usersRes, isLoading } = useQuery({
    queryKey: ["admin-users"], queryFn: () => listFn(),
    enabled: me?.isAdmin === true,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createMut = useMutation({
    mutationFn: (d: { username: string; password: string; full_name?: string | null; charge_amount: number; billing_cycle_days: number; notes?: string | null }) => createFn({ data: d }),
    onSuccess: () => { toast.success("User created"); setShowCreate(false); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resetMut = useMutation({
    mutationFn: (d: { user_id: string; password: string }) => resetFn({ data: d }),
    onSuccess: () => toast.success("Password updated"),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { user_id: id } }),
    onSuccess: () => { toast.success("User deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const suspMut = useMutation({
    mutationFn: (d: { user_id: string; is_suspended: boolean }) => suspendFn({ data: d }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const payMut = useMutation({
    mutationFn: (d: { user_id: string; amount: number; note?: string }) => payFn({ data: d }),
    onSuccess: () => { toast.success("Payment recorded — cycle reset"); refresh(); setPayModal(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const billMut = useMutation({
    mutationFn: (d: { user_id: string; charge_amount?: number; billing_cycle_days?: number }) => billFn({ data: d }),
    onSuccess: () => { toast.success("Billing updated"); refresh(); setEditBill(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [payModal, setPayModal] = useState<Profile | null>(null);
  const [editBill, setEditBill] = useState<Profile | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Profile | null>(null);

  if (meLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>;
  if (!me?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-sm text-center">
          <p className="text-sm text-red-900 font-semibold">Admin access required.</p>
          <Link to="/dashboard" className="mt-3 inline-block text-xs text-indigo-600 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const users = (usersRes?.users ?? []) as Profile[];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" /></Link>
            <span className="font-mono font-bold">ADMIN_PANEL</span>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="text-xs text-slate-600 hover:text-slate-900"
          >Logout</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users &amp; Billing</h1>
            <p className="text-sm text-slate-600">{users.length} user{users.length === 1 ? "" : "s"}</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 flex items-center gap-1.5">
            <Plus className="size-4" /> New User
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Billing</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const days = Math.ceil((new Date(u.next_due_at).getTime() - Date.now()) / 86400_000);
                  const overdue = days <= 0 && u.charge_amount > 0;
                  return (
                    <tr key={u.user_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">@{u.username}</div>
                        {u.full_name && <div className="text-xs text-slate-500">{u.full_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-mono ${
                          u.is_suspended ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}>{u.is_suspended ? "SUSPENDED" : "ACTIVE"}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        ₹{u.charge_amount} / {u.billing_cycle_days}d
                      </td>
                      <td className={`px-4 py-3 ${overdue ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                        {u.charge_amount === 0 ? "—"
                          : overdue ? `${Math.abs(days)}d overdue`
                          : `in ${days}d`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          {u.charge_amount > 0 && (
                            <button onClick={() => setPayModal(u)} title="Mark paid"
                              className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700"><CreditCard className="size-4" /></button>
                          )}
                          <button onClick={() => setEditBill(u)} title="Edit billing"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Pencil className="size-4" /></button>
                          <button onClick={() => setPaymentsFor(u)} title="Payments history"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Receipt className="size-4" /></button>
                          <button onClick={() => {
                            const pw = prompt(`New password for @${u.username} (min 8 chars):`);
                            if (pw && pw.length >= 8) resetMut.mutate({ user_id: u.user_id, password: pw });
                          }} title="Reset password"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><KeyRound className="size-4" /></button>
                          <button onClick={() => suspMut.mutate({ user_id: u.user_id, is_suspended: !u.is_suspended })}
                            title={u.is_suspended ? "Reactivate" : "Suspend"}
                            className="p-1.5 rounded hover:bg-amber-100 text-amber-700">
                            {u.is_suspended ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
                          </button>
                          <button onClick={() => {
                            if (confirm(`Delete @${u.username}? All their keys and history will be wiped.`))
                              delMut.mutate(u.user_id);
                          }} title="Delete"
                            className="p-1.5 rounded hover:bg-red-100 text-red-600"><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreate={(d) => createMut.mutate(d)} busy={createMut.isPending} />}
      {payModal && <PayModal u={payModal} onClose={() => setPayModal(null)} onPay={(d) => payMut.mutate({ user_id: payModal.user_id, ...d })} busy={payMut.isPending} />}
      {editBill && <EditBillModal u={editBill} onClose={() => setEditBill(null)} onSave={(d) => billMut.mutate({ user_id: editBill.user_id, ...d })} busy={billMut.isPending} />}
      {paymentsFor && <PaymentsModal u={paymentsFor} onClose={() => setPaymentsFor(null)} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreate, busy }: {
  onClose: () => void;
  onCreate: (d: { username: string; password: string; full_name?: string | null; charge_amount: number; billing_cycle_days: number; notes?: string | null }) => void;
  busy: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [charge, setCharge] = useState("500");
  const [cycle, setCycle] = useState("3");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      username: username.trim().toLowerCase(),
      password,
      full_name: fullName.trim() || null,
      charge_amount: Number(charge) || 0,
      billing_cycle_days: Number(cycle) || 3,
    });
  };
  return (
    <Modal title="Create user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="USERNAME (3-30, lowercase/digits/underscore)">
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30}
            pattern="[a-z0-9_]{3,30}" className={inp} placeholder="e.g. rahul_07" />
        </Field>
        <Field label="PASSWORD (min 8)">
          <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} type="text" className={inp} placeholder="ChooseStrong123" />
        </Field>
        <Field label="FULL NAME (optional)">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} className={inp} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CHARGE PER CYCLE (₹)">
            <input type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} className={inp} />
          </Field>
          <Field label="CYCLE LENGTH (DAYS)">
            <input type="number" min="1" max="365" value={cycle} onChange={(e) => setCycle(e.target.value)} className={inp} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Set charge to 0 for a free account (no billing cycle / never suspended).</p>
        <ModalActions onClose={onClose} busy={busy} label="Create user" />
      </form>
    </Modal>
  );
}

function PayModal({ u, onClose, onPay, busy }: { u: Profile; onClose: () => void; onPay: (d: { amount: number; note?: string }) => void; busy: boolean }) {
  const [amount, setAmount] = useState(String(u.charge_amount));
  const [note, setNote] = useState("");
  return (
    <Modal title={`Mark paid — @${u.username}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onPay({ amount: Number(amount) || 0, note: note || undefined }); }} className="space-y-3">
        <Field label="AMOUNT (₹)">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} required />
        </Field>
        <Field label="NOTE (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} maxLength={200} />
        </Field>
        <p className="text-xs text-slate-500">This resets the {u.billing_cycle_days}-day cycle, unsuspends the user, and re-enables their keys.</p>
        <ModalActions onClose={onClose} busy={busy} label="Record payment" />
      </form>
    </Modal>
  );
}

function EditBillModal({ u, onClose, onSave, busy }: { u: Profile; onClose: () => void; onSave: (d: { charge_amount: number; billing_cycle_days: number }) => void; busy: boolean }) {
  const [charge, setCharge] = useState(String(u.charge_amount));
  const [cycle, setCycle] = useState(String(u.billing_cycle_days));
  return (
    <Modal title={`Edit billing — @${u.username}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ charge_amount: Number(charge) || 0, billing_cycle_days: Number(cycle) || 3 }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="CHARGE (₹)"><input type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} className={inp} /></Field>
          <Field label="CYCLE (DAYS)"><input type="number" min="1" max="365" value={cycle} onChange={(e) => setCycle(e.target.value)} className={inp} /></Field>
        </div>
        <ModalActions onClose={onClose} busy={busy} label="Save" />
      </form>
    </Modal>
  );
}

function PaymentsModal({ u, onClose }: { u: Profile; onClose: () => void }) {
  const fn = useServerFn(adminListPayments);
  const { data, isLoading } = useQuery({
    queryKey: ["payments", u.user_id],
    queryFn: () => fn({ data: { user_id: u.user_id } }),
  });
  return (
    <Modal title={`Payments — @${u.username}`} onClose={onClose}>
      {isLoading ? <Loader2 className="mx-auto my-6 size-5 animate-spin text-indigo-600" />
        : !data?.payments?.length ? <p className="text-sm text-slate-500 text-center py-6">No payments yet.</p>
        : (
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr><th className="py-2">Date</th><th>Amount</th><th>Period end</th><th>Note</th></tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{new Date(p.paid_at).toLocaleDateString()}</td>
                  <td className="font-mono text-emerald-700">₹{p.amount}</td>
                  <td className="text-slate-500">{new Date(p.period_end).toLocaleDateString()}</td>
                  <td className="text-slate-600">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </Modal>
  );
}

// ─── tiny UI helpers ───
const inp = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="size-4 text-slate-500" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return (
    <div className="mt-5 flex gap-2 justify-end">
      <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
      <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
        {busy && <Loader2 className="size-4 animate-spin" />} {label}
      </button>
    </div>
  );
}
