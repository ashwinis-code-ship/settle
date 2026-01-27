# Simplified Debts Feature

## Overview

Replace raw per-person balances with "simplified debts" - the minimum number of transactions needed to settle all balances in a group.

## Problem Statement

### Current Behavior
- Group view shows each person's net balance (e.g., "Satnam gets back ₹13,000")
- Individual view shows pair-wise balances (e.g., "Sneha owes you ₹3,000")
- After settlements using simplified debts, these views become inconsistent

### Example Scenario

**Group: goa trip (4 members)**

| Expense | Paid by | Amount | Split |
|---------|---------|--------|-------|
| flight tickets | Satnam | ₹20,000 | 4 ways (₹5k each) |
| daru | Sneha | ₹6,000 | 3 ways - Satnam, Lattu, Thulasi (₹2k each) |

**Raw Balances:**
- Satnam: +₹13,000 (gets back)
- Sneha: +₹1,000 (gets back)
- Lattu: -₹7,000 (owes)
- Thulasi: -₹7,000 (owes)

**Direct Pair-wise Debts (5 transactions):**
1. Sneha → Satnam: ₹3,000
2. Lattu → Satnam: ₹5,000
3. Thulasi → Satnam: ₹5,000
4. Lattu → Sneha: ₹2,000
5. Thulasi → Sneha: ₹2,000

**Simplified Debts (3 transactions):**
1. Lattu → Satnam: ₹7,000
2. Thulasi → Satnam: ₹6,000
3. Thulasi → Sneha: ₹1,000

## Solution: Unified Simplified Debts

Use simplified debts for BOTH group view AND individual view calculations.

### Individual Balance Calculation

For each friend, calculate:
1. **Direct 1:1 expenses** (from groups with type='direct'): Calculate directly
2. **Group expenses** (from groups with type='group'): Use simplified debts

**Example: Satnam's view**

| Friend | 1:1 Direct | Groups (Simplified) | Total |
|--------|------------|---------------------|-------|
| Sneha | ₹0 | ₹0 (not in simplified debts) | ₹0 |
| Lattu | ₹0 | ₹7,000 | ₹7,000 |
| Thulasi | ₹0 | ₹6,000 | ₹6,000 |

This ensures consistency between group and individual views.

---

## Implementation Plan

### Step 1: Create Utility Function

**File:** `lib/simplified-debts.ts`

```typescript
interface MemberBalance {
  userId: string;
  name: string;
  balance: number; // positive = owed money, negative = owes money
}

interface SimplifiedDebt {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

/**
 * Calculate simplified debts using greedy algorithm.
 * Minimizes the number of transactions needed to settle all balances.
 */
export function calculateSimplifiedDebts(balances: MemberBalance[]): SimplifiedDebt[] {
  const debts: SimplifiedDebt[] = [];
  
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter(b => b.balance > 0)
    .map(b => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining); // Sort descending
  
  const debtors = balances
    .filter(b => b.balance < 0)
    .map(b => ({ ...b, remaining: Math.abs(b.balance) }))
    .sort((a, b) => b.remaining - a.remaining); // Sort descending
  
  let i = 0; // creditor index
  let j = 0; // debtor index
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const amount = Math.min(creditor.remaining, debtor.remaining);
    
    if (amount > 0) {
      debts.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount,
      });
      
      creditor.remaining -= amount;
      debtor.remaining -= amount;
    }
    
    if (creditor.remaining === 0) i++;
    if (debtor.remaining === 0) j++;
  }
  
  return debts;
}
```

### Step 2: Update useGroup Hook

**File:** `hooks/use-group.ts`

Add to the return value:
```typescript
interface UseGroupResult {
  // ... existing fields
  simplifiedDebts: SimplifiedDebt[];
}
```

Calculate from existing balances:
```typescript
const simplifiedDebts = useMemo(() => {
  if (!group?.balances) return [];
  return calculateSimplifiedDebts(
    group.balances.map(b => ({
      userId: b.user.id,
      name: b.user.name,
      balance: b.net_balance,
    }))
  );
}, [group?.balances]);
```

### Step 3: Update Group Detail Screen

**File:** `app/group/[id]/index.tsx`

Replace "Balances" section with "Settle Up" section:

```tsx
{/* Settle Up Section */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Settle Up</Text>
  {simplifiedDebts.length === 0 ? (
    <Text>All settled up!</Text>
  ) : (
    simplifiedDebts.map((debt) => {
      const isYouPaying = debt.fromUserId === user?.id;
      const isYouReceiving = debt.toUserId === user?.id;
      
      return (
        <View key={`${debt.fromUserId}-${debt.toUserId}`} style={styles.debtRow}>
          <Text>
            {isYouPaying ? 'You' : debt.fromName} owes{' '}
            {isYouReceiving ? 'you' : debt.toName} ₹{debt.amount}
          </Text>
          {(isYouPaying || isYouReceiving) && (
            <Pressable onPress={() => handleSettleUp(debt)}>
              <Text>Settle</Text>
            </Pressable>
          )}
        </View>
      );
    })
  )}
</View>
```

### Step 4: Update useFriends Hook

**File:** `hooks/use-friends.ts`

For each friend, calculate balance using simplified debts:

```typescript
// For each shared group
for (const group of sharedGroups) {
  if (group.type === 'direct') {
    // 1:1 group: calculate directly
    balance += await calculateDirectBalance(user.id, friend.id, group.id);
  } else {
    // Regular group: use simplified debts
    const groupBalances = await getGroupBalances(group.id);
    const simplifiedDebts = calculateSimplifiedDebts(groupBalances);
    
    // Find debts between me and this friend
    for (const debt of simplifiedDebts) {
      if (debt.fromUserId === friend.id && debt.toUserId === user.id) {
        balance += debt.amount; // Friend owes me
      } else if (debt.fromUserId === user.id && debt.toUserId === friend.id) {
        balance -= debt.amount; // I owe friend
      }
    }
  }
}
```

### Step 5: Update useFriendDetail Hook

Same logic as useFriends, but with breakdown per group for display.

---

## Files to Change

| File | Change |
|------|--------|
| `lib/simplified-debts.ts` | **New** - utility function |
| `hooks/use-group.ts` | Add simplified debts calculation |
| `app/group/[id]/index.tsx` | Replace balances with settle up UI |
| `hooks/use-friends.ts` | Use simplified debts for balances |
| `hooks/use-friend-detail.ts` | Use simplified debts for balances |
| `app/friend/[id].tsx` | Update shared groups display |

---

## Edge Cases

1. **Person with zero balance**: They won't appear in simplified debts (nothing to settle)
2. **All settled**: `simplifiedDebts` array will be empty
3. **Single person group**: No debts possible
4. **Floating point precision**: Round to 2 decimal places

---

## Testing Scenarios

1. **Simple 2-person split**: A pays, B owes half
2. **3-person uneven**: A pays ₹300, B pays ₹0, C pays ₹0 (split 100 each)
3. **Complex multi-payer**: Multiple people pay different amounts
4. **Partial settlement**: After some settlements, recalculate remaining debts
5. **Cross-group**: Friend appears in multiple groups with different debts

---

## Future Enhancements

1. **Settlement suggestions**: Show "Settle via UPI" button
2. **Payment reminders**: Notify friends about pending debts
3. **Debt consolidation**: "Pay ₹10k to Satnam to settle 3 groups at once"
