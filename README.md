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
   - Copy `.env.example` to `.env` (if applicable)
   - Add your Supabase project URL and anon key

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your device:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app for physical device

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
├── supabase/              # Database schema and Edge Functions
│   ├── functions/         # Supabase Edge Functions
│   └── schema.sql         # Database schema
└── types/                 # TypeScript type definitions
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
