# Settle

A modern expense splitting app for iOS and Android. Split bills with friends, track shared expenses, and settle up easily.

## Features

- **Split Expenses** - Equal splits among all or selected members
- **Groups** - Create groups for trips, roommates, events, and more
- **1:1 Expenses** - Quick expense tracking with individual friends
- **Multi-Currency** - Support for INR, USD, EUR, GBP, and more
- **Settlements** - Track payments and settle debts
- **Offline Support** - Full offline functionality with automatic sync
- **Real-time Sync** - Changes sync instantly across devices
- **Categories** - Organize expenses with icons and categories

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **Animations**: Moti + React Native Reanimated
- **State Management**: TanStack Query (React Query)
- **Storage**: AsyncStorage for offline data

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- iOS Simulator (Mac) or Android Emulator
- Expo Go app (for physical device testing)

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
   # Edit .env with your Supabase credentials
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Run on your device:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app for physical device

## Environment Setup

| File | Purpose |
|------|---------|
| `.env` | Environment variables (gitignored) |
| `.env.example` | Template for new developers (committed) |

### Building for Release

```bash
npm run build
```

## Project Structure

```
settle/
├── app/                    # Screens (file-based routing)
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab screens
│   ├── group/             # Group detail screens
│   └── friend/            # Friend detail screens
├── components/            # Reusable UI components
├── constants/             # Colors, themes, static data
├── contexts/              # React contexts (auth, sync)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge Functions
│   │   ├── _shared/       # Shared utilities
│   │   ├── send-otp/      # OTP sending
│   │   ├── verify-otp/    # OTP verification
│   │   ├── create-account/# Account creation
│   │   └── reset-password/# Password reset
│   └── migrations/        # Database migrations (source of truth)
└── types/                 # TypeScript type definitions
```

## Database Migrations

The database schema is managed through migrations in `supabase/migrations/`.

### Creating a New Migration

1. Create a new migration file:
   ```bash
   # Format: YYYYMMDDHHMMSS_description.sql
   touch supabase/migrations/20260203120000_add_new_feature.sql
   ```

2. Write your SQL changes in the file

3. Deploy to dev and test:
   ```bash
   npm run deploy:dev
   ```

4. When ready, deploy to prod:
   ```bash
   npm run deploy:prod
   ```

### Deployment Commands

```bash
npm run link:dev        # Link CLI to dev project
npm run link:prod       # Link CLI to prod project
npm run db:push         # Push migrations to linked project
npm run functions:deploy # Deploy Edge Functions to linked project
npm run deploy:dev      # Full deploy to dev (link + db + functions)
npm run deploy:prod     # Full deploy to prod (link + db + functions)
```

## Key Screens

| Screen | Description |
|--------|-------------|
| Home | Dashboard with balance summary and recent activity |
| Groups | List of expense groups |
| Friends | Individual friend balances |
| Profile | User settings and preferences |
| Add Expense | Create new expense with splits |
| Settle Up | Record payments between users |

## Offline Support

Settle works fully offline:
- Create expenses and settlements when offline
- Changes are queued and synced when back online
- Read-only access to synced data when offline
- Visual indicators for pending/unsynced items

## Authentication

- Phone number + OTP verification
- Secure password authentication
- Shadow user support (invite friends before they sign up)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software.
