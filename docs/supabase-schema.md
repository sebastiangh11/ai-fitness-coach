# Supabase Schema – AI Fitness Coach

This document explains how the four Postgres tables introduced in
`supabase/migrations/001_init.sql` map to the `TrainingStateStore` interface
defined in [lib/training-engine/runtime/store.ts](../lib/training-engine/runtime/store.ts).

---

## Overview

```
TrainingStateStore method        →  Table(s) touched
─────────────────────────────────────────────────────────────
initWeek(snapshot)               →  weeks (insert)
                                     plan_days (insert × 7)
                                     decision_logs (insert)
getWeekPlan(weekStartISO)        →  weeks + plan_days + decision_logs (select)
saveWeekPlan(snapshot)           →  weeks (update), plan_days (upsert)
logCompletedSession(...)         →  completed_sessions (insert)
markMissed(...)                  →  plan_days (update status → 'missed')
getCompletedSessions(weekStart)  →  completed_sessions (select)
getDecisionLog(weekStart)        →  decision_logs (select)
```

---

## Table-by-table breakdown

### `weeks`

Corresponds to the top-level metadata of a `WeekPlanSnapshot`.

| Column           | TypeScript source                          | Notes                                      |
|------------------|--------------------------------------------|--------------------------------------------|
| `id`             | —                                          | Surrogate PK; referenced by child tables.  |
| `user_key`       | —                                          | Multi-user isolation key; `'local'` for single-user/offline mode. |
| `week_start`     | `snapshot.weekStartISO`                    | Monday-anchored ISO date (YYYY-MM-DD).     |
| `engine_version` | `snapshot.engineVersion`                   | Semver string, e.g. `'v1'`.               |
| `context_json`   | `snapshot.context` (`PlanContext`)         | Full serialised context: constraints, readiness, history. |
| `created_at`     | `snapshot.createdAt`                       | Set once on `initWeek`.                    |
| `updated_at`     | `snapshot.updatedAt`                       | Auto-updated by trigger on every `UPDATE`. |

`initWeek` inserts one row; `saveWeekPlan` updates `context_json`,
`engine_version`, and `updated_at` (via trigger).

The unique constraint `(user_key, week_start)` mirrors the in-memory store's
behaviour of throwing when `initWeek` is called for an already-existing week.

---

### `plan_days`

Corresponds to the `planDays: PlanDay[]` array inside `WeekPlanSnapshot`.

| Column      | TypeScript source                   | Notes                                              |
|-------------|-------------------------------------|----------------------------------------------------|
| `id`        | —                                   | Surrogate PK.                                      |
| `week_id`   | —                                   | FK → `weeks.id`; cascade-deletes on week removal. |
| `date`      | `PlanDay.date`                      | ISO date string stored as `date`.                  |
| `status`    | `PlanDay.status`                    | `'planned' \| 'completed' \| 'missed' \| 'modified'`. |
| `payload`   | full `PlanDay` object               | JSON blob: `{ date, status, primary?, secondary? }`. |
| `created_at`| —                                   | Immutable after insert.                            |
| `updated_at`| —                                   | Auto-updated by trigger on every `UPDATE`.         |

`initWeek` inserts one row per day (up to 7). `saveWeekPlan` upserts by
`(week_id, date)`. `markMissed` updates `status` to `'missed'` for the
relevant row, which triggers the `updated_at` stamp.

The partial index on `status IN ('planned', 'missed')` accelerates the common
query pattern of finding outstanding or skipped days.

---

### `completed_sessions`

Corresponds to the `CompletedSession` objects appended by `logCompletedSession`.

| Column      | TypeScript source           | Notes                                              |
|-------------|-----------------------------|----------------------------------------------------|
| `id`        | —                           | Surrogate PK.                                      |
| `week_id`   | —                           | FK → `weeks.id`; resolved from `weekStartISO`.    |
| `date`      | `CompletedSession.date`     | ISO date of the session.                           |
| `payload`   | full `CompletedSession`     | JSON blob: `{ id, date, type, durationMinutes, rpe, load, notes? }`. |
| `created_at`| —                           | Append-only; no `updated_at`.                     |

This table is intentionally append-only – sessions are never edited after
logging, matching the store contract where `logCompletedSession` only appends.

---

### `decision_logs`

Corresponds to the `decisionLog: DecisionLog[]` array inside
`WeekPlanSnapshot`, plus any mid-week logs appended by adjusters.

| Column      | TypeScript source           | Notes                                                       |
|-------------|-----------------------------|------------------------------------------------------------|
| `id`        | —                           | Surrogate PK.                                              |
| `week_id`   | —                           | FK → `weeks.id`.                                          |
| `source`    | —                           | Sub-system that produced the log, e.g. `'planGenerator'`, `'missAdjuster'`. |
| `entries`   | `DecisionLog[]`             | JSON array: `[{ rule, message, severity }]`.              |
| `created_at`| —                           | Append-only; no `updated_at`.                             |

`initWeek` inserts one row (source = `'planGenerator'`) containing all
decision log entries from the initial plan generation. Mid-week adjustments
(e.g. from `missAdjuster`) insert additional rows so the audit trail is
preserved chronologically rather than overwritten.

---

## Indexes

| Index                              | Purpose                                                 |
|------------------------------------|---------------------------------------------------------|
| `idx_weeks_user_key`               | Filter weeks by user in multi-user deployments.         |
| `idx_weeks_week_start`             | Range queries (e.g. last N weeks).                      |
| `idx_plan_days_week_id`            | Join from weeks → plan_days.                            |
| `idx_plan_days_date`               | Look up a specific day across all weeks.                |
| `idx_plan_days_status (partial)`   | Fast scan of only `planned`/`missed` days.              |
| `idx_completed_sessions_week_id`   | Join from weeks → completed_sessions.                   |
| `idx_completed_sessions_date`      | Look up sessions on a specific date.                    |
| `idx_decision_logs_week_id`        | Join from weeks → decision_logs.                        |

---

### `user_settings`

Stores per-user training preferences. One row per user; upserted on save.
Introduced in `supabase/migrations/003_user_settings.sql`.

| Column           | TypeScript source                   | Notes                                                  |
|------------------|-------------------------------------|--------------------------------------------------------|
| `user_id`        | —                                   | PK; references `auth.users`. Defaults to `auth.uid()`. |
| `focus`          | `UserSettings.focus`                | Training goal: `'triathlon'`, `'hyrox'`, etc.          |
| `weekly_minutes` | `UserSettings.weeklyMinutes`        | Total training time budget per week.                   |
| `equipment`      | `UserSettings.equipment`            | JSON: `{ gym, trainer, pool, outdoorRun }` booleans.   |
| `created_at`     | —                                   | Set once on first upsert.                              |
| `updated_at`     | —                                   | Auto-updated by trigger on every UPDATE.               |

API: `GET /api/settings` returns defaults if no row exists; `POST /api/settings` upserts.

---

## `user_key` and multi-user extension

All tables that need isolation carry `user_key` on the `weeks` row (child
tables inherit isolation via the FK). In single-user or offline mode the
default value `'local'` is used. To extend to authenticated users, set
`user_key` to the Supabase Auth `uid` and add a Row Level Security policy
such as:

```sql
alter table weeks enable row level security;

create policy "users see own weeks" on weeks
  for all using (user_key = auth.uid()::text);
```
