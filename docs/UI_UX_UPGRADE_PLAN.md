# UI / UX Upgrade Plan — Matching the FilterScrubber Vibe

Identified: 9 Mar 2026  
Current version: **v1.1.0**  
Reference component: `components/filter-scrubber.tsx`

---

## Why this doc exists

The `FilterScrubber` and `BalanceSpectrumBar` are widely regarded as the most sophisticated UI elements in the app. They share a set of qualities that the rest of the app does not consistently exhibit:

- Every interaction has a **spring-based physical response** — nothing snaps or pops
- **Layered animations** coordinate across multiple values simultaneously (expand, pulse, highlight, visibility)
- **Transitions are staggered** so the eye is guided, not overwhelmed
- **Loading / empty / settled states** feel intentional, not like fallbacks
- **BlurView / frosted glass** is used to signal depth and hierarchy

This document catalogues every gap between the current UI and that standard, grouped into four implementation phases ordered by user-facing impact.

---

## Phase 1 — Interaction Feel

> These are the highest-traffic touch targets in the app. Users notice dead feedback immediately, even subconsciously.

---

### 1.1 — Action buttons in `friend/[id].tsx` have zero press feedback

**File:** `app/friend/[id].tsx`  
**Lines:** ~528–543  
**Priority:** Critical

**Problem**  
The "Add Expense" and "Settle Up" buttons — the two most-tapped elements in the entire app — have no `style` callback on their `Pressable`. Pressing them produces no visual change whatsoever. Every other interactive element in the app at least dims on press. These do nothing.

**Current code (simplified)**
```tsx
<Pressable onPress={() => router.push('/add-expense')}>
  <View style={styles.actionButton}>
    <Ionicons name="add-circle-outline" ... />
    <Text>Add Expense</Text>
  </View>
</Pressable>
```

**Target behaviour**  
Spring scale-down on press begin, spring back on release — matching the `Button` component's existing behaviour.

**Fix**
```tsx
import { MotiView } from 'moti';

// Replace the Pressable+View pair with:
<Pressable onPress={...}>
  {({ pressed }) => (
    <MotiView
      animate={{ scale: pressed ? 0.95 : 1, opacity: pressed ? 0.85 : 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 300 }}
      style={styles.actionButton}
    >
      <Ionicons name="add-circle-outline" ... />
      <Text>Add Expense</Text>
    </MotiView>
  )}
</Pressable>
```

**Applies to both** "Add Expense" and "Settle Up" buttons.

---

### 1.2 — Split member checkbox toggle snaps instantly in `add-expense.tsx`

**File:** `app/add-expense.tsx`  
**Lines:** ~793–831 (member rows), ~813–826 (checkbox fill)  
**Priority:** High

**Problem**  
Toggling a person in or out of the expense split is the core interaction of the add-expense flow. The checkbox fill appears/disappears instantly — a hard cut. Haptic fires (`hapticSelection`) but the eye gets no corresponding visual response.

**Current code (simplified)**
```tsx
<View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
  {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
</View>
```

**Target behaviour**  
- Checkmark icon scales in from 0 → 1 on selection with a spring
- The checkbox background color cross-fades (border → filled green)
- The row itself gets a subtle `scale: 0.98 → 1` spring rebound when tapped

**Fix**
```tsx
// Checkmark scale animation
<MotiView
  animate={{ scale: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
  transition={{ type: 'spring', damping: 15, stiffness: 280 }}
>
  <Ionicons name="checkmark" size={14} color={colors.white} />
</MotiView>

// Row press rebound — wrap the Pressable content:
{({ pressed }) => (
  <MotiView
    animate={{ scale: pressed ? 0.98 : 1 }}
    transition={{ type: 'spring', damping: 20, stiffness: 350 }}
    style={styles.memberRow}
  >
    {/* row content */}
  </MotiView>
)}
```

---

### 1.3 — Pressable opacity-only pattern needs scale added everywhere

**Files:** Multiple  
**Priority:** High

**Problem**  
Many `Pressable` components only apply `opacity` on press, not `scale`. The FilterScrubber's feel comes from physical spring responses. Opacity-only feedback reads as "dimming" rather than "pressing".

**Audit of affected locations:**

| File | Element | Current feedback | Target |
|------|---------|-----------------|--------|
| `people-search-sheet.tsx` ~159 | Group row | opacity 0.75 | + scale 0.98 |
| `people-search-sheet.tsx` ~188 | Contact row | opacity 0.8 | + scale 0.98 |
| `people-search-sheet.tsx` ~274 | "Done" button | none | opacity 0.7 + scale 0.96 |
| `people-search-sheet.tsx` ~299 | Clear search "×" | none | opacity 0.6 + scale 0.9 |
| `friend/[id].tsx` ~411 | Expense row | opacity 0.7 | + scale 0.98 |
| `friend/[id].tsx` ~688 | Back button | none | opacity 0.7 + scale 0.9 |
| `friends.tsx` ~212 | Header add button | opacity 0.6 | + scale 0.9 |
| `add-expense.tsx` ~573 | Currency picker button | none | opacity 0.8 + scale 0.96 |

**Standard pattern to apply:**
```tsx
<Pressable
  style={({ pressed }) => ({
    opacity: pressed ? 0.8 : 1,
    transform: [{ scale: pressed ? 0.97 : 1 }],
  })}
>
```

Or with spring (preferred for larger tap targets):
```tsx
{({ pressed }) => (
  <MotiView
    animate={{ scale: pressed ? 0.96 : 1 }}
    transition={{ type: 'spring', damping: 20, stiffness: 350 }}
  >
    {/* content */}
  </MotiView>
)}
```

---

### 1.4 — "View older" / "View history" links have no button affordance

**File:** `app/friend/[id].tsx`  
**Lines:** ~419–437, ~455–458  
**Priority:** Medium

**Problem**  
These are plain text with no border, no background, and only `opacity` press feedback. They don't look tappable. Users may not discover them.

**Fix**  
Add a subtle pill background matching the FilterScrubber's frosted appearance:
```tsx
<Pressable onPress={onPress}>
  {({ pressed }) => (
    <MotiView
      animate={{ scale: pressed ? 0.96 : 1, opacity: pressed ? 0.75 : 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 300 }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
      }}
    >
      <Text style={styles.viewOlderText}>{label}</Text>
    </MotiView>
  )}
</Pressable>
```

---

## Phase 2 — Loading States

> Loading states are the first thing a user sees. A polished skeleton communicates that the app is fast and trustworthy. A spinner communicates "wait."

---

### 2.1 — `ActivityIndicator` inside hero balance card

**File:** `app/(tabs)/index.tsx`  
**Lines:** ~309–315  
**Priority:** High

**Problem**  
When friends data is loading, an `ActivityIndicator` appears inside the colored hero card. Worse, the "You get back / You owe" sub-rows still render with `₹0.00` during this period. This is visually jarring — the card is the hero element of the home screen.

**Current state**
```tsx
{isLoadingFriends ? (
  <ActivityIndicator color={colors.white} />
) : (
  <Text style={styles.balanceAmount}>
    {formatBalance(netBalance)}
  </Text>
)}
// sub-rows always render, show ₹0 during load
```

**Target behaviour**  
- The balance amount area shows a rounded `Skeleton` placeholder matching the text dimensions
- The "You get back / You owe" rows show smaller skeleton pills instead of zero values
- No `ActivityIndicator` at all inside this card

**Fix**
```tsx
{isLoadingFriends ? (
  <>
    {/* Balance amount placeholder */}
    <Skeleton width={120} height={36} radius={8} style={{ marginVertical: 4 }} />
    {/* Sub-row placeholders */}
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
      <Skeleton width={90} height={18} radius={6} />
      <Skeleton width={90} height={18} radius={6} />
    </View>
  </>
) : (
  <>
    <Text style={styles.balanceAmount}>{formatBalance(netBalance)}</Text>
    {/* sub-rows */}
  </>
)}
```

---

### 2.2 — Contact list loading state is a bare spinner

**File:** `components/people-search-sheet.tsx`  
**Lines:** ~335–342  
**Priority:** High

**Problem**  
This sheet is the primary entry point for every expense creation. During contact load it shows only `ActivityIndicator small` + "Loading contacts..." text, centered. Given how often users open this sheet, the quality of this loading state has outsized impact on perceived app polish.

**Target behaviour**  
Skeleton rows that match the actual contact row layout: 40px circle (avatar) + two text lines side by side, repeated 6–8 times with staggered opacity.

**Fix**
```tsx
function SkeletonContactList() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 40, type: 'timing', duration: 300 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 }}
        >
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ gap: 6 }}>
            <Skeleton width={120} height={14} radius={6} />
            <Skeleton width={80} height={11} radius={5} />
          </View>
        </MotiView>
      ))}
    </>
  );
}
```

Replace the spinner block with `<SkeletonContactList />`.

---

### 2.3 — Shimmer skeleton vs opacity pulse

**File:** `components/ui/skeleton.tsx`  
**Lines:** ~43–60  
**Priority:** Medium

**Problem**  
The current `Skeleton` component animates `opacity: 0.5 → 1` in a loop. This is a pulse, not a shimmer. A true shimmer — a gradient sweep from left to right — is what iOS and Android users recognise and trust as a loading indicator.

**Target behaviour**  
Left-to-right gradient sweep using `expo-linear-gradient` and `Animated`:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle } from 'react-native-reanimated';

export function Skeleton({ width, height, radius = 8, style }: SkeletonProps) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * (typeof width === 'number' ? width : 200) }],
  }));

  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: shimmerBase }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
```

This single change upgrades every skeleton in the app simultaneously.

---

### 2.4 — Error states have zero animation

**Files:** `app/(tabs)/friends.tsx` ~322–337, `app/friend/[id].tsx` ~634–656  
**Priority:** Medium

**Problem**  
Error states are plain `View`s with an icon and text. They appear instantly with no entry animation, which feels jarring compared to the staggered entry of the normal content around them.

**Fix**  
Wrap each error state block in a `MotiView` with a gentle scale-in:
```tsx
<MotiView
  from={{ opacity: 0, scale: 0.92 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
>
  {/* icon + message + retry button */}
</MotiView>
```

Also add press feedback to the Retry button (currently bare `Pressable` with no `style` callback in both files).

---

## Phase 3 — Moment Animations

> These are the "wow" moments — states a user reaches after meaningful activity. Making them feel rewarding builds emotional attachment to the app.

---

### 3.1 — "All settled up!" state deserves celebration

**File:** `app/friend/[id].tsx`  
**Lines:** ~443–467 (`renderFullySettledState`)  
**Priority:** High

**Problem**  
When a friend is fully settled, this state is rendered as a static `View` — a green checkmark icon and two text lines. This is arguably the most emotionally significant moment in the app. It deserves a micro-animation.

**Target behaviour**
- The entire block scales in from 0.85 → 1 with a spring on mount
- The checkmark icon has a looping gentle pulse (scale 1 → 1.08 → 1) using `withRepeat`
- The subtitle and "View history" link stagger in 150ms after the icon

**Fix**
```tsx
function FullySettledState({ onViewHistory }: { onViewHistory: () => void }) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 100 }}
      style={styles.settledContainer}
    >
      {/* Pulsing checkmark */}
      <MotiView
        from={{ scale: 1 }}
        animate={{ scale: 1.08 }}
        transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
      >
        <View style={styles.settledIconCircle}>
          <Ionicons name="checkmark-circle" size={52} color={colors.success} />
        </View>
      </MotiView>

      {/* Staggered text */}
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 250 }}
      >
        <Text style={styles.settledTitle}>All settled up!</Text>
        <Text style={styles.settledSubtitle}>No pending balances.</Text>
      </MotiView>

      {/* View history link */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 300, delay: 450 }}
      >
        <Pressable onPress={onViewHistory}>
          <Text style={styles.viewHistoryLink}>View history →</Text>
        </Pressable>
      </MotiView>
    </MotiView>
  );
}
```

---

### 3.2 — Filtered-empty state in Friends screen

**File:** `app/(tabs)/friends.tsx`  
**Lines:** ~250–254  
**Priority:** Medium

**Problem**  
When a filter (e.g. "Collecting") returns no friends, the list goes blank. The only indication is a subtitle text change from "X friends" to "No friends match this filter." There is no visual empty state — just an empty scroll area.

**Target behaviour**  
An `AnimatePresence`-wrapped `EmptyState` with filter-specific messaging that springs in when the filtered list is empty.

**Fix**
```tsx
const FILTER_EMPTY_MESSAGES: Record<FilterType, { title: string; subtitle: string; icon: string }> = {
  all:         { title: 'No friends yet',       subtitle: 'Add someone to get started.',        icon: 'people-outline'    },
  outstanding: { title: 'All balanced',         subtitle: 'No outstanding balances right now.', icon: 'checkmark-circle-outline' },
  i_owe:       { title: 'Nothing to pay',       subtitle: "You don't owe anyone right now.",    icon: 'arrow-up-circle-outline'  },
  they_owe:    { title: 'Nothing to collect',   subtitle: 'No one owes you right now.',         icon: 'arrow-down-circle-outline'},
};

// In the FlashList ListEmptyComponent:
<AnimatePresence>
  {!isLoading && filteredFriends.length === 0 && (
    <MotiView
      key={activeFilter}
      from={{ opacity: 0, scale: 0.94, translateY: 10 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
    >
      <EmptyState
        icon={FILTER_EMPTY_MESSAGES[activeFilter].icon}
        title={FILTER_EMPTY_MESSAGES[activeFilter].title}
        subtitle={FILTER_EMPTY_MESSAGES[activeFilter].subtitle}
      />
    </MotiView>
  )}
</AnimatePresence>
```

---

### 3.3 — Item entry animations in `people-search-sheet.tsx`

**File:** `components/people-search-sheet.tsx`  
**Lines:** ~157–231  
**Priority:** Medium

**Problem**  
This is the only screen-level component with **zero** entry animations on its list rows. Groups and contacts pop in as a single block. Every other list in the app (friends, activity, transactions) uses staggered `MotiView` entry.

**Fix**  
Wrap each row renderer with staggered `MotiView` — same pattern used in `friends.tsx`:

```tsx
// In renderGroupItem:
<MotiView
  from={{ opacity: 0, translateX: -16 }}
  animate={{ opacity: 1, translateX: 0 }}
  transition={{ type: 'spring', damping: 20, stiffness: 200, delay: Math.min(index * 50, 300) }}
>
  <Pressable ...>
    {/* group row content */}
  </Pressable>
</MotiView>

// In renderContactItem — same pattern
```

---

## Phase 4 — System-Level Polish

> These are single-file changes that apply globally across the app.

---

### 4.1 — Tab bar: no blur, no icon animation

**File:** `app/(tabs)/_layout.tsx`  
**Lines:** ~24–32 (tab bar style), ~54–102 (tab definitions)  
**Priority:** Medium

**Problem — Blur**  
The tab bar has a flat opaque background. The FilterScrubber uses `BlurView` (frosted glass) for depth. On iOS, a blurred tab bar is now the system standard and gives the app a native, premium feel.

**Fix (tab bar background)**  
```tsx
// In the Tab.Navigator screenOptions:
tabBarStyle: {
  position: 'absolute',        // required for blur to work
  borderTopWidth: 0,
  backgroundColor: 'transparent',
  elevation: 0,
},
tabBarBackground: () => (
  <BlurView
    intensity={80}
    tint={isDark ? 'dark' : 'light'}
    style={StyleSheet.absoluteFill}
  />
),
```

**Problem — Icon animation**  
Tab icons change color on focus but don't animate. A scale bounce when switching tabs reinforces the physical feel of the FilterScrubber.

**Fix (animated tab icon)**  
Create a `AnimatedTabIcon` component:
```tsx
function AnimatedTabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <MotiView
      animate={{ scale: focused ? 1.15 : 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
    >
      <Ionicons name={name} size={24} color={color} />
    </MotiView>
  );
}

// In each Tab.Screen:
tabBarIcon: ({ color, focused }) => (
  <AnimatedTabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
)
```

---

### 4.2 — Offline banner exit animation is broken

**File:** `components/ui/offline-banner.tsx`  
**Lines:** ~26–49  
**Priority:** Medium (silent bug)

**Problem**  
The `MotiView` in the offline banner has `exit={{ opacity: 0, translateY: -20 }}` but exit animations in Moti only fire when the component is inside an `AnimatePresence` wrapper. Without it, the banner disappears instantly when the user comes back online — no exit transition fires.

**Fix**  
In the parent that renders `<OfflineBanner />` (the tab layout or root layout), wrap it:

```tsx
import { AnimatePresence } from 'moti';

// In _layout.tsx or wherever OfflineBanner is rendered:
<AnimatePresence>
  {!isOnline && <OfflineBanner key="offline-banner" />}
</AnimatePresence>
```

This is a one-line fix that activates the exit animation that was already written but never executing.

---

### 4.3 — `colors.primary[500]` vs `colors.success` used interchangeably

**File:** `constants/colors.ts` + all screens  
**Priority:** Low (visual coherence)

**Problem**  
Two slightly different greens both represent "positive balance" across the app:
- `colors.primary[500]` = `#4CAF50` (Material Green 500)
- `colors.success` = `#22C55E` (Tailwind Green 500)

They appear side by side on the friends screen (summary card uses `primary`, balance amount uses `success`) creating a subtle visual inconsistency.

**Fix**  
Audit every usage of `colors.success` and `colors.primary[500]` for "positive money" contexts and standardise on one. Recommendation: use `colors.success` (`#22C55E`) for all balance/money positive states, and `colors.primary[500]` only for brand/action elements (buttons, active states).

---

### 4.4 — Checkbox shape inconsistency

**Files:** `components/people-search-sheet.tsx` ~457, `app/add-expense.tsx` ~1121  
**Priority:** Low

**Problem**  
Checkboxes in `people-search-sheet.tsx` are **circular** (`borderRadius: 12` on a 24×24 box). Checkboxes in `add-expense.tsx` are **square** (`borderRadius: 6`). These two sheets are often used in the same flow. The inconsistency breaks the feeling of a unified design system.

**Fix**  
Extract a shared `Checkbox` component to `components/ui/checkbox.tsx` and use it in both places. Settle on square with `borderRadius: 6` — circles are better for radio buttons (single select); checkboxes (multi-select) should be square per standard convention.

---

### 4.5 — Currency symbol hardcoded in `friends.tsx`

**File:** `app/(tabs)/friends.tsx`  
**Lines:** ~299, ~313  
**Priority:** Low

**Problem**  
The summary card directly interpolates `₹{totalOwed.toFixed(2)}` and `₹{totalOwe.toFixed(2)}` instead of using the app's `formatBalance` utility. Every other balance display goes through the formatter.

**Fix**  
```tsx
// Before
`₹${totalOwed.toFixed(2)}`

// After
formatBalance(totalOwed)
```

---

## Implementation Order

| # | Change | File(s) | Effort | Impact |
|---|--------|---------|--------|--------|
| 1 | Action button press feedback | `friend/[id].tsx` | 15 min | Critical |
| 2 | Fix `AnimatePresence` on offline banner | `_layout.tsx` | 5 min | Medium (silent bug) |
| 3 | Add scale to all opacity-only Pressables | Multiple | 30 min | High |
| 4 | Checkbox scale animation in split members | `add-expense.tsx` | 20 min | High |
| 5 | Hero card skeleton during load | `index.tsx` | 30 min | High |
| 6 | Contact list skeleton rows | `people-search-sheet.tsx` | 30 min | High |
| 7 | "All settled up!" celebration animation | `friend/[id].tsx` | 25 min | High |
| 8 | Filter-empty states in friends screen | `friends.tsx` | 20 min | Medium |
| 9 | Staggered entry in people-search-sheet | `people-search-sheet.tsx` | 20 min | Medium |
| 10 | Error states — add MotiView entry | Multiple | 20 min | Medium |
| 11 | Tab bar blur + icon bounce | `_layout.tsx` | 30 min | Medium |
| 12 | True shimmer skeleton | `components/ui/skeleton.tsx` | 45 min | Medium |
| 13 | "View older" pill affordance | `friend/[id].tsx` | 15 min | Medium |
| 14 | Standardise checkbox to shared component | Multiple | 45 min | Low |
| 15 | Unify `colors.success` vs `colors.primary[500]` | Global | 20 min | Low |
| 16 | Fix `₹` hardcoding in summary card | `friends.tsx` | 5 min | Low |

**Total estimated effort: ~6 hours across all 16 items**

---

## Design Principles to carry forward

These are the properties that make the FilterScrubber feel premium. Every new component or interaction added to the app should be checked against these:

1. **Spring, not timing** — use `type: 'spring'` for anything the user directly touches. Reserve `type: 'timing'` for autonomous transitions (entry animations, banners).
2. **Stagger reveals** — lists always enter staggered (`delay: Math.min(index * 60, 350)`). Never let a list pop in as a single block.
3. **Scale + opacity together** — press feedback always combines both. Opacity alone reads as dimming; scale alone reads as glitch. Together they read as "physical."
4. **Loading states match content shape** — every loading state should silhouette the content that will replace it. Spinners are acceptable only for full-screen blocking operations.
5. **Empty states are transitions, not endpoints** — use `AnimatePresence` so empty states animate in when the list empties, not just on mount.
6. **Frosted glass for floating elements** — any element that floats above the content layer (filter pill, tooltip, bottom sheet header) should use `BlurView` to signal its elevation.
7. **Moments deserve micro-celebrations** — states like "all settled up", "first friend added", "expense created" are emotionally significant. A 300ms spring + subtle pulse on the confirming icon costs nothing and builds trust.
