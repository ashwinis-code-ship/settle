# PostHog Integration Plan for Settle

> **Project:** Settle - Expense Splitting App  
> **Region:** EU  
> **Host:** `https://eu.i.posthog.com`

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Foundation Setup](#phase-1-foundation-setup)
4. [Phase 2: User Identification](#phase-2-user-identification)
5. [Phase 3: Core Event Tracking](#phase-3-core-event-tracking)
6. [Phase 4: Funnel Definitions](#phase-4-funnel-definitions)
7. [Phase 5: Session Recording](#phase-5-session-recording)
8. [Phase 6: Feature Flags](#phase-6-feature-flags)
9. [Phase 7: Surveys](#phase-7-surveys)
10. [Event Schema Reference](#event-schema-reference)
11. [Dashboard Setup](#dashboard-setup)
12. [Privacy Considerations](#privacy-considerations)
13. [Testing Checklist](#testing-checklist)

---

## Overview

### Goals

1. **Understand user behavior** - Track how users interact with the app
2. **Optimize conversion funnels** - Identify and fix dropoff points
3. **Measure feature adoption** - Know which features drive engagement
4. **Enable data-driven decisions** - A/B test new features before full rollout
5. **Collect user feedback** - In-app surveys at key moments

### PostHog Features to Implement

| Feature | Priority | Phase |
|---------|----------|-------|
| Product Analytics (Events) | High | 1-3 |
| User Identification | High | 2 |
| Funnels | High | 4 |
| Session Recording | Medium | 5 |
| Feature Flags | Medium | 6 |
| Surveys | Low | 7 |

---

## Prerequisites

### 1. Environment Variables

Add to `.env.example`:

```env
# PostHog Analytics
EXPO_PUBLIC_POSTHOG_API_KEY=your_posthog_api_key
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Add to `.env`:

```env
# PostHog Analytics
EXPO_PUBLIC_POSTHOG_API_KEY=phc_auCaOoIEzWCHQsbyNxXhFlpfMk533rH7Va4Z1YzCPUY
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

### 2. Install Dependencies

```bash
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

**Note:** `expo-file-system` and `expo-application` are already in the project.

### 3. Project Structure

Create new files:

```
lib/
├── analytics.ts          # Analytics utility wrapper
├── analytics-events.ts   # Event name constants
contexts/
├── analytics-context.tsx # PostHog provider wrapper (optional)
```

---

## Phase 1: Foundation Setup

### 1.1 Create Analytics Configuration

**File:** `lib/analytics-events.ts`

```typescript
/**
 * PostHog Event Names
 * 
 * Naming convention: snake_case
 * Format: [object]_[action] (e.g., expense_created)
 */

// Authentication Events
export const AUTH_EVENTS = {
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_OTP_REQUESTED: 'sign_up_otp_requested',
  SIGN_UP_OTP_VERIFIED: 'sign_up_otp_verified',
  SIGN_UP_PASSWORD_SET: 'sign_up_password_set',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  SIGN_UP_FAILED: 'sign_up_failed',
  
  SIGN_IN_STARTED: 'sign_in_started',
  SIGN_IN_COMPLETED: 'sign_in_completed',
  SIGN_IN_FAILED: 'sign_in_failed',
  
  SIGN_OUT: 'sign_out',
  
  FORGOT_PASSWORD_STARTED: 'forgot_password_started',
  FORGOT_PASSWORD_OTP_REQUESTED: 'forgot_password_otp_requested',
  FORGOT_PASSWORD_COMPLETED: 'forgot_password_completed',
} as const;

// Expense Events
export const EXPENSE_EVENTS = {
  ADD_EXPENSE_STARTED: 'add_expense_started',
  ADD_EXPENSE_GROUP_SELECTED: 'add_expense_group_selected',
  ADD_EXPENSE_CONTACT_SELECTED: 'add_expense_contact_selected',
  ADD_EXPENSE_AMOUNT_ENTERED: 'add_expense_amount_entered',
  ADD_EXPENSE_CATEGORY_SELECTED: 'add_expense_category_selected',
  ADD_EXPENSE_COMPLETED: 'add_expense_completed',
  ADD_EXPENSE_FAILED: 'add_expense_failed',
  ADD_EXPENSE_CANCELLED: 'add_expense_cancelled',
  
  EXPENSE_VIEWED: 'expense_viewed',
  EXPENSE_EDITED: 'expense_edited',
  EXPENSE_DELETED: 'expense_deleted',
} as const;

// Settlement Events
export const SETTLEMENT_EVENTS = {
  SETTLE_UP_STARTED: 'settle_up_started',
  SETTLE_UP_FRIEND_SELECTED: 'settle_up_friend_selected',
  SETTLE_UP_AMOUNT_ENTERED: 'settle_up_amount_entered',
  SETTLE_UP_COMPLETED: 'settle_up_completed',
  SETTLE_UP_FAILED: 'settle_up_failed',
  SETTLE_UP_CANCELLED: 'settle_up_cancelled',
} as const;

// Group Events
export const GROUP_EVENTS = {
  CREATE_GROUP_STARTED: 'create_group_started',
  CREATE_GROUP_NAME_ENTERED: 'create_group_name_entered',
  CREATE_GROUP_MEMBERS_ADDED: 'create_group_members_added',
  CREATE_GROUP_COMPLETED: 'create_group_completed',
  CREATE_GROUP_FAILED: 'create_group_failed',
  CREATE_GROUP_CANCELLED: 'create_group_cancelled',
  
  GROUP_VIEWED: 'group_viewed',
  GROUP_SETTINGS_VIEWED: 'group_settings_viewed',
  GROUP_MEMBER_ADDED: 'group_member_added',
  GROUP_MEMBER_REMOVED: 'group_member_removed',
  GROUP_LEFT: 'group_left',
} as const;

// Friend Events
export const FRIEND_EVENTS = {
  FRIEND_ADDED: 'friend_added',
  FRIEND_VIEWED: 'friend_viewed',
} as const;

// Navigation Events
export const NAV_EVENTS = {
  TAB_HOME_VIEWED: 'tab_home_viewed',
  TAB_GROUPS_VIEWED: 'tab_groups_viewed',
  TAB_EXPLORE_VIEWED: 'tab_explore_viewed',
  TAB_PROFILE_VIEWED: 'tab_profile_viewed',
  
  SCREEN_VIEWED: 'screen_viewed',
} as const;

// Feature Usage Events
export const FEATURE_EVENTS = {
  SEARCH_PERFORMED: 'search_performed',
  CATEGORY_BROWSED: 'category_browsed',
  CURRENCY_CHANGED: 'currency_changed',
  PULL_TO_REFRESH: 'pull_to_refresh',
  CONTACT_PERMISSION_REQUESTED: 'contact_permission_requested',
  CONTACT_PERMISSION_GRANTED: 'contact_permission_granted',
  CONTACT_PERMISSION_DENIED: 'contact_permission_denied',
} as const;

// App Lifecycle Events
export const APP_EVENTS = {
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
  APP_FOREGROUNDED: 'app_foregrounded',
  OFFLINE_MODE_ENTERED: 'offline_mode_entered',
  ONLINE_MODE_RESTORED: 'online_mode_restored',
} as const;
```

### 1.2 Create Analytics Utility

**File:** `lib/analytics.ts`

```typescript
import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

// Initialize PostHog
const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog client
 * Call this once at app startup
 */
export async function initAnalytics(): Promise<void> {
  if (!posthogApiKey) {
    console.warn('[Analytics] PostHog API key not configured');
    return;
  }

  try {
    posthogClient = await PostHog.initAsync(posthogApiKey, {
      host: posthogHost,
      // Capture app lifecycle events automatically
      captureApplicationLifecycleEvents: true,
      // Capture screen views (we'll do this manually for more control)
      captureDeepLinks: true,
      // Flush events every 30 seconds or when 20 events queue
      flushAt: 20,
      flushInterval: 30000,
      // Enable debug mode in development
      debug: __DEV__,
    });

    console.log('[Analytics] PostHog initialized successfully');
  } catch (error) {
    console.error('[Analytics] Failed to initialize PostHog:', error);
  }
}

/**
 * Track an event
 */
export function track(eventName: string, properties?: Record<string, any>): void {
  if (!posthogClient) {
    if (__DEV__) {
      console.log('[Analytics] Track (not initialized):', eventName, properties);
    }
    return;
  }

  const enrichedProperties = {
    ...properties,
    app_version: Constants.expoConfig?.version,
    platform: Constants.platform?.ios ? 'ios' : 'android',
    timestamp: new Date().toISOString(),
  };

  posthogClient.capture(eventName, enrichedProperties);

  if (__DEV__) {
    console.log('[Analytics] Track:', eventName, enrichedProperties);
  }
}

/**
 * Identify a user
 * Call this after successful sign-in
 */
export function identify(
  userId: string,
  properties?: {
    phone?: string;
    name?: string;
    email?: string;
    created_at?: string;
    [key: string]: any;
  }
): void {
  if (!posthogClient) {
    if (__DEV__) {
      console.log('[Analytics] Identify (not initialized):', userId, properties);
    }
    return;
  }

  posthogClient.identify(userId, properties);

  if (__DEV__) {
    console.log('[Analytics] Identify:', userId, properties);
  }
}

/**
 * Set user properties without changing identity
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!posthogClient) return;

  // Use capture with $set to update person properties
  posthogClient.capture('$set', {
    $set: properties,
  });
}

/**
 * Set user properties that should only be set once (e.g., first_seen_at)
 */
export function setUserPropertiesOnce(properties: Record<string, any>): void {
  if (!posthogClient) return;

  posthogClient.capture('$set', {
    $set_once: properties,
  });
}

/**
 * Increment a numeric user property
 */
export function incrementUserProperty(property: string, value: number = 1): void {
  if (!posthogClient) return;

  // PostHog doesn't have direct increment, we track it as an event
  // and handle aggregation in PostHog
  track('user_property_increment', {
    property,
    value,
  });
}

/**
 * Reset user identity
 * Call this on sign-out
 */
export function reset(): void {
  if (!posthogClient) {
    if (__DEV__) {
      console.log('[Analytics] Reset (not initialized)');
    }
    return;
  }

  posthogClient.reset();

  if (__DEV__) {
    console.log('[Analytics] Reset');
  }
}

/**
 * Track a screen view
 */
export function trackScreen(screenName: string, properties?: Record<string, any>): void {
  track('screen_viewed', {
    screen_name: screenName,
    ...properties,
  });
}

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  if (!posthogClient) return false;

  try {
    return await posthogClient.isFeatureEnabled(flagKey);
  } catch {
    return false;
  }
}

/**
 * Get feature flag payload
 */
export async function getFeatureFlagPayload(flagKey: string): Promise<any> {
  if (!posthogClient) return null;

  try {
    return await posthogClient.getFeatureFlagPayload(flagKey);
  } catch {
    return null;
  }
}

/**
 * Reload feature flags
 */
export async function reloadFeatureFlags(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.reloadFeatureFlagsAsync();
  } catch (error) {
    console.error('[Analytics] Failed to reload feature flags:', error);
  }
}

/**
 * Manually flush events
 */
export async function flush(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.flush();
  } catch (error) {
    console.error('[Analytics] Failed to flush:', error);
  }
}

/**
 * Get the PostHog client instance
 * Use sparingly - prefer the utility functions above
 */
export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

// Export a convenience object
export const Analytics = {
  init: initAnalytics,
  track,
  identify,
  setUserProperties,
  setUserPropertiesOnce,
  reset,
  trackScreen,
  isFeatureEnabled,
  getFeatureFlagPayload,
  reloadFeatureFlags,
  flush,
};

export default Analytics;
```

### 1.3 Initialize in App Entry

**File:** `app/_layout.tsx` (modifications)

```typescript
// Add to imports
import { Analytics } from '@/lib/analytics';

// Add inside the root layout component, at the top of useEffect or component body
useEffect(() => {
  Analytics.init();
}, []);
```

---

## Phase 2: User Identification

### 2.1 Identify on Sign In

**File:** `contexts/auth-context.tsx` (modifications)

```typescript
// Add to imports
import { Analytics } from '@/lib/analytics';
import { AUTH_EVENTS } from '@/lib/analytics-events';

// Modify signIn function
const signIn = async (phone: string, password: string) => {
  Analytics.track(AUTH_EVENTS.SIGN_IN_STARTED, { phone_prefix: phone.slice(0, 4) });
  
  try {
    const email = phoneToEmail(phone);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Analytics.track(AUTH_EVENTS.SIGN_IN_FAILED, { 
        error_type: error.message?.includes('Invalid') ? 'invalid_credentials' : 'unknown'
      });
      // ... existing error handling
    }

    // On successful sign in, identify the user
    if (data.user) {
      Analytics.identify(data.user.id, {
        phone: phone,
        name: data.user.user_metadata?.name,
        created_at: data.user.created_at,
      });
      Analytics.track(AUTH_EVENTS.SIGN_IN_COMPLETED);
    }

    return { error: null };
  } catch (error) {
    Analytics.track(AUTH_EVENTS.SIGN_IN_FAILED, { error_type: 'exception' });
    // ... existing error handling
  }
};

// Modify signOut function
const signOut = async () => {
  Analytics.track(AUTH_EVENTS.SIGN_OUT);
  Analytics.reset(); // Important: Reset identity on sign out
  
  await syncManager.clearLocalData();
  await supabase.auth.signOut();
};
```

### 2.2 Identify on Session Restore

```typescript
// In the useEffect that gets initial session
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setIsLoading(false);

    // Identify returning user
    if (session?.user) {
      Analytics.identify(session.user.id, {
        phone: session.user.phone,
        name: session.user.user_metadata?.name,
      });
    }
  });
  // ... rest of effect
}, []);
```

---

## Phase 3: Core Event Tracking

### 3.1 Sign Up Flow

**File:** `app/(auth)/sign-up.tsx`

```typescript
// Track screen view on mount
useEffect(() => {
  Analytics.trackScreen('sign_up');
  Analytics.track(AUTH_EVENTS.SIGN_UP_STARTED);
}, []);

// Track OTP request
const handleGetOtp = async () => {
  // ... validation
  
  Analytics.track(AUTH_EVENTS.SIGN_UP_OTP_REQUESTED, {
    country_code: country.code,
  });
  
  // ... existing logic
};
```

**File:** `app/(auth)/verify-otp.tsx`

```typescript
// Track successful verification
if (result.success) {
  Analytics.track(AUTH_EVENTS.SIGN_UP_OTP_VERIFIED, {
    purpose: params.purpose,
  });
}
```

**File:** `app/(auth)/set-password.tsx`

```typescript
// Track password set
const handleSetPassword = async () => {
  // ... validation and API call
  
  if (success) {
    Analytics.track(AUTH_EVENTS.SIGN_UP_PASSWORD_SET);
    Analytics.track(AUTH_EVENTS.SIGN_UP_COMPLETED, {
      signup_method: 'phone_otp',
    });
    
    // Identify the new user
    Analytics.identify(userId, {
      phone: params.phone,
      name: params.name,
      signed_up_at: new Date().toISOString(),
    });
    
    // Set once properties
    Analytics.setUserPropertiesOnce({
      first_seen_at: new Date().toISOString(),
      signup_platform: Platform.OS,
    });
  }
};
```

### 3.2 Add Expense Flow

**File:** `app/add-expense.tsx`

```typescript
// Track screen view and start
useEffect(() => {
  Analytics.trackScreen('add_expense', {
    entry_point: params.groupId ? 'group' : params.friendId ? 'friend' : 'home',
  });
  Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_STARTED, {
    has_preselection: hasPreselection,
    is_direct_expense: isDirectExpense,
  });
}, []);

// Track group/contact selection
const handleSelectSearchResult = useCallback(async (result: SearchResult) => {
  if (result.type === 'group') {
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_GROUP_SELECTED, {
      group_id: result.id,
    });
  } else {
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_CONTACT_SELECTED, {
      is_existing_user: !!result.userId,
    });
  }
  // ... existing logic
}, []);

// Track category selection
const handleCategorySelect = (category: DbCategory) => {
  Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_CATEGORY_SELECTED, {
    category_id: category.id,
    category_name: category.name,
  });
  // ... existing logic
};

// Track successful submission
const handleSubmit = async () => {
  // ... validation and creation logic
  
  if (expenseId) {
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_COMPLETED, {
      expense_id: expenseId,
      amount: parseFloat(amount),
      currency: currency,
      category_id: selectedCategory?.id,
      category_name: selectedCategory?.name,
      split_type: splitType,
      member_count: splitBetween.length,
      is_group_expense: !!resolvedGroupId && !isDirectExpense,
      has_notes: notes.trim().length > 0,
    });
    
    // Update user properties
    Analytics.setUserProperties({
      last_expense_at: new Date().toISOString(),
      preferred_currency: currency,
    });
  } else {
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_FAILED, {
      error_stage: 'submission',
    });
  }
};

// Track cancellation (back button without submitting)
const handleBack = () => {
  if (amount || description) {
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_CANCELLED, {
      had_amount: !!amount,
      had_description: !!description,
    });
  }
  router.back();
};
```

### 3.3 Settle Up Flow

**File:** `app/settle-up.tsx`

```typescript
// Track screen view
useEffect(() => {
  Analytics.trackScreen('settle_up', {
    entry_point: params.friendId ? 'friend_detail' : 'home',
  });
  Analytics.track(SETTLEMENT_EVENTS.SETTLE_UP_STARTED, {
    has_prefilled_friend: !!params.friendId,
  });
}, []);

// Track friend selection
const handleSelectTarget = (target: SettleTarget) => {
  Analytics.track(SETTLEMENT_EVENTS.SETTLE_UP_FRIEND_SELECTED, {
    friend_id: target.user.id,
    balance_direction: target.balance > 0 ? 'they_owe_you' : 'you_owe_them',
    balance_amount: Math.abs(target.balance),
  });
  // ... existing logic
};

// Track successful settlement
const handleSubmit = async () => {
  // ... existing logic
  
  if (result) {
    Analytics.track(SETTLEMENT_EVENTS.SETTLE_UP_COMPLETED, {
      amount: parsedAmount,
      currency: selectedTarget.currency,
      direction: balance > 0 ? 'received' : 'paid',
      is_full_settlement: parsedAmount >= Math.abs(balance),
    });
    
    Analytics.setUserProperties({
      last_settlement_at: new Date().toISOString(),
    });
  } else {
    Analytics.track(SETTLEMENT_EVENTS.SETTLE_UP_FAILED);
  }
};
```

### 3.4 Create Group Flow

**File:** `app/create-group.tsx`

```typescript
// Track start
useEffect(() => {
  Analytics.trackScreen('create_group');
  Analytics.track(GROUP_EVENTS.CREATE_GROUP_STARTED);
}, []);

// Track completion
const handleCreateGroup = async () => {
  // ... existing logic
  
  if (groupId) {
    Analytics.track(GROUP_EVENTS.CREATE_GROUP_COMPLETED, {
      group_id: groupId,
      member_count: members.length + 1, // +1 for creator
      has_description: !!description.trim(),
    });
  } else {
    Analytics.track(GROUP_EVENTS.CREATE_GROUP_FAILED);
  }
};
```

### 3.5 Tab Navigation

**File:** `app/(tabs)/_layout.tsx`

```typescript
// Track tab changes
import { Analytics } from '@/lib/analytics';
import { NAV_EVENTS } from '@/lib/analytics-events';

// In the tab navigator, add listener
<Tabs
  screenListeners={{
    tabPress: (e) => {
      const routeName = e.target?.split('-')[0];
      const eventMap: Record<string, string> = {
        index: NAV_EVENTS.TAB_HOME_VIEWED,
        groups: NAV_EVENTS.TAB_GROUPS_VIEWED,
        explore: NAV_EVENTS.TAB_EXPLORE_VIEWED,
        profile: NAV_EVENTS.TAB_PROFILE_VIEWED,
      };
      if (routeName && eventMap[routeName]) {
        Analytics.track(eventMap[routeName]);
      }
    },
  }}
>
```

---

## Phase 4: Funnel Definitions

Once events are tracked, create these funnels in PostHog Dashboard:

### Funnel 1: Sign Up Conversion

**Name:** `Sign Up Funnel`

**Steps:**
1. `sign_up_started` - User lands on sign up screen
2. `sign_up_otp_requested` - User submits phone number
3. `sign_up_otp_verified` - User verifies OTP
4. `sign_up_password_set` - User sets password
5. `sign_up_completed` - Account created successfully

**Filters:**
- Conversion window: 30 minutes
- Breakdown by: `country_code`, `platform`

**Insights to gain:**
- What % of users complete sign up?
- Where is the biggest drop-off?
- Does conversion differ by country?

---

### Funnel 2: Add First Expense

**Name:** `First Expense Funnel`

**Steps:**
1. `sign_up_completed` - User just signed up
2. `add_expense_started` - User opens add expense
3. `add_expense_completed` - User creates expense

**Filters:**
- Conversion window: 24 hours
- User property: `$initial_referrer`

**Insights to gain:**
- What % of new users create their first expense?
- How long after signup do they create it?

---

### Funnel 3: Expense Creation Flow

**Name:** `Add Expense Funnel`

**Steps:**
1. `add_expense_started` - Opens add expense screen
2. `add_expense_group_selected` OR `add_expense_contact_selected` - Selects target
3. `add_expense_amount_entered` - Enters amount
4. `add_expense_category_selected` - Selects category (optional)
5. `add_expense_completed` - Successfully creates expense

**Filters:**
- Conversion window: 10 minutes
- Breakdown by: `entry_point`, `is_group_expense`

**Insights to gain:**
- Is the expense form too complex?
- Where do users abandon expense creation?

---

### Funnel 4: Settlement Flow

**Name:** `Settle Up Funnel`

**Steps:**
1. `settle_up_started` - Opens settle up
2. `settle_up_friend_selected` - Selects friend
3. `settle_up_completed` - Records payment

**Filters:**
- Conversion window: 5 minutes
- Breakdown by: `balance_direction`

**Insights to gain:**
- Do users complete settlements they start?
- Is there friction in the flow?

---

### Funnel 5: Group Creation

**Name:** `Create Group Funnel`

**Steps:**
1. `create_group_started` - Opens create group
2. `create_group_name_entered` - Enters group name
3. `create_group_members_added` - Adds at least one member
4. `create_group_completed` - Creates group

**Filters:**
- Conversion window: 10 minutes

---

### Funnel 6: Sign In Flow

**Name:** `Sign In Funnel`

**Steps:**
1. `sign_in_started` - Opens sign in
2. `sign_in_completed` OR `sign_in_failed` - Outcome

**Filters:**
- Breakdown by: `error_type` (for failures)

---

### Funnel 7: Password Reset

**Name:** `Password Reset Funnel`

**Steps:**
1. `forgot_password_started` - Opens forgot password
2. `forgot_password_otp_requested` - Requests OTP
3. `forgot_password_completed` - Successfully resets

---

## Phase 5: Session Recording

### Configuration

Add to analytics initialization:

```typescript
posthogClient = await PostHog.initAsync(posthogApiKey, {
  host: posthogHost,
  // Enable session recording for 20% of users
  sessionRecording: {
    // Only record identified users
    recordingMinimumDurationMilliseconds: 3000,
  },
});
```

### Privacy Masking

Ensure sensitive data is not recorded:

```typescript
// In PostHog config, add:
sessionRecording: {
  maskAllTextInputs: true,  // Mask all text inputs by default
  maskAllImages: false,      // Don't mask images
}
```

### Recommended Recording Strategy

| User Segment | Recording Rate | Reason |
|--------------|----------------|--------|
| New users (< 7 days) | 50% | Understand onboarding issues |
| Users with errors | 100% | Debug problems |
| Power users | 10% | Baseline behavior |
| All users | 20% | General insights |

---

## Phase 6: Feature Flags

### Recommended Feature Flags

| Flag Key | Type | Purpose |
|----------|------|---------|
| `new_expense_ui` | Boolean | Test new expense form design |
| `show_insights_tab` | Boolean | Roll out insights feature |
| `enable_multi_currency` | Boolean | Enable currency conversion |
| `settlement_reminders` | Boolean | Enable reminder notifications |
| `expense_photos` | Boolean | Allow photo attachments |

### Implementation Pattern

```typescript
// In a component
import { isFeatureEnabled } from '@/lib/analytics';

function MyComponent() {
  const [showNewUI, setShowNewUI] = useState(false);
  
  useEffect(() => {
    isFeatureEnabled('new_expense_ui').then(setShowNewUI);
  }, []);
  
  if (showNewUI) {
    return <NewExpenseUI />;
  }
  return <CurrentExpenseUI />;
}
```

---

## Phase 7: Surveys

### Recommended Surveys

#### Survey 1: First Expense NPS

**Trigger:** After `add_expense_completed` where user property `expense_count` = 1

**Question:** "How easy was it to add your first expense?"

**Type:** Rating (1-5 stars)

---

#### Survey 2: Feature Request

**Trigger:** After user has created 5+ expenses

**Question:** "What feature would make Settle better for you?"

**Type:** Open text

---

#### Survey 3: Churn Risk

**Trigger:** User hasn't opened app in 7 days

**Question:** "We noticed you haven't been using Settle. What's holding you back?"

**Type:** Multiple choice + Other

**Options:**
- I don't have shared expenses right now
- The app is too complicated
- I'm using a different app
- Missing features I need
- Other

---

## Event Schema Reference

### Complete Event List

| Event Name | Properties | Phase |
|------------|------------|-------|
| `sign_up_started` | - | 2 |
| `sign_up_otp_requested` | `country_code` | 2 |
| `sign_up_otp_verified` | `purpose` | 2 |
| `sign_up_password_set` | - | 2 |
| `sign_up_completed` | `signup_method` | 2 |
| `sign_up_failed` | `error_stage`, `error_type` | 2 |
| `sign_in_started` | `phone_prefix` | 2 |
| `sign_in_completed` | - | 2 |
| `sign_in_failed` | `error_type` | 2 |
| `sign_out` | - | 2 |
| `add_expense_started` | `entry_point`, `has_preselection` | 3 |
| `add_expense_group_selected` | `group_id` | 3 |
| `add_expense_contact_selected` | `is_existing_user` | 3 |
| `add_expense_category_selected` | `category_id`, `category_name` | 3 |
| `add_expense_completed` | `expense_id`, `amount`, `currency`, `category_id`, `split_type`, `member_count`, `is_group_expense` | 3 |
| `add_expense_failed` | `error_stage` | 3 |
| `add_expense_cancelled` | `had_amount`, `had_description` | 3 |
| `settle_up_started` | `entry_point`, `has_prefilled_friend` | 3 |
| `settle_up_friend_selected` | `friend_id`, `balance_direction`, `balance_amount` | 3 |
| `settle_up_completed` | `amount`, `currency`, `direction`, `is_full_settlement` | 3 |
| `settle_up_failed` | - | 3 |
| `create_group_started` | - | 3 |
| `create_group_completed` | `group_id`, `member_count` | 3 |
| `create_group_failed` | - | 3 |
| `group_viewed` | `group_id`, `member_count` | 3 |
| `expense_viewed` | `expense_id` | 3 |
| `tab_home_viewed` | - | 3 |
| `tab_groups_viewed` | - | 3 |
| `tab_explore_viewed` | - | 3 |
| `tab_profile_viewed` | - | 3 |
| `screen_viewed` | `screen_name` | 3 |

### User Properties

| Property | Type | Set When |
|----------|------|----------|
| `phone` | String | Sign up / Sign in |
| `name` | String | Sign up |
| `created_at` | DateTime | Sign up |
| `first_seen_at` | DateTime | First app open (set_once) |
| `signup_platform` | String | Sign up (set_once) |
| `last_expense_at` | DateTime | After expense creation |
| `last_settlement_at` | DateTime | After settlement |
| `preferred_currency` | String | After expense (most recent) |

---

## Dashboard Setup

### Recommended Dashboards

#### Dashboard 1: Growth Overview

**Widgets:**
1. Daily/Weekly Active Users (trend)
2. New Sign Ups (trend)
3. Sign Up Funnel (funnel)
4. DAU/MAU Ratio (formula)

---

#### Dashboard 2: Feature Adoption

**Widgets:**
1. Expenses Created (trend, by type)
2. Settlements Recorded (trend)
3. Groups Created (trend)
4. Feature Usage Breakdown (bar chart)

---

#### Dashboard 3: Funnel Health

**Widgets:**
1. Sign Up Funnel (funnel)
2. Add Expense Funnel (funnel)
3. Settle Up Funnel (funnel)
4. Conversion Rates Table (table)

---

#### Dashboard 4: User Engagement

**Widgets:**
1. Sessions per User (trend)
2. Events per Session (trend)
3. Retention Curve (retention)
4. Power Users (table)

---

## Privacy Considerations

### Data Not to Track

Never include in event properties:
- Full phone numbers (use prefix only: `+91xxx`)
- Passwords or tokens
- Exact expense descriptions (PII risk)
- Bank account details
- Full names of non-users

### GDPR Compliance

1. **Consent:** Add analytics consent in onboarding (if required)
2. **Data Export:** Use PostHog's data export for user requests
3. **Data Deletion:** Use PostHog's deletion API for "right to be forgotten"
4. **Anonymization:** Use `reset()` on logout

### Configuration for Privacy

```typescript
PostHog.initAsync(apiKey, {
  // Don't capture IP addresses
  captureMode: 'form',
  // Disable automatic pageview capture
  autocapture: false,
  // Session recording privacy
  sessionRecording: {
    maskAllTextInputs: true,
  },
});
```

---

## Testing Checklist

### Phase 1: Foundation
- [ ] PostHog SDK installed
- [ ] Environment variables configured
- [ ] Analytics utility created
- [ ] Initialization verified (check PostHog live events)

### Phase 2: User Identification
- [ ] Identify called on sign in
- [ ] Identify called on session restore
- [ ] Reset called on sign out
- [ ] User appears in PostHog People tab

### Phase 3: Events
- [ ] Sign up events firing correctly
- [ ] Sign in events firing correctly
- [ ] Add expense events firing correctly
- [ ] Settle up events firing correctly
- [ ] Create group events firing correctly
- [ ] Tab navigation events firing correctly

### Phase 4: Funnels
- [ ] Sign Up funnel created and showing data
- [ ] Add Expense funnel created and showing data
- [ ] Settle Up funnel created and showing data
- [ ] Funnel conversion rates visible

### Phase 5: Session Recording
- [ ] Recordings appearing in PostHog
- [ ] Sensitive data is masked
- [ ] Recording doesn't impact app performance

### Phase 6: Feature Flags
- [ ] Test flag created in PostHog
- [ ] `isFeatureEnabled` returning correct values
- [ ] Flag changes propagate correctly

### Phase 7: Surveys
- [ ] Survey created in PostHog
- [ ] Survey displays at correct trigger
- [ ] Responses collected

---

## Implementation Timeline

| Phase | Description | Estimated Effort |
|-------|-------------|------------------|
| Phase 1 | Foundation Setup | 2-3 hours |
| Phase 2 | User Identification | 1-2 hours |
| Phase 3 | Core Event Tracking | 4-6 hours |
| Phase 4 | Funnel Definitions (in PostHog UI) | 1-2 hours |
| Phase 5 | Session Recording | 1 hour |
| Phase 6 | Feature Flags | 2-3 hours |
| Phase 7 | Surveys | 1-2 hours |

**Total Estimated Effort:** 12-19 hours

---

## Next Steps

1. **Install dependencies** and set up environment variables
2. **Implement Phase 1-2** (foundation + identification)
3. **Add core events** (Phase 3) incrementally
4. **Create funnels** in PostHog dashboard
5. **Monitor data quality** for 1-2 weeks
6. **Enable session recording** after core events are stable
7. **Add feature flags** as you build new features
8. **Deploy surveys** based on user count

---

*Document created: February 2026*  
*PostHog Region: EU*  
*API Key: phc_auCaOoIEzWCHQsbyNxXhFlpfMk533rH7Va4Z1YzCPUY*
