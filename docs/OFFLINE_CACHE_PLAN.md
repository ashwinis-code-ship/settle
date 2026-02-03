# Offline Cache Implementation Plan

> **Goal:** Enable users to **view cached data** when offline. **All actions are blocked** when offline for simplicity.

---

## 📋 Summary (SIMPLIFIED APPROACH)

| Feature | Behavior |
|---------|----------|
| **View data offline** | ✅ Show cached data with "offline" indicator |
| **Add expense offline** | ❌ **BLOCKED** - requires internet |
| **Settle up offline** | ❌ **BLOCKED** - requires internet |
| **Create group offline** | ❌ **BLOCKED** - requires internet |
| **Edit/delete items offline** | ❌ **BLOCKED** - requires internet |
| **Offline indicator** | ✅ Global banner: "You're offline - Last synced X ago" |

### Why This Approach?
- **Simpler code** - no sync queue for user actions, no pending items
- **No conflicts** - all changes happen online where server is source of truth
- **Faster to ship** - fewer edge cases and bugs
- **Still useful** - users can check balances and history offline

---

## 🏗️ Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Storage Keys Setup | ✅ DONE |
| Phase 2 | Cache on Fetch | ✅ DONE |
| Phase 3 | Read from Cache | ✅ DONE |
| Phase 4 | **Block ALL Actions** | ✅ DONE |
| Phase 5 | UI Indicators | ✅ DONE |
| Phase 6 | Testing & Polish | ✅ DONE |

---

## Phase 1: Storage Keys Setup ✅ COMPLETE

**File:** `lib/storage.ts`

All storage keys and cache helpers implemented:
- [x] 1.1 Add new storage keys
- [x] 1.2 Add cache helper functions  
- [x] 1.3 Export types needed for cache

---

## Phase 2: Cache on Fetch ✅ COMPLETE

All hooks cache data after successful fetch:
- [x] 2.1 useFriends - cache after fetch
- [x] 2.2 useGroups - cache transformed list
- [x] 2.3 useGroup - cache after fetch
- [x] 2.4 useFriendDetail - cache after fetch
- [x] 2.5 useExpenses - cache after fetch
- [x] 2.6 useRecentActivity - cache after fetch

---

## Phase 3: Read from Cache ✅ COMPLETE

All hooks return cached data when offline:
- [x] 3.1 useFriends - offline fallback
- [x] 3.2 useGroups - offline fallback
- [x] 3.3 useGroup - offline fallback
- [x] 3.4 useFriendDetail - offline fallback
- [x] 3.5 useExpenses - offline fallback
- [x] 3.6 useRecentActivity - offline fallback

---

## Phase 4: Block ALL Actions When Offline 🔄 NEEDS UPDATE

### Current Status (Partial Blocking)
We currently block:
- [x] 4.1 Create Group button/screen
- [x] 4.3 Create Group from Groups tab
- [x] 4.4 Add expense with NEW friend (no direct group)

### What We Still Allow (NEEDS TO BE BLOCKED)
- ❌ Add Expense button (on all screens)
- ❌ Settle Up button (on all screens)
- ❌ Add expense with EXISTING friend/group

### Tasks to Simplify

#### Task 4.5: Block "Add Expense" Button Everywhere
**Files to update:**
- `app/(tabs)/index.tsx` - Home screen Quick Actions
- `app/(tabs)/explore.tsx` - Friends list "Add Expense" per friend
- `app/friend/[id].tsx` - Friend detail "Add Expense" button
- `app/group/[id]/index.tsx` - Group detail "+" button

```typescript
const handleAddExpense = () => {
  if (!isOnline) {
    hapticWarning();
    Alert.alert(
      'No Connection',
      'Adding expenses requires an internet connection.',
      [{ text: 'OK' }]
    );
    return;
  }
  // ... existing logic
};
```

**Checklist:**
- [x] 4.5a Block Add Expense on Home screen ✅
- [x] 4.5b Block Add Expense on Friends list ✅
- [x] 4.5c Block Add Expense on Friend detail screen ✅
- [x] 4.5d Block Add Expense on Group detail screen ✅

---

#### Task 4.6: Block "Settle Up" Button Everywhere
**Files to update:**
- `app/(tabs)/index.tsx` - Home screen Quick Actions
- `app/friend/[id].tsx` - Friend detail "Settle Up" button
- `app/settle-up.tsx` - Settle Up screen (block on open)

```typescript
const handleSettleUp = () => {
  if (!isOnline) {
    hapticWarning();
    Alert.alert(
      'No Connection',
      'Settling up requires an internet connection.',
      [{ text: 'OK' }]
    );
    return;
  }
  // ... existing logic
};
```

**Checklist:**
- [x] 4.6a Block Settle Up on Home screen ✅
- [x] 4.6b Block Settle Up on Friend detail screen ✅
- [x] 4.6c Block Settle Up screen when offline ✅

---

#### Task 4.7: Remove Offline Expense Creation Logic (Cleanup)
**Files to clean up:**
- `hooks/use-expenses.ts` - Remove offline expense creation
- `hooks/use-settlements.ts` - Remove offline settlement creation
- `app/add-expense.tsx` - Remove `hasDirectGroup` filtering (not needed anymore)

Since we're blocking all actions, we can simplify:
- Remove the `hasDirectGroup` logic in add-expense
- Remove offline mutation logic in useExpenses/useSettlements
- Keep the sync queue for future use, but don't add to it offline

**Checklist:**
- [x] 4.7a Simplify add-expense.tsx (block screen when offline, remove filter) ✅
- [x] 4.7b Remove offline expense creation in useExpenses ✅
- [x] 4.7c Remove offline settlement creation in useSettlements ✅

---

#### Task 4.8: Update Offline Banner Message
Show clearer message that actions are blocked:

```typescript
<Text style={styles.subtitle}>
  View-only mode · {lastSyncText}
</Text>
```

**Checklist:**
- [x] 4.8 Update offline banner to show "View-only mode" ✅

---

## Phase 5: UI Indicators ✅ COMPLETE

- [x] 5.1 Add last sync time to offline banner
- [x] 5.2 Verify banner on all screens
- [x] 5.3 Add StaleDataNotice component

---

## Phase 6: Testing & Polish ✅ COMPLETE

- [x] 6.1 Test offline scenarios (manual)
- [x] 6.2 Add empty cache states
- [x] 6.3 Verify cache clears on logout

---

## ✅ Final Checklist

### Phase 1: Storage Keys ✅
- [x] 1.1 Add new storage keys
- [x] 1.2 Add cache helper functions
- [x] 1.3 Export types needed for cache

### Phase 2: Cache on Fetch ✅
- [x] 2.1 useFriends - cache after fetch
- [x] 2.2 useGroups - cache transformed list
- [x] 2.3 useGroup - cache after fetch
- [x] 2.4 useFriendDetail - cache after fetch
- [x] 2.5 useExpenses - cache after fetch
- [x] 2.6 useRecentActivity - cache after fetch

### Phase 3: Read from Cache ✅
- [x] 3.1 useFriends - offline fallback
- [x] 3.2 useGroups - offline fallback
- [x] 3.3 useGroup - offline fallback
- [x] 3.4 useFriendDetail - offline fallback
- [x] 3.5 useExpenses - offline fallback
- [x] 3.6 useRecentActivity - offline fallback

### Phase 4: Block ALL Actions 🔄
- [x] 4.1 Block create-group screen offline
- [x] 4.2 ~~Filter friend selector offline~~ (will be removed)
- [x] 4.3 Block create group button on groups tab
- [x] 4.4 ~~Block new friend expense~~ (will block ALL)
- [x] 4.5 Block Add Expense everywhere ✅
- [x] 4.6 Block Settle Up everywhere ✅
- [x] 4.7 Remove offline expense/settlement creation logic ✅
- [x] 4.8 Update offline banner message ✅

### Phase 5: UI Indicators ✅
- [x] 5.1 Add last sync time to offline banner
- [x] 5.2 Verify banner on all screens
- [x] 5.3 Add StaleDataNotice component

### Phase 6: Testing ✅
- [x] 6.1 Test offline scenarios
- [x] 6.2 Add empty cache states
- [x] 6.3 Verify cache clears on logout

---

## 📁 Files to Modify for Simplified Approach

| File | Task | Changes |
|------|------|---------|
| `app/(tabs)/index.tsx` | 4.5a, 4.6a | Block Add Expense & Settle Up buttons |
| `app/(tabs)/explore.tsx` | 4.5b | Block Add Expense per friend (simplify) |
| `app/friend/[id].tsx` | 4.5c, 4.6b | Block Add Expense & Settle Up buttons |
| `app/group/[id]/index.tsx` | 4.5d | Block Add Expense button |
| `app/settle-up.tsx` | 4.6c | Block screen when offline |
| `app/add-expense.tsx` | 4.7a | Remove hasDirectGroup filter, block screen |
| `hooks/use-expenses.ts` | 4.7b | Remove offline creation (optional cleanup) |
| `hooks/use-settlements.ts` | 4.7c | Remove offline creation (optional cleanup) |
| `components/ui/offline-banner.tsx` | 4.8 | Update message to "View-only mode" |

---

## 📝 Notes

- **View-only when offline** - Users can browse cached data but cannot make changes
- **All cached data persists until logout**
- **Clear messaging** - Banner shows "View-only mode" so users understand
- **Sync queue** - Keep the infrastructure for future enhancement
- **No conflicts possible** - Server is always source of truth
