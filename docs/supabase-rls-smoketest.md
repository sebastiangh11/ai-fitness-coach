# Supabase RLS Smoke Test

## Prerequisites

1. Apply migration `002_auth_rls.sql` in the Supabase dashboard
   (SQL Editor → paste file → Run) **or** via Supabase CLI:
   ```bash
   supabase db push
   ```

2. Server running locally:
   ```bash
   npm run dev
   ```

3. A valid Supabase user account (email + password).
   Create one at: Supabase Dashboard → Authentication → Users → Add user.

---

## Curl Smoke Test

Replace `you@example.com` / `yourpassword` with real credentials.

```bash
BASE=http://localhost:3000
WEEK=2025-01-06   # must be a Monday

# ── 1. Clear cookie jar ────────────────────────────────────────────────────
rm -f cookies.txt

# ── 2. Login (writes sb- session cookies) ─────────────────────────────────
curl -s -c cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq .
# Expected: { "ok": true, "user": { "id": "...", "email": "..." } }

# ── 3. Confirm sb- cookies are stored ─────────────────────────────────────
grep 'sb-' cookies.txt
# Expected: one or more lines containing sb-<project-ref>-auth-token

# ── 4. Init week (creates week + plan_days scoped to your user_id) ─────────
curl -s -b cookies.txt -X POST "$BASE/api/plan/init-week" \
  -H "Content-Type: application/json" \
  -d "{
    \"weekStartISO\": \"$WEEK\",
    \"context\": {
      \"constraints\": {
        \"focus\": \"general_fitness\",
        \"timeBudget\": { \"monday\": 45, \"wednesday\": 60, \"friday\": 45 },
        \"equipment\": { \"pool\": false, \"gym\": true, \"bikeTrainer\": false, \"outdoorRun\": true }
      }
    }
  }" | jq .ok
# Expected: true

# ── 5. Log a completed session ─────────────────────────────────────────────
curl -s -b cookies.txt -X POST "$BASE/api/sessions/log" \
  -H "Content-Type: application/json" \
  -d "{
    \"weekStartISO\": \"$WEEK\",
    \"session\": {
      \"date\": \"$WEEK\",
      \"type\": \"run\",
      \"durationMinutes\": 40,
      \"rpe\": 6
    }
  }" | jq .ok
# Expected: true

# ── 6. Fetch week plan ─────────────────────────────────────────────────────
curl -s -b cookies.txt "$BASE/api/plan/week?weekStartISO=$WEEK" | jq .ok
# Expected: true

# ── 7. Logout ─────────────────────────────────────────────────────────────
curl -s -b cookies.txt -c cookies.txt -X POST "$BASE/api/auth/logout" | jq .ok
# Expected: true

# ── 8. Week fetch after logout must return 401 ────────────────────────────
curl -s -b cookies.txt "$BASE/api/plan/week?weekStartISO=$WEEK" | jq .
# Expected: { "ok": false, "error": "Auth session missing" }  (HTTP 401)
```

---

## Supabase Dashboard Checks

### Verify RLS is enabled

SQL Editor:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('weeks', 'plan_days', 'completed_sessions', 'decision_logs');
```
All four rows should show `rowsecurity = true`.

### Verify policies exist

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
Expected policies per table:

| Table | Policies |
|---|---|
| `weeks` | weeks_select, weeks_insert, weeks_update, weeks_delete |
| `plan_days` | plan_days_select, plan_days_insert, plan_days_update, plan_days_delete |
| `completed_sessions` | completed_sessions_select, completed_sessions_insert, completed_sessions_delete |
| `decision_logs` | decision_logs_select, decision_logs_insert |

### Verify cross-user isolation (optional)

1. Create a second user, login as them, call `/api/plan/week?weekStartISO=<same week>`.
2. Response must be `{ "ok": false, "error": "Week not found" }` — RLS hides user A's rows from user B.

---

## Validation Commands

```bash
# TypeScript strict
npx tsc --noEmit --strict

# Unit tests
npm run test:run
```
