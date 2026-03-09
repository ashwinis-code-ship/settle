# Planned Changes Tracker

Tracks all agreed UI and logic changes across three screens.  
Status: `[ ]` pending · `[~]` in progress · `[x]` done

---

## 1. Group List Screen (`app/(tabs)/groups.tsx`)

### UI
- [x] Remove balance amounts entirely — no "you owe", "you are owed", "settled" badge per card
- [x] Replace balance area with **last activity timestamp** (relative, right-aligned):
  - Today / Yesterday / N days ago (up to 30)
  - 1 month ago → N months ago (up to 12)
  - 1 year ago → N years ago
- [x] Timestamp uses existing `last_activity` field (mapped from `groups.updated_at`)

### Logic
- [x] `last_activity` already exists in `GroupListItem` — using `groups.updated_at` for now
- [ ] Once `group_checkpoints` table exists, update `fetchGroups` to use `greatest(max(expense_date), max(checkpoint.created_at))` as `last_activity_at`

---

## 2. Group Details Screen (`app/group/[id]/index.tsx`)

### Wording / Terminology
- [x] Groups are **tracking contexts**, not settlement contexts — purge settlement language
- [x] In expense list items, the amount column always shows the **expense total** — group-level fact, visible to all members regardless of inclusion
- [x] The second line (below description) shows personal context only:
  - **Included in split** → "your share ₹X" in `secondaryTextColor` (neutral, no green/red). Payer's share derived as `amount / split_count`; non-payer share from `your_share` field
  - **Not included in split** → second line absent; row dimmed to 50% opacity; icon tile background becomes flat `gray[700]` (dark) / `gray[200]` (light); icon forced to receipt outline in muted gray
- [x] Removed "you lent ₹X" and "you owe ₹X" — those are friends-screen concepts

### Contributions + Balance — merge into one section
- [x] **Remove** the `ContributionBar` (horizontal stacked colour bar + legend)
- [x] Keep the `BalanceSpectrumBar` — it already shows who paid more/less
- [x] Rename the section to **"Contributions"** (was "Balance")
- [x] Show the **total group spend** right-aligned in the section header
- [x] Net result: one card, one section title "Contributions  ₹41,106", spectrum bar below it

### Button placement — mirrors friend detail pattern

| Zone | Actions |
|---|---|
| Group info card | **Settle** button (outlined, only when members > 1) — opens `GroupSettleSheet` |
| Activity section header | **+ Add** only |
| Settings screen | Rename · Manage members · **Mark phase as done** · Delete group |

- [x] Move **"Settle"** out of the Activity header and into the Group Info Card as an outlined action button
- [x] Activity header row becomes **"+ Add" only** — no other buttons
- [x] Add **"Mark phase as done"** as a prominent action in `app/group/[id]/settings.tsx` (stub — wired up once DB migration lands)

### Phase / "Archive" system

- [x] Tapping "Archive current expenses" in settings inserts a `group_checkpoint` record with `group_id`, `created_by`, `created_at`
- [x] This acts as a **phase boundary** — identical mental model to settlements in friend detail
- [x] **Current phase**: all expenses after the most recent checkpoint (or all if no checkpoint)
  - Spectrum bar and total contribution reflect **current phase only** (via `get_group_phase_balances` RPC)
- [x] **Older phases**: expenses between two checkpoints — collapsed, revealed one phase at a time via "View older expenses"
- [x] Each checkpoint renders as an inline divider: `——— [Name] archived on [date] ———`
  Tappable to **remove** the marker if added by mistake (prompts confirmation)
- [x] "View older expenses" button appears whenever older phases exist (even after new expenses added post-archive)
- [x] Removing a checkpoint merges its two adjacent phases back into one (automatic — purely computed)
- [x] "All archived" empty state card shown when current phase is empty (mirrors friend detail's "All settled up!" card)
- [x] Server-side pagination — expenses fetched 50 at a time via `useInfiniteQuery`; "Load more expenses" row at bottom when more pages exist
- [x] Settings: button disabled + subtitle updated when current phase is already empty (nothing to archive)
- [x] After archiving, navigates back to group detail and immediately refetches via `useFocusEffect`

### Pull-to-refresh / data
- [x] `useGroupPhases` hook (new) handles checkpoints, phase splitting, phase-aware balances, and mutations

---

## 3. Friends Detail Screen (`app/friend/[id].tsx`)

### Shared Groups section
- [x] Remove "OWES YOU ₹X" / "YOU OWE ₹X" balance labels from each shared group card
- [x] Remove the "Settled" badge
- [x] Show **transaction count only**: "4 transactions" (already present in data)
- [x] Keep the chevron `>` for navigating to group detail
- [x] No monetary amounts anywhere in the shared groups list

---

## 4. Database / Backend (`supabase/migrations/`)

- [x] `group_checkpoints` table — migration applied (`add_group_checkpoints`)
- [x] `get_group_phase_balances` RPC — returns per-member balance scoped to a phase window (`add_get_group_phase_balances_rpc`)
- [x] `groups` list query: `last_activity` now uses `greatest(groups.updated_at, max(expense.created_at), max(checkpoint.created_at))` — updated in `fetchGroups`
- [x] Group detail: checkpoints fetched alongside expenses via `useGroupPhases` hook; phase splitting done client-side

---

## 5. New / Modified Hooks

- [x] `useGroupPhases` (new) — `currentPhase`, `olderPhases`, `checkpoints`, `hasMoreOlder`, `loadOlderPhase`, `removeCheckpoint`, `addCheckpoint`, `isCurrentPhaseEmpty`, server-side pagination via `useInfiniteQuery`
- [x] `useExpenses` — refactored to `useInfiniteQuery` (pages of 50); exposes `hasMoreExpenses`, `loadMoreExpenses`, `isFetchingMore`
- [x] `useGroups` — `last_activity` updated to incorporate latest checkpoint timestamp

---

## Change Order (suggested implementation sequence)

1. DB migration — `group_checkpoints` table + update groups query for `last_activity_at`
2. `useGroups` hook — update `last_activity_at` query once checkpoints exist
3. ~~**Group list** — swap balance display for relative timestamp~~ ✅ done
4. `useGroupPhases` hook — phase splitting logic
5. **Group detail** — merge Contributions+Balance, replace expense wording, wire up phases + checkpoints + Mark as Done
6. **Friends detail** — simplify shared groups cards (remove balances, show transaction count)
