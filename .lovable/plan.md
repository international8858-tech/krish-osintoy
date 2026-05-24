# Rework Plan

Bhai ye bahut bada change hai — confirm karne ke liye plan de raha hu. Approve karte hi sab ek saath banata hu.

## 1. Homepage = Tester (krish-osintoy.lovable.app)
- `src/routes/index.tsx` ko replace karunga: pura white interface, header pattern same.
- User apni API key paste karega (ya logged-in user ki key auto-fill hogi).
- Service dropdown + query input + "Test" button → live response JSON viewer (status, latency, raw + formatted).
- "Login" button hata dunga; chhota "Admin" link sirf footer me.
- Separate `/p/$slug` documentation page **delete** — sab kuch homepage pe.
- PDF download button homepage pe hi.

## 2. Auth = User ID + Password (no email)
- Naya `username` field. Login form: User ID + Password only.
- Admin panel se hi naye user create honge (signup public band).
- Internally Supabase ko `{username}@local.osintoy` email format me map karunga (Supabase ko email chahiye hi).
- Admin pehle se seed: ek default admin user banaunga (credentials chat me bata dunga, pehli login ke baad change karne ko bolunga).

## 3. Admin Panel — User + Billing Management
Naya `/admin` route. Admin yaha kar sake:
- Create user (username, password, monthly/per-cycle charge amount).
- Har user ka API key create/assign (services, credits, expiry).
- **Billing cycle**: har 3 din me payment due. Admin "Mark Paid" button daba ke cycle reset karega.
- Day 3 pe user dashboard pe warning banner. Day 4 pe user + uski sari keys **auto-suspend** (cron job).
- Admin "Reactivate" button — payment mark karke unban.
- Payment history table.

## 4. User Dashboard
- User login kare to apni keys, credits, next due date, payment status dikhe.
- Apni key ka tester inline (same component as homepage).
- Apne API request history dekh sake (already logged).

## 5. Request History with IP — Opt-in per key
- API key create karte time checkbox: "Save request history with IP".
- ON hua to har request ka full detail (query, IP, UA, response status, timestamp) `api_request_logs` me jata rahega (already hai, bas per-key flag respect karna hai).
- Key delete → `ON DELETE CASCADE` se sare logs bhi gayab.
- Key page pe "History" tab — search/filter.

## 6. API Security Hardening
- Master proxy (`/api/v1/$service`):
  - Constant-time API key compare.
  - Stricter input validation (Zod, max lengths, regex).
  - Per-IP + per-key rate limit (already hai) + global circuit breaker.
  - Suspended users/keys → instant 403, no upstream call.
  - Response time target <500ms (parallel queries already done; add 5s upstream timeout).
- Admin endpoints: double-check `has_role(admin)` + audit log.

## 7. Database Changes (1 migration)
- `profiles` table: `username UNIQUE`, `is_suspended`, `charge_amount`, `billing_cycle_days DEFAULT 3`, `next_due_at`, `last_paid_at`.
- `api_keys`: add `save_history BOOLEAN DEFAULT false`, `user_id` (owner, nullable for admin-only keys).
- `payments` table: user_id, amount, paid_at, period_start, period_end, marked_by_admin.
- `suspend_overdue_users()` SQL function + pg_cron job (hourly).
- RLS: users see only their own keys/logs/payments; admins see all.

## 8. Files Changed
- **New**: `src/routes/admin.tsx`, `src/routes/api/public/cron/suspend.ts`, `src/lib/billing.functions.ts`, `src/lib/auth.functions.ts`, `src/components/Tester.tsx`.
- **Rewritten**: `src/routes/index.tsx` (tester homepage), `src/routes/login.tsx` (username/password), `src/routes/_authenticated/dashboard.tsx`.
- **Updated**: `src/routes/api/v1/$service.ts` (suspension check, hardening), `api-keys.functions.ts` (save_history flag, user_id), migration.
- **Deleted**: `src/routes/p.$slug.tsx`, `src/routes/_authenticated/tester.tsx` (merged into homepage).

## ⚠️ Confirm karne wali baatein

1. **Default admin credentials** — kya rakhu? (e.g. username `admin` / password `Admin@2026` — pehli login ke baad change karna hoga). Ya tum apna username/password batao?
2. **Payment "mark as paid"** sirf admin manual karega — koi Stripe/online payment nahi, sahi?
3. **Suspension grace** — Day 4 pe ban ya thoda aur time?
4. **Username rules** — 3-30 chars, lowercase + digits + underscore — theek?

Ek baar ye 4 confirm kar do, fir ek hi turn me sab ban jayega.
