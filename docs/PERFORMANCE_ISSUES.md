# Performance Issues Tracker

Identified: 9 Mar 2026  
Current version: **v1.1.0**  
Target version after all fixes: **v1.2.0** *(see rationale at bottom)*

Issues are grouped by priority. Each entry has a problem description, root cause, measurable impact, and a concrete fix.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 P0 | Critical — visible latency or wasted network, fix first |
| 🟠 P1 | High — unnecessary re-renders or inefficient computation |
| 🟡 P2 | Medium — correctness or subtle performance risk |
| 🟢 P3 | Low — polish / minor memory savings |

---

## 🔴 P0 — Critical

---

### P0-1 · N+1 query loop in `fetchFriends`

**File:** `hooks/use-friends.ts` — the `for...of` loop starting around line 80

**Problem:**  
For each friend discovered in shared groups, two sequential Supabase calls are made:
1. `supabase.rpc('calculate_balance_between_users', { user1_id, user2_id })` — computes pairwise balance
2. `supabase.from('expenses').select('created_at').in('group_id', ...).or('paid_by.eq...').order(...).limit(1)` — finds last activity

These run in a `for...of` loop (sequential, not parallel). For a user with **25 friends** this is **3 setup queries + 50 per-friend queries = 53 total round-trips** on every Friends tab load. `refetchOnMount: 'always'` means every tab switch fires all 53.

**Measurable impact:** On a 50ms average round-trip, 25 friends = ~2.5 s of sequential network time just to render the friends list. On mobile networks this compounds to 5–10 s.

**Fix:**  
Create a single `get_all_friend_balances(p_user_id UUID)` Supabase RPC that:
- Joins `group_members → expenses → expense_splits → settlements` in one query
- Returns `(friend_id UUID, friend_name TEXT, avatar_url TEXT, balance DECIMAL, last_activity_at TIMESTAMPTZ)`

Replace the entire per-friend loop with one RPC call:
```typescript
const { data } = await supabase.rpc('get_all_friend_balances', { p_user_id: user.id });
```
The hook then maps the returned rows directly to `FriendWithBalance[]`. Total: **1 query** instead of 3 + 2N.

**Migration required:** New Supabase RPC + migration file.

---

### P0-2 · N parallel queries for group balances in `fetchGroups`

**File:** `hooks/use-groups.ts` — `const balancePromises = groupIds.map(async (groupId) => { ... })` block

**Problem:**  
For each group the user belongs to, one separate `group_balances` query is fired:
```typescript
supabase.from('group_balances').select('*').eq('group_id', groupId).eq('user_id', userId).single()
```
These run with `Promise.all` (parallel), which avoids sequential stall but still creates N simultaneous database connections. For a user in 15 groups = 15 network round-trips on every Groups tab load.

**Fix:**  
Replace with a single `.in()` query:
```typescript
const { data: allBalances } = await supabase
  .from('group_balances')
  .select('*')
  .in('group_id', groupIds)
  .eq('user_id', userId);
```
Then build a `Map<string, GroupBalance>` from the result and look up each group synchronously. Total: **1 query** instead of N.

**No migration required** — `group_balances` table already exists with the right columns.

---

### P0-3 · Unbounded expenses fetch in `fetchFriendDetail`

**File:** `hooks/use-friend-detail.ts` — the `supabase.from('expenses').select(...)` block around line 229

**Problem:**  
To compute per-group balance summaries shown in the "Shared Groups" section of Friend Detail, the hook fetches ALL historical expenses across ALL shared groups with ALL expense splits eagerly loaded as nested relations — no `LIMIT`. For a long-standing pair of friends in multiple groups:
- 500 expenses × 4 splits each = **2,000 rows materialised in one response payload**
- All loaded just to show "₹1,200 balance" on two group cards

**Fix:**  
Create a `get_friend_group_balances(p_user1_id, p_user2_id)` RPC that returns:
```sql
SELECT
  g.id, g.name, g.image_url,
  SUM(CASE WHEN e.paid_by = p_user1_id AND es.user_id = p_user2_id THEN es.amount
           WHEN e.paid_by = p_user2_id AND es.user_id = p_user1_id THEN -es.amount
           ELSE 0 END) AS balance,
  COUNT(DISTINCT e.id) AS transaction_count
FROM groups g
JOIN expenses e ON e.group_id = g.id
JOIN expense_splits es ON es.expense_id = e.id
...
GROUP BY g.id, g.name, g.image_url
```
Replace the multi-step expenses fetch + JS-side aggregation with:
```typescript
const { data } = await supabase.rpc('get_friend_group_balances', {
  p_user1_id: user.id,
  p_user2_id: friendId,
});
```
**Migration required:** New Supabase RPC + migration file.

---

## 🟠 P1 — High

---

### P1-1 · `useFocusEffect` bypasses `staleTime` on every tab switch

**Files:**  
- `app/(tabs)/index.tsx` — `useFocusEffect` block calling `refresh()`
- `app/(tabs)/friends.tsx` — same pattern
- `app/(tabs)/groups.tsx` — same pattern
- `app/group/[id]/index.tsx` — calls `refreshGroup()` + `refreshPhases()` (which internally fires 4 network requests)

**Problem:**  
Each screen calls `refresh()` unconditionally inside `useFocusEffect`. This fires a full network refetch on every tab navigation — including immediately after a navigation that returned from a push route (e.g., group detail → settings → back to group detail). React Query's `staleTime` is completely bypassed.

The group detail screen is especially bad: `refreshPhases()` internally calls `refreshExpenses()` + `refetchCheckpoints()` + `refetchBalances()` in parallel = **4 simultaneous requests** on every back-navigation.

**Fix:**  
Replace unconditional `refresh()` with a staleness check:
```typescript
useFocusEffect(
  useCallback(() => {
    const query = queryClient.getQueryState(queryKeys.friends);
    const isStale = !query?.dataUpdatedAt ||
      Date.now() - query.dataUpdatedAt > STALE_THRESHOLD_MS; // e.g. 30_000
    if (isStale) refresh();
  }, [queryClient, refresh])
);
```
Or remove manual `useFocusEffect` refreshes entirely and configure React Query's built-in `refetchOnWindowFocus: true` with an appropriate `staleTime` in `lib/query-client.ts`.

---

### P1-2 · N parallel RPCs in `GroupSettleSheet`

**File:** `components/group-settle-sheet.tsx` — `Promise.all(otherMembers.map(...))` block around line 88

**Problem:**  
When the settle-up sheet opens, one `calculate_balance_between_users` RPC is fired per other group member in parallel:
```typescript
await Promise.all(
  otherMembers.map(member =>
    supabase.rpc('calculate_balance_between_users', { user1_id, user2_id: member.user_id })
  )
);
```
For a group of 8: **8 simultaneous RPCs**. While parallel, this still saturates the connection pool and delays sheet open time on slow networks.

**Fix:**  
Create a single `get_group_member_balances(p_group_id UUID, p_user_id UUID)` RPC:
```sql
SELECT
  gm.user_id, u.name, u.avatar_url,
  calculate_balance_between_users(p_user_id, gm.user_id) AS balance
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = p_group_id AND gm.user_id != p_user_id
```
Or inline the balance logic directly to avoid N sub-function calls. Total: **1 RPC** instead of N.

**Migration required:** New Supabase RPC + migration file.

---

### P1-3 · `renderFriendCard` / `renderGroupCard` / `renderTransactionItem` not wrapped in `useCallback`

**Files:**  
- `app/(tabs)/friends.tsx` — `renderFriendCard` function (~line 149)
- `app/(tabs)/groups.tsx` — `renderGroupCard` function (~line 165)
- `app/friend/[id].tsx` — `renderTransactionItem` function (~line 302), `renderGroupCard` function (~line 210)

**Problem:**  
These functions are passed as `renderItem` (and indirectly to `renderFriendActivityItem`) to FlashList. Since they are plain `const` functions recreated on every component render, FlashList sees a new `renderItem` reference on every render and invalidates all visible cell memoization — causing every list item to re-render unnecessarily even when its data hasn't changed.

`renderTransactionItem` is particularly bad: it's called inside `renderFriendActivityItem` (a `useCallback`), which lists `renderTransactionItem` as a dep. So `renderFriendActivityItem` itself gets a new reference every render, meaning the entire FlashList re-renders on every state change in `FriendDetailScreen` (e.g., bottomsheet open/close, loading states, editAmount changes).

**Fix:**  
Wrap each in `useCallback`:
```typescript
// friends.tsx
const renderFriendCard = useCallback(({ item }: { item: FriendWithBalance }) => (
  // ... existing JSX
), [isDark, textColor, secondaryTextColor, cardBg, handleFriendPress, handleAddExpense]);

// groups.tsx  
const renderGroupCard = useCallback(({ item }: { item: GroupListItem }) => (
  // ... existing JSX
), [isDark, textColor, secondaryTextColor, cardBg, handleGroupPress]);

// friend/[id].tsx
const renderTransactionItem = useCallback((tx: FriendTransaction, listIndex: number) => (
  // ... existing JSX
), [friend?.user.name, params.name, cardBg, textColor, secondaryTextColor,
   settlementLineColor, settlementTextColor, handleTransactionPress, handleSettlementPress]);
```

---

### P1-4 · Heavy inline computations in `friends.tsx` render body

**File:** `app/(tabs)/friends.tsx` — `totalOwed` / `totalOwe` calculations in `renderSummary`

**Problem:**  
Two `.reduce()` calls run on the full `friends` array on every render of `FriendsScreen`, inside the `renderSummary` function that is itself recreated every render:
```typescript
const totalOwed = friends
  .filter(f => f.total_balance > 0)
  .reduce((sum, f) => sum + f.total_balance, 0);
const totalOwe = friends
  .filter(f => f.total_balance < 0)
  .reduce((sum, f) => sum + Math.abs(f.total_balance), 0);
```

Two separate filter+reduce passes where one would do.

**Fix:**  
Add a `useMemo` at the top of the component:
```typescript
const { totalOwed, totalOwe } = useMemo(() =>
  friends.reduce(
    (acc, f) => {
      if (f.total_balance > 0) acc.totalOwed += f.total_balance;
      else if (f.total_balance < 0) acc.totalOwe += Math.abs(f.total_balance);
      return acc;
    },
    { totalOwed: 0, totalOwe: 0 }
  ),
  [friends]
);
```

---

### P1-5 · `filteredCountries` computed inline without `useMemo`

**File:** `components/ui/country-picker.tsx` — `const filteredCountries = countries.filter(...)` around line 37

**Problem:**  
The world countries list (~250 entries) is filtered on every render of the modal. Each filter call does three `.toLowerCase()` comparisons per entry. This runs:
- On every character typed in the search box (keystroke → state update → render → filter)
- On every unrelated re-render of the modal (e.g., parent updates)

**Fix:**  
```typescript
const filteredCountries = useMemo(
  () =>
    countries.filter(
      c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    ),
  [search]
);
```
For extra speed: pre-lowercase country names once at module level with `const COUNTRIES_LOWER = countries.map(c => ({ ...c, nameLower: c.name.toLowerCase() }))`, then compare against `nameLower` instead of calling `.toLowerCase()` on every filter run.

---

### P1-6 · `ItemSeparatorComponent` as inline anonymous function

**Files:**  
- `app/(tabs)/friends.tsx` — `ItemSeparatorComponent={() => <View style={styles.separator} />}`
- `app/(tabs)/groups.tsx` — same pattern

**Problem:**  
FlashList internally renders `ItemSeparatorComponent` as a React element. When the prop is an inline anonymous function, FlashList sees a new component type on every render and unmounts/remounts the separator instead of reconciling it. On a list of 25 friends with 24 separators, this causes 24 unnecessary unmount+remount cycles on every parent re-render.

**Fix:**  
Define the separator as a named component **outside** the screen component function:
```typescript
// Outside FriendsScreen:
const FriendSeparator = () => <View style={styles.separator} />;

// Inside FlashList:
ItemSeparatorComponent={FriendSeparator}
```

---

### P1-7 · `contentContainerStyle` object recreated every render

**Files:**  
- `app/(tabs)/friends.tsx` — `contentContainerStyle={{ ...styles.listContent, paddingBottom: scrubberBottom + 80 }}`
- `app/(tabs)/groups.tsx` — same pattern

**Problem:**  
The spread object `{ ...styles.listContent, paddingBottom: scrubberBottom + 80 }` is a new object on every render. FlashList uses shallow equality on style props — a new object reference causes unnecessary layout recalculations, even when `scrubberBottom` hasn't changed.

**Fix:**  
```typescript
const listContentStyle = useMemo(
  () => ({ ...styles.listContent, paddingBottom: scrubberBottom + 80 }),
  [scrubberBottom]
);
// ...
<FlashList contentContainerStyle={listContentStyle} ... />
```

---

## 🟡 P2 — Medium

---

### P2-1 · Duplicate `useEnrichedContacts` instances on the same screen

**Files:**  
- `components/people-search-sheet.tsx` — calls `useEnrichedContacts()` directly
- `hooks/use-contact-group-search.ts` — also calls `useEnrichedContacts()`
- `app/add-expense.tsx` — mounts `PeopleSearchSheet` AND passes `useContactGroupSearch` result into it

**Problem:**  
When `add-expense.tsx` renders `PeopleSearchSheet`, two separate `useEnrichedContacts` hook instances are active simultaneously on the same screen — one inside the sheet, one in the screen via `useContactGroupSearch`. Since `useEnrichedContacts` manages its own `useState` for contacts (not React Query), both instances independently:
1. Request device contact permissions
2. Fetch and process the system contacts list
3. Query Supabase to match contacts to registered users

Result: potentially 2× device contact reads and 2× `users` table queries while `add-expense.tsx` is open.

**Fix:**  
Fetch `useEnrichedContacts` once in the parent (`add-expense.tsx` or a shared context), pass the enriched contacts down as a prop:
```typescript
// add-expense.tsx
const { enrichedContacts, isLoading } = useEnrichedContacts();
// ...
<PeopleSearchSheet enrichedContacts={enrichedContacts} ... />
```
Remove the internal `useEnrichedContacts` call from both `PeopleSearchSheet` and `useContactGroupSearch` when contacts are passed in.

---

### P2-2 · Async state setters without unmount cancellation

**Files:**  
- `hooks/use-expenses.ts` — the async `useEffect` that calls `setLocalPendingExpenses` (~line 127)
- `hooks/use-settlements.ts` — the async `useEffect` that calls `setLocalPendingSettlements` (~line 92)

**Problem:**  
Both hooks have async `useEffect` callbacks that set state after `await` calls (offline queue reads from AsyncStorage). If the component unmounts before the async operation resolves, React will log a warning about updating state on an unmounted component. In production this can cause subtle bugs if the state setter races with a remount.

**Fix:**  
Add a cancellation flag:
```typescript
useEffect(() => {
  let cancelled = false;
  const load = async () => {
    const pending = await loadFromStorage();
    if (!cancelled) setPending(pending);
  };
  load();
  return () => { cancelled = true; };
}, [groupId, friendId, user]);
```

---

### P2-3 · Missing `estimatedItemSize` on FlashList instances

**Files:**  
- `app/(tabs)/friends.tsx` — `<FlashList data={displayedFriends} ...>`
- `app/(tabs)/groups.tsx` — `<FlashList data={displayedGroups} ...>`
- `app/friend/[id].tsx` — `<FlashList data={activityItems} ...>`

**Problem:**  
Without `estimatedItemSize`, FlashList has to measure every item as it renders to estimate scrollbar position. This causes extra layout passes on first render and an inaccurate scrollbar indicator until all items have been measured.

For friends and groups lists, items are uniform height (~72 px). For friend activity items, heights vary, but an average estimate still helps initial layout.

**Fix:**  
```typescript
// friends.tsx and groups.tsx
<FlashList estimatedItemSize={72} ... />

// friend/[id].tsx (mixed heights — use average)
<FlashList estimatedItemSize={80} ... />
```
Measure actual rendered item heights with `onLayout` if precision matters.

---

### P2-4 · React Query keys not scoped to user ID

**File:** `lib/query-client.ts` — `queryKeys` object

**Problem:**  
Query keys like `['friends']`, `['groups']`, `['activity']` have no user ID. If a user signs out and a different user signs in on the same device without a full app restart, React Query's in-memory cache will briefly serve the previous user's data before the new fetch completes — friends list, groups, and activity feed will flash the wrong user's data.

**Fix:**  
```typescript
// lib/query-client.ts
export const queryKeys = {
  friends: (userId: string) => ['friends', userId] as const,
  groups:  (userId: string) => ['groups',  userId] as const,
  activity:(userId: string) => ['activity',userId] as const,
  // ...
};
```
On sign-out: `queryClient.clear()` to wipe all cached data before the login screen renders.  
All `useQuery` calls update to `queryKeys.friends(user.id)` etc.

---

### P2-5 · `olderPhases.flat()` called inside JSX render

**File:** `app/friend/[id].tsx` — inside `renderListHeader` `useCallback`, the transaction count string

**Problem:**  
```typescript
`${currentPhase.length + olderPhases.flat().length} item${...}`
```
`olderPhases.flat()` creates a new flattened array on every call to `renderListHeader`. While not a hot path, `renderListHeader` is called on every FlashList render cycle.

**Fix:**  
```typescript
const totalTransactionCount = useMemo(
  () => currentPhase.length + olderPhases.reduce((sum, p) => sum + p.length, 0),
  [currentPhase.length, olderPhases]
);
```
Use `reduce` instead of `flat()` to avoid creating an intermediate array.

---

### P2-6 · `renderHeader` / `renderSummary` / `renderEmptyState` not memoized in list screens

**Files:**  
- `app/(tabs)/friends.tsx` — `renderHeader`, `renderSummary`, `renderEmptyState` plain functions
- `app/(tabs)/groups.tsx` — `renderHeader`, `renderEmptyState` plain functions

**Problem:**  
These are passed to `ListHeaderComponent` and `ListEmptyComponent`. Recreating them on every render doesn't directly re-render FlashList's visible items, but it does force React to diff and re-render the header/footer components unnecessarily. `renderSummary` in particular contains `totalOwed`/`totalOwe` calculations (see P1-4).

**Fix:** Wrap all in `useCallback` with appropriate dependency arrays.

---

## 🟢 P3 — Low

---

### P3-1 · No `cachePolicy="memory-disk"` on Avatar images

**File:** `components/ui/avatar.tsx` — the `<Image source={{ uri }} ... />` render

**Problem:**  
`expo-image`'s default `cachePolicy` is `'disk'`. Avatar images that were visible on screen are evicted from memory when the list scrolls, requiring a disk read (or network re-fetch if cache expired) every time the same avatar re-enters the viewport. On a fast scroll up-and-back-down on the friends or groups list, all avatars need to reload from disk.

**Fix:**  
```typescript
<Image
  source={{ uri: imageUrl }}
  style={{ width: size, height: size, borderRadius }}
  contentFit="cover"
  cachePolicy="memory-disk"   // keep recent avatars in RAM
  transition={200}
/>
```

---

### P3-2 · No `recyclingKey` on Avatar inside FlashList cells

**Files:** `app/(tabs)/friends.tsx`, `app/(tabs)/groups.tsx` — any cell that renders `<Avatar>`

**Problem:**  
When FlashList recycles a cell (reuses the native view container for a new item), the `expo-image` inside it might briefly flash the previous item's avatar before the new URL loads — because expo-image doesn't know the cell has been repurposed.

**Fix:**  
Pass the item's unique ID as `recyclingKey` to expo-image:
```typescript
<Image
  source={{ uri: avatarUrl }}
  recyclingKey={item.user.id}   // resets image state on cell recycle
  ...
/>
```
This tells expo-image to treat each new `recyclingKey` as a fresh image, preventing cross-item avatar bleed.

---

### P3-3 · `GestureHandlerRootView` duplicated across multiple screens

**Files:**  
- `app/(tabs)/friends.tsx`
- `app/(tabs)/groups.tsx`
- `app/friend/[id].tsx`
- `app/add-expense.tsx`
- (possibly others)

**Problem:**  
`GestureHandlerRootView` is intended to wrap the entire app once at the root — not be nested in individual screens. Multiple nested instances add unnecessary view tree depth and can cause gesture recognition conflicts between sibling gesture handlers (e.g., bottom sheet drag vs. list scroll).

**Fix:**  
Remove from all screen files. Add one `GestureHandlerRootView style={{ flex: 1 }}` at the app root, likely in `app/_layout.tsx` wrapping the `<Stack>` navigator.

---

### P3-4 · `invalidateQueries` callbacks not stable references

**Files:**  
- `hooks/use-expenses.ts` — `const invalidateQueries = () => { queryClient.invalidateQueries(...) }`
- `hooks/use-settlements.ts` — same pattern

**Problem:**  
Both hooks define `invalidateQueries` as a plain `const` (not `useCallback`), then pass it as `onSuccess` to `useMutation`. TanStack Mutation captures `onSuccess` at the time `useMutation` is called. The instability doesn't cause visible bugs today, but wrapping in `useCallback` makes the intent explicit and is consistent with the rest of the codebase.

**Fix:**  
```typescript
const invalidateRelatedQueries = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
  queryClient.invalidateQueries({ queryKey: queryKeys.friends });
}, [queryClient]);
```

---

### P3-5 · `formatLastActivity` defined inside component in `groups.tsx`

**File:** `app/(tabs)/groups.tsx` — `const formatLastActivity = (dateString: string | null): string => { ... }` defined inside the component body

**Problem:**  
`formatLastActivity` is a pure function with no dependency on component state or props — it only uses its argument and the current time. Defining it inside the component recreates the function reference on every render (minor cost) and bloats the component's closure.

**Fix:**  
Move the function to module scope (outside the `GroupsScreen` component). Same applies to any other pure utility functions defined inline inside screen components.

---

## Implementation Notes

### Recommended implementation order

1. **P0-2** (group balances single query) — 30 min, pure frontend, no migration, highest ROI  
2. **P1-3** (renderItem useCallbacks) — 1 hr, pure frontend, stops cascading FlashList re-renders  
3. **P1-4 + P1-5 + P1-7** (filteredCountries, inline computations, contentContainerStyle) — 1 hr, pure useMemo/useCallback sweeps  
4. **P1-6** (ItemSeparatorComponent) — 15 min, move constants outside components  
5. **P1-1** (useFocusEffect stale check) — 30 min, prevents 4× redundant refetches on tab switch  
6. **P2-3** (estimatedItemSize) — 10 min  
7. **P2-2** (async cleanup) — 30 min  
8. **P2-1** (deduplicate useEnrichedContacts) — 1 hr, requires prop-threading  
9. **P3-1 + P3-2** (Avatar cachePolicy + recyclingKey) — 20 min  
10. **P3-3** (GestureHandlerRootView at root) — 30 min, needs regression testing  
11. **P0-1 + P0-3 + P1-2** (new RPCs) — 2–3 hrs each, require DB migrations + hook rewrites  
12. **P2-4** (query key scoping) — 1 hr, touches every hook but low risk  

---

## Version Rationale

After implementing all fixes above, the appropriate release version is **v1.2.0**.

**Why a minor bump (1.1 → 1.2) and not a patch (1.1.0 → 1.1.1)?**

Semantic versioning convention:  
- **Patch** (1.1.x): bug fixes with no observable behaviour change  
- **Minor** (1.x.0): new functionality or non-trivial improvements in a backwards-compatible way  
- **Major** (x.0.0): breaking changes

These fixes include:
- **New Supabase RPCs** (P0-1, P0-3, P1-2) — new database functions = new functionality at the data layer
- **Architectural changes** — React Query key scoping (P2-4) changes cache invalidation behaviour; `GestureHandlerRootView` relocation (P3-3) changes the component tree structure
- **Visible UX improvements** — friends list loads in 1 query instead of 50+, group detail re-navigations no longer trigger 4 simultaneous refetches; these are user-visible performance improvements, not invisible bug fixes

A patch would be appropriate only for invisible fixes (memory leaks, cleanup correctness). The combination of new RPCs, architectural refactors, and measurable latency improvements justifies **v1.2.0**.

**If you split the work:**
- Frontend-only fixes (P1-3 through P3-5, no new RPCs, no structural changes) → **v1.1.1**
- Full implementation including new RPCs and architecture changes → bump to **v1.2.0**
