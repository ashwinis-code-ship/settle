# Settle — Native-First UI Strategy

**Date:** June 12, 2026  
**App:** Settle v1.3.0  
**Stack:** Expo SDK 55 · React Native 0.83.6 · New Architecture (mandatory) · iOS + Android  
**Status:** ✅ Native-first migration complete · SDK 55 upgraded · smoke tested

---

## Goal

> **Same UX everywhere. Native look and feel on each platform.**

Users should complete the same tasks (add expense, settle up, manage groups) with the same information architecture and flows. What changes per platform is **chrome** — navigation, materials, icons, gestures, dialogs, and motion — not the product logic.

This is the **content vs chrome** split:

| Layer | Approach |
|-------|----------|
| **Chrome** (tabs, headers, toolbars, sheets, dialogs, system bars) | Platform-native primitives |
| **Content** (expense rows, balance cards, forms, charts, empty states) | Shared React Native components |
| **Behavior** (navigation graph, data, validation, sync) | 100% shared |

---

## Design Principle: "Native Shell, Shared Body"

```
┌─────────────────────────────────────┐
│  Native header / toolbar            │  ← iOS UINavigationBar / Android M3 App Bar
├─────────────────────────────────────┤
│                                     │
│   Shared RN content (FlashList,     │  ← Same components, platform-aware tokens
│   forms, avatars, balance bars)     │
│                                     │
├─────────────────────────────────────┤
│  Native tab bar                     │  ← iOS Liquid Glass / Android M3 Bottom Nav
└─────────────────────────────────────┘
```

Do **not** try to make iOS look like Android or vice versa. Let each platform render its own navigation and system UI.

---

## Implemented State (Post-Migration)

| Surface | Before | Now |
|---------|--------|-----|
| Tab bar | JS `Tabs` + `BlurView` | `NativeTabs` — Liquid Glass (iOS 26+) / M3 bottom nav (Android) |
| Stack headers | Hidden; custom RN nav rows | Native stack via `NativeScreenHeader` + `getNativeStackScreenOptions()` |
| Tab icons | Ionicons (font) | SF Symbols (iOS) / Material Icons via `VectorIcon` (Android) |
| Screen icons | Ionicons everywhere | `IconSymbol` everywhere — **zero Ionicons remaining** |
| Bottom sheets | Opaque Gorhom backgrounds | `SheetBackground` — glass/blur (iOS), M3 surface (Android) |
| Action menus | Inline `ActionSheetIOS` / `Alert` | Centralized in `lib/platform-picker.ts` |
| Filter scrubber | Custom pill + `BlurView` | `FrostedSurface` — glass (iOS), elevated M3 pill (Android) |
| Back navigation | Custom back `Pressable` | System back + swipe; predictive back on Android |
| Theme | Flat `colors` palette | `brand` + `platform` tokens, `lib/platform-theme.ts`, native chrome hooks |
| Offline banner | Overlapped status bar | iOS: `NativeTabs.BottomAccessory` (iOS 26+); Android: top overlay with safe-area inset |
| Android tab overlap | FilterScrubber overlapped tab bar | Fixed via `useTabBarOffset()` |

**Auth screens** still use custom headers (intentional — content-focused flows, no stack push chrome).

---

## Key Implementation Files

| Purpose | Path |
|---------|------|
| Native tabs | `app/(tabs)/_layout.tsx` |
| Root layout / nav theme | `app/_layout.tsx` |
| Native stack headers | `lib/native-header.tsx` |
| Platform theme | `lib/platform-theme.ts` |
| Platform pickers / alerts | `lib/platform-picker.ts` |
| Icon system | `components/ui/icon-symbol*.tsx`, `icon-symbol-mapping.ts` |
| Frosted / glass surfaces | `components/ui/frosted-surface.tsx` |
| Sheet backgrounds | `components/ui/sheet-background.tsx` |
| Tab bar offset (Android) | `hooks/use-tab-bar-offset.ts` |
| Android system chrome | `lib/android-chrome.ts`, `hooks/use-android-chrome.ts` |
| Color tokens | `constants/colors.ts` (`brand`, `platform`, flat `colors` export) |
| Offline banner | `components/ui/offline-banner.tsx` |

---

## Platform Mapping Reference

Use this table when replacing any UI element:

| UX need | iOS native API | Android native API | Expo / RN bridge |
|---------|----------------|-------------------|------------------|
| Bottom tabs | `UITabBarController` | Material 3 `NavigationBar` | `expo-router/unstable-native-tabs` ✅ |
| Push navigation | `UINavigationController` | Fragment stack + M3 App Bar | `expo-router` `Stack` ✅ |
| Header buttons | `UIBarButtonItem` | App Bar action icons | `HeaderIconButton` (SDK 54); `Stack.Toolbar` (SDK 55+) |
| Header search | `UISearchController` | M3 search bar | `Stack.SearchBar` (SDK 55+) |
| Modal / sheet | `UISheetPresentationController` | Bottom sheet dialog | `@gorhom/bottom-sheet` + `SheetBackground` ✅ |
| Confirm / pick list | `UIAlertController` / `ActionSheet` | `AlertDialog` | `lib/platform-picker.ts` ✅ |
| Icons | SF Symbols | Material Icons | `IconSymbol` ✅ |
| Haptics | `UIImpactFeedbackGenerator` | `Vibrator` | `expo-haptics` ✅ |
| Blur / glass | Liquid Glass | M3 surface tint / scrim | `FrostedSurface` / `SheetBackground` ✅ |
| System colors | `UIColor` system | Material You dynamic | `lib/platform-theme.ts` (SDK 54); `Color.*` API (SDK 55+) |
| Photos picker | `PHPickerViewController` | Photo Picker | `expo-image-picker` + `showPhotoSourcePicker` ✅ |

---

## What Stays Shared (Don't Platform-Split)

These are **content**, not chrome. Keep one implementation:

- `FlashList` data screens (home, friends, groups, activity feeds)
- Expense form fields and split logic (`add-expense.tsx` body)
- `BalanceSpectrumBar`, `ContributionBar` — custom data viz
- `Avatar`, amount formatting, currency logic
- Auth form layouts (email, OTP, password) — content is identical; only keyboard/safe-area behavior differs
- Sync, Supabase, React Query — no UI concern
- Empty states and skeleton loaders — shared structure; use platform **tokens** for colors/spacing

---

## Migration Summary (Completed)

### 1. Tab bar ✅

- Migrated `app/(tabs)/_layout.tsx` to `NativeTabs`
- SF Symbols on iOS; Material Icons via `VectorIcon` on Android
- Deleted `components/haptic-tab.tsx`
- Tab theme: system mode → native liquid glass; forced light/dark → explicit colors + blur

### 2. Stack headers ✅

- `lib/native-header.tsx`: `NativeScreenHeader`, `HeaderIconButton`, `HeaderSaveButton`, `getNativeStackScreenOptions()`
- Migrated 9+ detail/settings screens; removed custom RN nav bars
- Screens use `SafeAreaView edges={['bottom']}` — top handled by native header

### 3. Icon system ✅

- `icon-symbol-mapping.ts` — SF Symbol → Material Icons map (~50 icons)
- Platform files: `icon-symbol.ios.tsx`, `icon-symbol.android.tsx`, `icon-symbol.tsx` (web fallback)
- All `Ionicons` removed from app/components

### 4. Bottom sheets ✅

- `components/ui/sheet-background.tsx` — Gorhom sheet backgrounds
- Updated: `people-search-sheet`, `group-settle-sheet`, `edit-settlement-sheet`, `add-expense` picker sheet

### 5. Filter scrubber ✅

- `components/ui/frosted-surface.tsx` — iOS glass/blur, Android M3 elevated surface
- Android: `variant="elevated"`, `elevation: 3`, platform-specific pill styles
- `hooks/use-tab-bar-offset.ts` — fixes Android scrubber/tab bar overlap

### 6. Dialogs and pickers ✅

- `lib/platform-picker.ts`: `showPlatformPicker`, `showPlatformConfirm`, `showPhotoSourcePicker`, `showPlatformAlert`, `showOfflineAlert`
- Zero inline `ActionSheetIOS` / `Alert.alert` in app code (only in `platform-picker.ts`)

### 7. Android enablement ✅

- `app.json`: `predictiveBackGestureEnabled: true`, `androidNavigationBar.enforceContrast: true`
- `lib/android-chrome.ts` + `hooks/use-android-chrome.ts` — `expo-system-ui` + `expo-navigation-bar`
- Native stack: `gestureEnabled: true`, M3 header options

### 8. Theme system ✅

- `lib/platform-theme.ts` — platform chrome tokens, `getNavigationTheme()`, `shouldUseExplicitNativeChrome()`
- `hooks/use-platform-chrome.ts`
- No `Appearance.setColorScheme()` — avoids iOS 26 tab blur bugs on inactive tabs
- `constants/colors.ts` split into `brand` + `platform` tokens

---

## File Migration Checklist

### Phase 1 — Native shell ✅

| File | Status |
|------|--------|
| `app/(tabs)/_layout.tsx` | ✅ `NativeTabs` |
| `app/_layout.tsx` | ✅ Custom nav theme + explicit `StatusBar` |
| `app.json` | ✅ `predictiveBackGestureEnabled: true` |
| `components/haptic-tab.tsx` | ✅ Deleted |
| `components/ui/icon-symbol.android.tsx` | ✅ Created |

### Phase 2 — Native headers ✅

| File | Native header title |
|------|---------------------|
| `app/group/[id]/index.tsx` | Group name |
| `app/friend/[id].tsx` | Friend name |
| `app/expense/[id].tsx` | Expense description |
| `app/expense/group/[id].tsx` | Group expense title |
| `app/add-expense.tsx` | "Add Expense" / "Edit Expense" |
| `app/settle-up.tsx` | "Settle Up" |
| `app/create-group.tsx` | "Create Group" |
| `app/group/[id]/settings.tsx` | "Settings" |
| `app/settings/about.tsx` | "About" |

### Phase 3 — Platform materials ✅

| File | Status |
|------|--------|
| `components/filter-scrubber.tsx` | ✅ `FrostedSurface` |
| `components/people-search-sheet.tsx` | ✅ `SheetBackground` |
| `components/group-settle-sheet.tsx` | ✅ `SheetBackground` |
| `components/edit-settlement-sheet.tsx` | ✅ `SheetBackground` |
| `app/add-expense.tsx` | ✅ Picker sheet background |

### Phase 4 — Icons and utilities ✅

| File | Status |
|------|--------|
| `lib/platform-picker.ts` | ✅ Created |
| All `Ionicons` imports | ✅ Migrated to `IconSymbol` |
| `constants/colors.ts` | ✅ Split `brand` / `platform` |

---

## Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| `expo-router/unstable-native-tabs` | Native tab bar | ✅ In use |
| `expo-glass-effect` | iOS Liquid Glass surfaces | ✅ Via `FrostedSurface` |
| `expo-navigation-bar` | Android nav bar chrome | ✅ Installed |
| `expo-system-ui` | Android system UI | ✅ In use |
| `@expo/material-symbols` | Android toolbar/tab icons | Deferred to SDK 55+ toolbars |
| `react-native-screens` | Native stack + headers | ✅ In use |
| `@gorhom/bottom-sheet` | Complex sheet content | ✅ Keep |
| `expo-blur` | iOS < 26 fallback | ✅ Keep as fallback |
| `moti` | Content animations | ✅ Keep for content |
| `@expo/vector-icons` | Material Icons on Android tabs | ✅ Tab bar only |

---

## SDK 55 Upgrade (Completed)

Upgraded from SDK 54 → 55. Key changes applied:

| Change | Action taken |
|--------|--------------|
| Package versions | All `expo-*` packages aligned to `~55.0.x` via `npx expo install expo@^55 --fix` |
| `newArchEnabled` | Removed from `app.json` — New Architecture is mandatory on SDK 55 |
| `edgeToEdgeEnabled` | Removed from `app.json` — edge-to-edge is mandatory on Android 16+ |
| `androidNavigationBar` | Migrated to `expo-navigation-bar` config plugin |
| Native tabs API | Migrated to compound `NativeTabs.Trigger.Icon/Label/VectorIcon` syntax |
| Offline banner | iOS uses `NativeTabs.BottomAccessory`; Android keeps top overlay |
| Android chrome | Removed deprecated `NavigationBar.setButtonStyleAsync` runtime calls |
| React / RN | React 19.2.0, React Native 0.83.6, Reanimated 4.2.1, Screens 4.23 |

**Rebuild required:** `npx expo prebuild --clean && npx expo run:ios && npx expo run:android`

---

## SDK API Status

You are on **SDK 55**. Available native-first APIs:

| API | Status | Notes |
|-----|--------|-------|
| `NativeTabs` compound syntax | ✅ In use | `NativeTabs.Trigger.Icon/Label/VectorIcon` |
| `NativeTabs.BottomAccessory` | ✅ In use (iOS) | Offline banner above tab bar on iOS 26+ |
| `Stack.Toolbar` | Available | Not yet adopted — header actions still via `NativeScreenHeader` |
| `Stack.SearchBar` | Available | Not needed yet |
| `Color.ios.*` / `Color.android.dynamic.*` | Available | Could replace manual tokens in `platform-theme.ts` |
| `GlassView` | ✅ In use | Via `FrostedSurface` / `SheetBackground` |
| Android tab `md` Material Symbols | Available | Still using `VectorIcon` + MaterialIcons; can migrate to `md` prop |
| Distinct selected tab icons (`md`) | SDK 56+ | Not yet available |

**Next targets:** Adopt `Stack.Toolbar` for header actions, wire `Color` API into `platform-theme.ts`, migrate Android tab icons to `md` prop.

---

## Testing Matrix

| Scenario | iOS 26+ | iOS 18 | Android 14+ | Verified |
|----------|---------|--------|-------------|----------|
| Tab bar appearance | Liquid Glass | Standard UITabBar | M3 bottom nav | ✅ |
| Back gesture | Edge swipe | Edge swipe | Predictive back | ✅ |
| Header | Native nav bar | Native nav bar | M3 App Bar | ✅ |
| Sheet background | Glass | Blur | M3 surface | ✅ |
| Dark mode | System adaptive | System adaptive | Material You dynamic | ✅ |
| Offline banner | Tab accessory (iOS) / top overlay (Android) | Tab accessory (iOS) / top overlay (Android) | Top overlay | ✅ |
| Filter scrubber | No tab overlap | No tab overlap | No tab overlap | ✅ |
| Dev build required | Yes (for glass) | Yes (for native tabs) | Yes (for native tabs) | ✅ |

**Expo Go will not show native tabs or Liquid Glass correctly.** Use `npx expo run:ios` / `npx expo run:android`.

---

## Known Limitations

| Issue | Cause | Workaround / Future fix |
|-------|-------|-------------------------|
| Tab bar not minimizing on scroll | FlashList doesn't support native tab minimize | Refactor tab lists to native `ScrollView` wrapper, or wait for FlashList support |
| Liquid Glass only in dev builds | Not available in Expo Go | Use dev builds; iOS 26+ for full glass |
| Stack header full liquid glass | `react-native-screens` gap | May improve on Screens 4.23 — verify on device |
| PostHog red error toast offline | Analytics network failure | Separate from offline banner — suppress or queue flush |
| Auth screens custom headers | Intentional per design | Migrate only if parity desired |
| Content screens use flat `colors.*` | Incremental token rollout pending | Adopt `platform.*` / `usePlatformChrome()` over time |

---

## Anti-Patterns to Avoid

1. **One visual design for both platforms** — defeats the purpose
2. **Ionicons for navigation chrome** — use SF Symbols / Material Symbols
3. **Custom back buttons** when native stack provides them
4. **BlurView on Android** — Android users expect elevation/surfaces, not iOS-style blur
5. **Opacity animations on glass views** — breaks Liquid Glass rendering
6. **Heavy `Platform.OS` branching in screens** — branch in small platform components (`SheetBackground`, `IconSymbol`), not in every screen
7. **Gorhom sheet for simple pickers** — use `Alert` / `ActionSheetIOS` when a list of 3–5 options suffices
8. **`Appearance.setColorScheme()`** — can break iOS 26 nav bar blur on inactive tabs

---

## What's Next

```
Done:    Phases 1–8 (native shell, headers, materials, icons, pickers, Android, theme)
Done:    Smoke test on iOS + Android
Done:    SDK 55 upgrade + native tabs compound syntax + BottomAccessory

Next:    Rebuild native projects after SDK 55 upgrade
         └── npx expo prebuild --clean && npx expo run:ios && npx expo run:android

Then:    Adopt remaining SDK 55 APIs
         └── Stack.Toolbar for header actions
         └── Color.ios.* / Color.android.dynamic.* in platform-theme.ts
         └── Android tab icons via md Material Symbols prop

Optional polish:
         └── Content-screen token cleanup (platform.* tokens)
         └── PostHog offline flush suppression
         └── Tab minimize-on-scroll (ScrollView wrapper)
         └── Multi-currency picker (currently "Coming Soon")
```

---

## Bottom Line

| Question | Answer |
|----------|--------|
| Can both platforms feel native? | **Yes** — native tabs + native stack headers deliver this |
| Same UX? | **Yes** — routes, flows, and content components are shared |
| Different look? | **Yes** — iOS gets glass/SF Symbols; Android gets M3/Material Icons |
| Biggest change made? | Stopped building navigation chrome in React Native |
| What stays in RN? | Lists, forms, charts, business logic |
| Next lever? | Adopt `Stack.Toolbar` and `Color` API for remaining chrome polish |

The architectural flip is complete: **chrome is native, content is shared**.
