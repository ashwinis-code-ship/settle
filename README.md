# Settle

A modern expense splitting app for iOS and Android. Split bills with friends and groups, track shared expenses, and settle up easily.

## Features

- **Split Expenses** — Equal splits among all or selected group members
- **Groups** — Create and manage groups for trips, roommates, events, and more
- **1:1 Expenses** — Quick expense tracking with individual friends
- **Multi-Currency** — INR, USD, EUR, GBP, and more
- **Settle Up** — Record payments and track who owes what
- **Balance Spectrum** — Visual bar showing each member's group balance at a glance
- **Offline Support** — Create expenses and settlements offline; changes sync when back online
- **Real-time Sync** — Changes propagate instantly across devices via Supabase Realtime
- **Categories** — Organize expenses with emoji icons and categories
- **Profile Photos** — Upload profile pictures; contact search shows in-app photos automatically
- **Shadow Users** — Add friends before they've signed up; their data merges when they join

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Routing | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime) |
| Data Fetching | TanStack Query (React Query v5) |
| Animations | Moti + React Native Reanimated 4 |
| Bottom Sheets | @gorhom/bottom-sheet v5 |
| Analytics | PostHog |
| Offline Queue | AsyncStorage-backed sync queue |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Xcode (iOS) or Android Studio (Android)
- Expo Go app for physical device testing

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd settle
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Fill in your Supabase project URL, anon key, and PostHog key
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Run on a device:
   - Press `i` — iOS Simulator
   - Press `a` — Android Emulator
   - Scan the QR code with Expo Go for a physical device

### Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog analytics key |

## Project Structure

```
settle/
├── app/                        # Screens (Expo Router file-based routing)
│   ├── _layout.tsx             # Root layout (auth guard, query client)
│   ├── (auth)/                 # Unauthenticated screens
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   ├── verify-otp.tsx
│   │   ├── set-password.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (tabs)/                 # Main tab navigator
│   │   ├── index.tsx           # Home — balance summary + recent activity
│   │   ├── friends.tsx         # Friends — per-friend net balances
│   │   ├── groups.tsx          # Groups — list of all groups
│   │   └── profile.tsx         # Profile — settings, photo, sign out
│   ├── add-expense.tsx         # Create a new expense
│   ├── create-group.tsx        # Create a new group
│   ├── settle-up.tsx           # Record a payment
│   ├── expense/[id].tsx        # Expense detail / edit
│   ├── friend/[id].tsx         # Friend detail — transaction history
│   ├── group/
│   │   ├── [id]/index.tsx      # Group detail — members, activity, spectrum bar
│   │   └── [id]/settings.tsx   # Group settings — rename, members, delete
│   └── settings/
│       └── about.tsx           # App version info
│
├── components/                 # Shared UI components
│   ├── ui/
│   │   ├── avatar.tsx          # Unified Avatar (user/group, circle/squircle, edit mode)
│   │   ├── balance-spectrum-bar.tsx  # Group balance visualisation
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── skeleton.tsx
│   │   ├── empty-state.tsx
│   │   ├── offline-banner.tsx
│   │   ├── country-picker.tsx
│   │   ├── contribution-bar.tsx
│   │   └── icon-symbol.tsx
│   ├── people-search-sheet.tsx # Unified contact + group bottom sheet picker
│   ├── group-settle-sheet.tsx  # Settle Up member selector
│   ├── edit-settlement-sheet.tsx
│   ├── filter-scrubber.tsx
│   └── haptic-tab.tsx
│
├── hooks/                      # Custom React hooks
│   ├── use-enriched-contacts.ts    # Device contacts + Supabase enrichment (photos, userId)
│   ├── use-contact-group-search.ts # Search layer on top of useEnrichedContacts
│   ├── use-groups.ts / use-group.ts
│   ├── use-friends.ts / use-friend-detail.ts
│   ├── use-expenses.ts / use-expense.ts
│   ├── use-settlements.ts
│   ├── use-direct-group.ts
│   ├── use-recent-activity.ts
│   ├── use-realtime-sync.ts
│   ├── use-network-status.ts
│   ├── use-user.ts
│   └── use-categories.ts
│
├── contexts/
│   ├── auth-context.tsx        # Current user session
│   └── sync-context.tsx        # Online/offline + sync state
│
├── lib/                        # Utilities and services
│   ├── supabase.ts             # Supabase client
│   ├── analytics.ts            # PostHog wrapper
│   ├── analytics-events.ts     # Event name constants
│   ├── sync-manager.ts         # Offline sync orchestration
│   ├── sync-queue.ts           # AsyncStorage-backed operation queue
│   ├── pending-items.ts        # Pending item tracking
│   ├── image-upload.ts         # Profile / group photo upload
│   ├── otp-service.ts          # OTP request helpers
│   ├── haptics.ts              # Haptic feedback helpers
│   ├── query-client.ts         # TanStack Query configuration
│   ├── storage.ts              # AsyncStorage helpers
│   └── utils.ts
│
├── constants/
│   ├── colors.ts               # Design system colour palette
│   └── theme.ts
│
├── types/                      # TypeScript type definitions
│   ├── index.ts
│   └── database.ts             # Supabase schema types + CURRENCIES map
│
└── supabase/
    ├── config.toml
    ├── migrations/             # SQL migrations (source of truth for schema)
    └── functions/              # Deno Edge Functions
        ├── _shared/            # Shared CORS / auth utilities
        ├── send-otp/
        ├── verify-otp/
        ├── create-account/
        └── reset-password/
```

## Key Screens

| Screen | Description |
|---|---|
| Home (`/`) | Net balance summary, recent activity feed |
| Friends (`/friends`) | All friends with net balance, quick-add expense |
| Groups (`/groups`) | All groups with balance indicator |
| Group Detail | Members, expense list, balance spectrum bar, settle-up sheet |
| Friend Detail | Transaction history, shared group balances |
| Add Expense | Search contacts/groups via bottom sheet, fill in split |
| Settle Up | Record a payment; available from home and group screens |
| Profile | Edit name/photo, sign out, manage account |

## Architecture Notes

### Contact Search
Contact/group search is split into three layers:

1. **`useEnrichedContacts`** — loads device contacts, batch-queries Supabase to attach `userId` and `avatarUrl` to each contact, and fetches the user's groups. Single source of truth.
2. **`useContactGroupSearch`** — thin search/filter wrapper over `useEnrichedContacts`. Used by `add-expense`.
3. **`PeopleSearchSheet`** — bottom sheet UI powered directly by `useEnrichedContacts`. Supports multi-select (group member adding) and single-select (add-expense) modes via `showGroups` and `selectedIds` props.

### Avatar Component
`components/ui/avatar.tsx` is the single component for all avatar rendering:
- `user` prop → circle, initials fallback
- `group` prop → squircle, people-icon fallback
- `groupImageUri` prop → squircle for local URIs (create-group form)
- `mode="edit"` → camera badge overlay, accepts `onEditPress` and `isUploading`

### Offline Support
- `SyncContext` tracks online/offline state via `useNetworkStatus`
- Mutations go through `SyncManager` which queues operations in `SyncQueue` (AsyncStorage) when offline
- On reconnect, queued operations replay in order
- Visual indicators (`OfflineBanner`, disabled actions) prevent data loss UX issues

### Shadow Users
When a user adds an expense with a phone contact who hasn't signed up yet, a shadow user row is created in the `users` table (`is_registered: false`). When that contact signs up with the same phone number, their account merges with the shadow record — all existing expenses and group memberships carry over.

## Database

Schema is managed through SQL migrations in `supabase/migrations/`. Migrations are the source of truth — never edit the Supabase dashboard schema directly.

### Deploy Commands

```bash
npm run deploy      # Link CLI → push migrations → deploy Edge Functions
npm run db:push     # Push migrations only (to linked project)
npm run functions:deploy  # Deploy Edge Functions only
```

Link the CLI to a project before deploying:
```bash
supabase link --project-ref <project-ref>
```

## Authentication

- Phone number → OTP verification → account creation
- Optional password for re-authentication
- Handled by Supabase Auth + custom Edge Functions (`send-otp`, `verify-otp`, `create-account`)

## License

Proprietary software. All rights reserved.
