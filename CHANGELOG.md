# Changelog

---

## v1.1.0 — 9 Mar 2026

### Friend Detail — Full Overhaul

The friend detail screen was rebuilt across several passes:

- **Settlement UI redesigned** — settlement entries are now thin neutral-line dividers with prose text ("you paid Rahul ₹500 on 4 Mar") instead of green/red cards; no directional colour since the amount already implies direction
- **Tappable settlement rows** — tap any settlement to open `EditSettlementSheet` and correct the amount or add notes; backed by `updateSettlement` in `useSettlements`
- **Phase boundary logic** rewritten twice: first to a settlement-based boundary detection (first settlement encountered walking newest→oldest), then to a **running balance walk** — subtracts each transaction's balance impact until the running total hits zero, making partial settlements no longer create false boundaries
- **Category icons** with category-colour backgrounds on expense rows (receipt-outline fallback); `category_icon` and `category_color` returned from the `get_friend_transactions` RPC via `LEFT JOIN categories`
- **Group context label** hidden for 1:1 direct groups; people icon + group name shown only for genuine multi-person groups (`group_type` field added to RPC and `FriendTransaction` type)
- **"View history" for fully-settled users** — `promoteCurrentPhase` moves the hidden current phase into `olderPhases` so a fully-settled pair can still browse past expenses; "View history" button replaces "View older expenses" in that state
- Shared groups section shows transaction count only ("4 transactions"); removed the per-group balance display that was misleading since group balances don't auto-settle
- Cursor-based pagination for transaction history (100 tx/page) via updated `get_friend_transactions` RPC; `use-friend-detail` migrated to `useInfiniteQuery`

### Friend Detail — FlashList Refactor

- Nested `olderPhases.map(phase => phase.map())` replaced with a flat `FriendActivityItem` discriminated-union array (`transaction | view_older | fully_settled | empty_transactions`) driven by a single `FlashList`
- Friend card, shared groups section, and "All Transactions" header moved into `ListHeaderComponent`; `ScrollView` removed entirely
- `getItemType` prevents cross-type cell recycling jitter

### Filter Scrubber

- **Friends tab**: floating frosted-glass pill above the tab bar with four states — Everyone / Outstanding / I Owe / They Owe; all friends now fetched and filtering applied client-side so every state responds instantly
- Collapsed state shows coloured ambient-glow dots; tap to expand; drag finger to switch — highlight tracks the finger directly on the UI thread (no spring lag); haptic on each switch
- Auto-hides on scroll-down, reappears on scroll-up; auto-collapses 500 ms after release
- **Made generic** — `FilterScrubber` accepts a `filters: FilterOption[]` prop; sizing (collapsed width, expanded width, item width) derived dynamically from `filters.length`; `FRIEND_FILTERS` and `GROUP_FILTERS` exported as constants

### Group Detail — New Components

- **Balance Spectrum Bar** — plots each member's net position on a continuous red→green gradient track (HSL-corrected formula); avatar bubbles stack when nearby; tap a bubble or stack to reveal an animated floating tooltip showing name + colour-coded amount; tooltip opens upward to avoid overlapping the Activity section
- **Settle-up bottom sheet** — `GroupSettleSheet` lists every group member's net *global* balance (across all shared expenses, not just the current group), making it clear why the settle amount may differ from the group view; left side of each row navigates to friend detail; right side pre-fills the settle-up screen
- Contributions section redesigned: stacked `ContributionBar` removed, `BalanceSpectrumBar` kept, total displayed as "Contributions ₹X" in the section header
- **Settle button** moved from the Activity header into the Group Info Card (only shown when group has 2+ members)
- Settlement entries removed from the group activity list — settlements belong to friend detail only

### Group Detail — Polish & Fixes

- Group Info card shown to all members; admins get tappable avatar (change/remove photo) and inline name editing; members get read-only view
- Admin badge now uses `member.role` instead of `created_by`; Delete Group and all admin actions unified under `isAdmin`
- Settlement entries and ContributionBar removed; activity list is expenses only
- "Not involved" label on expense rows where the current user has no share (instead of dimming the entire row)
- Fix: `ListHeaderComponent` passed as pre-rendered JSX element so `MotiView` stays mounted across re-renders and header animations don't retrigger on every background refetch

### Groups — Phase / Archive System

- **Archive current expenses** in Group Settings — inserts a `group_checkpoint` record (any group member can archive)
- **Phase-aware contributions and balance spectrum** — totals and spectrum bar reflect only the current phase (expenses after the latest checkpoint), powered by `get_group_phase_balances` RPC
- **Checkpoint dividers** inline in the activity list — `"[Name] archived on [date]"` — tappable to remove if added by mistake
- **"All archived" empty state card** when the current phase has no expenses; embeds the first "View older" tap to avoid a dead end
- **"View older expenses"** reveals phases one at a time
- **Server-side pagination** — expenses load 50 at a time via `useInfiniteQuery`; "Load more" row appended when more pages exist
- **Archive guard** — disabled (with updated subtitle) when the current phase is already empty
- **Auto-navigate back** to group detail after archiving; immediate refetch on focus prevents stale flash

### Groups — List Screen

- **Last active timestamp** replaces balance amounts — relative: "Just now", "3 hours ago", "Yesterday", "5 days ago", "2 months ago", "1 year ago"
- **Staleness colour interpolation** — timestamp fades from neutral to `#EA580C` over 28 days, converging with the "All archived" badge colour
- **All · Active · Archived filter tabs** via the generic floating scrubber; default is Active
- **"All archived" badge** on cards with no active phase — replaces the timestamp
- **Pull-to-refresh** now brings the header down with the content (iOS mental model, consistent with Friends tab)
- Filter-aware empty states for Active / Archived / All / Offline
- `get_group_active_status` RPC — single query returning `is_active` for all user groups; `has_active_phase` added to `GroupListItem`
- `last_activity` uses `GREATEST(updated_at, latest checkpoint created_at)` so archiving moves the group to the top

### Add Expense

- Split member search replaced with `PeopleSearchSheet` bottom sheet — consistent with group creation
- Fixed back navigation firing 200 ms too early (during sheet close animation)

### Contacts & Avatars

- Unified `Avatar` component across all screens — ~300 lines of duplicated avatar rendering removed
- `useEnrichedContacts` extracted as a shared data foundation for all contact-aware screens
- Group creation shows contact profile photos in the selected-members chip list

### Performance — FlashList Migration

Replaced every `FlatList` with `@shopify/flash-list` (v2.0.2). FlashList recycles native cell containers rather than only virtualising the React tree, eliminating JS-thread jank on fast flings (especially on Android).

**Direct replacements:**
- `app/(tabs)/groups.tsx`
- `app/(tabs)/friends.tsx`
- `app/group/[id]/index.tsx`
- `components/ui/country-picker.tsx`
- `components/people-search-sheet.tsx` — `BottomSheetFlatList` → `BottomSheetFlashList`

**New adoptions** (previously `ScrollView + .map()`):
- `app/(tabs)/index.tsx` — activity feed lifted into `renderItem`; header, balance card, and quick actions moved to `ListHeaderComponent`
- `app/settle-up.tsx` — search results `ScrollView` replaced with `FlashList`; `keyboardShouldPersistTaps="handled"` added
- `app/friend/[id].tsx` — see Friend Detail section above

All mixed-type lists (`group/[id]/index.tsx`, `friend/[id].tsx`, `people-search-sheet.tsx`) include `getItemType` so FlashList maintains separate recycling pools per item shape, preventing cross-type cell-reuse jitter on fast scroll.

### Architecture

- `EditSettlementSheet` component
- `BalanceSpectrumBar` component
- `GroupSettleSheet` component
- `PeopleSearchSheet` — unified bottom sheet replacing `ContactPickerSheet`; supports single-select (add expense), multi-select (group creation), and groups+contacts mode
- `useGroupPhases` hook — manages phase splitting, checkpoints, phase-aware balances, pagination, mutations
- `useSettlements` hook — `createSettlement` and `updateSettlement`
- `useEnrichedContacts` hook
- `useExpenses` migrated to `useInfiniteQuery` (pages of 50)
- `useFriendDetail` migrated to `useInfiniteQuery` with cursor pagination
- `group_checkpoints` table with RLS (any group member can create or delete)
- `get_group_phase_balances(p_group_id, p_after_ts)` RPC
- `get_group_active_status(p_user_id)` RPC
- `get_friend_transactions` RPC updated with `category_icon`, `category_color`, `group_type` fields
- `20260307000000_friend_transactions_pagination` migration — cursor-based pagination support
- Query key versioning (`expenses.v2`) to bust stale cache after hook refactor

---

## v1.0.0 — 3 Feb 2026

Initial stable release.

- OTP-based phone authentication
- Friends list with net balance summary
- Friend detail with transaction history and settlement creation
- Groups with expense tracking, equal and custom splits, category picker
- Group detail with member list and expense activity feed
- Home screen with recent activity feed and balance summary
- Offline view-only mode with sync queue for pending actions
- Supabase Realtime sync
- PostHog analytics
- Haptic feedback, spring animations, skeleton loaders, empty states
- Photo upload for profiles and groups
- Settings screen
