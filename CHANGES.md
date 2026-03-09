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

### Phase / "Mark as Done" system

- [ ] Tapping "Mark phase as done" in settings inserts a `group_checkpoint` record with `group_id`, `created_by`, `created_at`
- [ ] This acts as a **phase boundary** — identical mental model to settlements in friend detail
- [ ] **Current phase**: all expenses after the most recent checkpoint (or all if no checkpoint)
  - Spectrum bar and total contribution reflect **current phase only**
- [ ] **Older phases**: expenses between two checkpoints — collapsed, revealed one phase at a time via "View older" (same UX as friend detail's `loadOlderPhase`)
- [ ] Each checkpoint renders as an inline divider in the activity list (styled like friend detail's settlement divider):
  `——— marked as done · 12 Mar ———`
  Tappable to **remove** the marker if added by mistake (prompts confirmation)
- [ ] "View older" button appears below current phase when older phases exist
- [ ] Removing a checkpoint merges its two adjacent phases back into one

### Pull-to-refresh / data
- [ ] `useExpenses` or a new `useGroupPhases` hook needs to be aware of checkpoints to split the list

---

## 3. Friends Detail Screen (`app/friend/[id].tsx`)

### Shared Groups section
- [ ] Remove "OWES YOU ₹X" / "YOU OWE ₹X" balance labels from each shared group card
- [ ] Remove the "Settled" badge
- [ ] Replace with **transaction count only**: "4 transactions"
  - If the group has been marked as done (all phases closed), show **"0 active transactions"** or just "completed"
- [ ] Remove the chevron `>` — or keep it if navigating to group detail is still desired (keep for now)
- [ ] No monetary amounts anywhere in the shared groups list — eliminates the misleading partial-balance confusion

---

## 4. Database / Backend (`supabase/migrations/`)

- [ ] New table (or column): `group_checkpoints`
  ```sql
  create table group_checkpoints (
    id          uuid primary key default gen_random_uuid(),
    group_id    uuid not null references groups(id) on delete cascade,
    created_by  uuid not null references users(id),
    created_at  timestamptz not null default now(),
    note        text
  );
  ```
- [ ] `groups` list query: add `last_activity_at` — `greatest(max(expense_date), max(checkpoint.created_at))`
- [ ] Group detail query: return checkpoints alongside expenses so the client can interleave them and split into phases
- [ ] `useGroup` or new `useGroupPhases` hook: phases derived by splitting the flat expense+checkpoint list at each checkpoint boundary

---

## 5. New / Modified Hooks

- [ ] `useGroupPhases` (new) — mirrors `useFriendDetail` phase logic:
  - `currentPhase`: expenses after latest checkpoint
  - `olderPhases`: array of phases (each an array of expenses), paginated
  - `checkpoints`: list of checkpoint records for rendering dividers
  - `hasMoreOlder`, `loadOlderPhase`, `removeCheckpoint`
- [ ] `useGroups` — add `last_activity_at` to `GroupListItem` type

---

## Change Order (suggested implementation sequence)

1. DB migration — `group_checkpoints` table + update groups query for `last_activity_at`
2. `useGroups` hook — update `last_activity_at` query once checkpoints exist
3. ~~**Group list** — swap balance display for relative timestamp~~ ✅ done
4. `useGroupPhases` hook — phase splitting logic
5. **Group detail** — merge Contributions+Balance, replace expense wording, wire up phases + checkpoints + Mark as Done
6. **Friends detail** — simplify shared groups cards (remove balances, show transaction count)
