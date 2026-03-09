# Changelog

---

## v1.1.0 — 9 Mar 2026

### Groups — Phase / Archive System
The biggest addition this cycle. Groups now support explicit phase boundaries that work identically to the settlement history in friend detail.

- **Archive current expenses** action in Group Settings — inserts a `group_checkpoint` record authored by any group member
- **Phase-aware contributions and balance spectrum** — the contributions total and spectrum bar reflect only the current phase (expenses after the latest checkpoint), powered by the `get_group_phase_balances` RPC
- **Checkpoint dividers** inline in the activity list — `"[Name] archived on [date]"` — tappable to remove if added by mistake
- **"All archived" empty state card** when the current phase has no expenses — mirrors the "All settled up!" card in friend detail
- **"View older expenses"** button reveals phases one at a time; the card embeds the first tap so there's never a dead end
- **Server-side pagination** — expenses load 50 at a time via `useInfiniteQuery`; "Load more expenses" row at the bottom when more pages exist
- **Archive guard** — the Archive action in settings is disabled (with an updated subtitle) when the current phase is already empty
- **Auto-navigate back** to group detail after archiving, with an immediate refetch on focus so stale expenses don't flash

### Groups — List Screen
- **Last active timestamp** replaces balance amounts — relative format: "Just now", "3 hours ago", "Yesterday", "5 days ago", "2 months ago", "1 year ago"
- **Staleness colour interpolation** — timestamp colour drifts from neutral to orange-red (`#EA580C`) over 28 days, converging on the same hue as the archived badge to signal dormancy
- **All · Active · Archived filter tabs** via the same floating scrubber as the friends screen — default is Active (mirrors friends defaulting to Outstanding)
- **"All archived" badge** on cards where the current phase is empty — replaces the timestamp, same orange-red for visual consistency
- `get_group_active_status` RPC — single efficient query that returns `is_active` for all of the user's groups; `has_active_phase` field added to `GroupListItem`
- `last_activity` now uses `greatest(updated_at, latest checkpoint)` so archiving bumps the group to the top of the list

### Friends — Detail Screen
- Shared groups section cleaned up — shows transaction count only ("4 transactions"); removed the "owes you / you owe / Settled" balance display that was misleading since group balances don't auto-settle

### Filter Scrubber — Now Generic
- `FilterScrubber` now accepts a `filters: FilterOption[]` prop instead of a hardcoded friends-only config
- Sizing (collapsed width, expanded width, item width) derived dynamically from `filters.length`
- `FRIEND_FILTERS` and `GROUP_FILTERS` exported as named constants — zero behaviour change for the friends screen

### Add Expense
- Split member search replaced with `PeopleSearchSheet` bottom sheet — consistent with the unified people-search used in group creation
- Fixed back navigation firing 200 ms too early (during sheet close animation)

### Contacts & Avatars
- Unified `Avatar` component used across all screens — removed ~300 lines of duplicated avatar rendering
- `useEnrichedContacts` extracted as a shared data foundation for contact-aware screens
- Group creation now shows contact profile photos in the selected members list

### Architecture
- `useGroupPhases` hook — manages phase splitting, checkpoints, phase-aware balances, pagination, and mutations
- `useExpenses` migrated from `useQuery` to `useInfiniteQuery` (pages of 50)
- `group_checkpoints` table with RLS policies (any group member can create or delete)
- `get_group_phase_balances(p_group_id, p_after_ts)` RPC
- `get_group_active_status(p_user_id)` RPC
- Query key versioning (`expenses.v2`) to bust stale cache after hook refactor

---

## v1.0.0 — 3 Feb 2026

Initial stable release.

- OTP-based phone authentication
- Friends list with net balance summary
- Friend detail with transaction history, phase-based settlement view, and settlement creation / editing
- Groups with expense tracking, equal and custom splits, category picker
- Group detail with contributions chart, balance spectrum bar, and settle-up sheet
- Home screen with recent activity feed and balance summary
- Offline view-only mode with sync queue for pending actions
- Supabase Realtime sync
- PostHog analytics
- Haptic feedback, spring animations, skeleton loaders, empty states
- Photo upload for profiles and groups
- Settings screen
