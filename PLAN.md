# Settle - Implementation Plan

> A group expense sharing app for splitting bills and settling debts

---

## 📋 Requirements Summary

| Feature | Details |
|---------|---------|
| **Split Types** | Equal (all members), Equal (selected members) |
| **Settlements** | Prefilled amount, customizable, deducts from owed |
| **Categories** | Yes, with icons |
| **Currency** | Multi-currency, INR (₹) default |
| **Invites** | Add members by phone number |
| **Offline** | Full offline support, sync when online |

---

## 🗺️ Phase 1: Foundation & Data Layer

**Goal**: Set up database schema, types, and offline-first architecture

- [x] 1.1 Design Supabase database schema (tables, relationships, RLS policies) ✅
- [x] 1.2 Create TypeScript types for all entities ✅
- [x] 1.3 Set up offline storage with AsyncStorage + sync logic ✅
- [x] 1.4 Create data hooks (useGroups, useExpenses, useFriends, etc.) ✅

---

## 🔐 Phase 2: Authentication

**Goal**: Phone + password auth flow with beautiful UI

- [x] 2.1 Sign Up screen (phone, password, name) ✅
- [ ] 2.2 Sign In screen
- [ ] 2.3 Auth flow navigation (redirect based on auth state)
- [ ] 2.4 Profile setup / edit screen

---

## 👥 Phase 3: Groups

**Goal**: Create, view, and manage groups

- [ ] 3.1 Groups list screen (with group cards showing balance summary)
- [ ] 3.2 Create group screen (name, add members by phone)
- [ ] 3.3 Group detail screen (expenses list, member balances)
- [ ] 3.4 Add/remove members from group
- [ ] 3.5 Leave/delete group

---

## 💰 Phase 4: Expenses

**Goal**: Add and manage expenses with splits

- [ ] 4.1 Add expense screen
- [ ] 4.2 Split type selector (equal all / equal selected)
- [ ] 4.3 Member selector for partial splits
- [ ] 4.4 Category picker with icons
- [ ] 4.5 Currency selector (INR default)
- [ ] 4.6 Expense detail / edit screen
- [ ] 4.7 Delete expense

---

## 👤 Phase 5: Friends & Balances

**Goal**: Individual friend balances across all groups

- [ ] 5.1 Friends list screen (net balance per friend)
- [ ] 5.2 Friend detail screen (all transactions with that person)
- [ ] 5.3 Balance calculation logic (aggregate across groups)

---

## ✅ Phase 6: Settlements

**Goal**: Mark debts as paid

- [ ] 6.1 Settle up button (prefilled with owed amount)
- [ ] 6.2 Custom settlement amount input
- [ ] 6.3 Settlement history in friend detail
- [ ] 6.4 Settlement entries in group view

---

## 🏠 Phase 7: Dashboard & Polish

**Goal**: Home screen overview + animations

- [ ] 7.1 Dashboard with total owed/owing summary
- [ ] 7.2 Recent activity feed
- [ ] 7.3 Fluid animations throughout (Moti)
- [ ] 7.4 Empty states with illustrations
- [ ] 7.5 Loading skeletons

---

## 📴 Phase 8: Offline & Sync

**Goal**: Full offline support

- [ ] 8.1 Queue offline actions (create expense, settle, etc.)
- [ ] 8.2 Sync queue when online
- [ ] 8.3 Conflict resolution strategy
- [ ] 8.4 Sync status indicator

---

## ⚙️ Phase 9: Settings & Extras

**Goal**: User preferences and polish

- [ ] 9.1 Settings screen
- [ ] 9.2 Default currency preference
- [ ] 9.3 Notification preferences
- [ ] 9.4 About / Help
- [ ] 9.5 Sign out

---

## 📊 Database Schema

```sql
-- Users table
users
├── id (uuid, primary key)
├── phone (text, unique)
├── name (text)
├── avatar_url (text, nullable)
├── default_currency (text, default 'INR')
└── created_at (timestamp)

-- Groups table
groups
├── id (uuid, primary key)
├── name (text)
├── created_by (uuid, references users)
├── currency (text, default 'INR')
└── created_at (timestamp)

-- Group members junction table
group_members
├── group_id (uuid, references groups)
├── user_id (uuid, references users)
├── joined_at (timestamp)
└── PRIMARY KEY (group_id, user_id)

-- Expenses table
expenses
├── id (uuid, primary key)
├── group_id (uuid, references groups)
├── paid_by (uuid, references users)
├── amount (decimal)
├── currency (text)
├── description (text)
├── category (text)
├── created_at (timestamp)
└── created_by (uuid, references users)

-- Expense splits table
expense_splits
├── id (uuid, primary key)
├── expense_id (uuid, references expenses)
├── user_id (uuid, references users)
└── amount (decimal) -- their share

-- Settlements table
settlements
├── id (uuid, primary key)
├── group_id (uuid, nullable, references groups)
├── paid_by (uuid, references users)
├── paid_to (uuid, references users)
├── amount (decimal)
├── currency (text)
└── created_at (timestamp)
```

---

## 🎨 Categories

| Category | Icon | Color |
|----------|------|-------|
| Food & Drinks | 🍔 | #FF6B6B |
| Transport | 🚗 | #4ECDC4 |
| Shopping | 🛍️ | #45B7D1 |
| Entertainment | 🎬 | #96CEB4 |
| Accommodation | 🏨 | #FFEAA7 |
| Utilities | 💡 | #DDA0DD |
| Healthcare | 🏥 | #98D8C8 |
| Other | 📦 | #C9C9C9 |

---

## 💱 Supported Currencies

| Code | Symbol | Name |
|------|--------|------|
| INR | ₹ | Indian Rupee (default) |
| USD | $ | US Dollar |
| EUR | € | Euro |
| GBP | £ | British Pound |
| JPY | ¥ | Japanese Yen |
| AUD | A$ | Australian Dollar |
| CAD | C$ | Canadian Dollar |

---

## 📱 Screen Flow

```
Auth
├── Sign Up (phone + password + name)
└── Sign In (phone + password)

Main App (Bottom Tabs)
├── 🏠 Home (Dashboard)
│   ├── Total balance summary
│   └── Recent activity
│
├── 👥 Groups
│   ├── Groups List
│   └── Group Detail
│       ├── Expenses list
│       ├── Member balances
│       ├── Add Expense →
│       └── Settle Up →
│
├── 👤 Friends
│   ├── Friends List (net balances)
│   └── Friend Detail
│       ├── Transaction history
│       └── Settle Up →
│
└── ⚙️ Settings
    ├── Profile
    ├── Default currency
    ├── Notifications
    └── Sign out
```

---

## ⏱️ Time Estimates

| Phase | Description | Estimate |
|-------|-------------|----------|
| 1 | Foundation & Data Layer | 2-3 hours |
| 2 | Authentication | 1-2 hours |
| 3 | Groups | 2-3 hours |
| 4 | Expenses | 3-4 hours |
| 5 | Friends & Balances | 1-2 hours |
| 6 | Settlements | 1-2 hours |
| 7 | Dashboard & Polish | 1-2 hours |
| 8 | Offline & Sync | 2-3 hours |
| 9 | Settings & Extras | 1 hour |
| **Total** | | **~15-22 hours** |

---

## 📝 Progress Log

| Date | Phase | Tasks Completed | Notes |
|------|-------|-----------------|-------|
| 2026-01-20 | 1 | 1.1 Database Schema | Created `supabase/schema.sql` with tables, indexes, RLS policies, triggers, views, and seed data |
| 2026-01-20 | 1 | 1.2 TypeScript Types | Created `types/` folder with database.ts, models.ts, supabase.ts, index.ts |
| 2026-01-20 | 1 | 1.3 Offline Storage | Created storage.ts, sync-queue.ts, sync-manager.ts, use-network-status.ts, sync-context.tsx |
| 2026-01-20 | 1 | 1.4 Data Hooks | Created useUser, useCategories, useGroups, useGroup, useExpenses, useFriends, useSettlements |
| 2026-01-20 | 2 | 2.1 Sign Up Screen | Created auth layout, sign-up screen, Input/Button components, colors constants |

---

## 🚀 Next Steps

1. ~~Create Supabase tables via SQL~~ ✅
2. ~~Create TypeScript types for all entities~~ ✅
3. ~~Set up offline storage with AsyncStorage~~ ✅
4. ~~Build data hooks~~ ✅
5. **Next: Phase 2 - Authentication screens**
