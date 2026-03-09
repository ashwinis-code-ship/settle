import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { AnimatePresence, MotiView } from 'moti';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSync } from '@/contexts/sync-context';
import { Analytics } from '@/lib/analytics';
import { NAV_EVENTS } from '@/lib/analytics-events';

/** Bounces to 115 % scale on focus — spring matches the FilterScrubber feel. */
function AnimatedTabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  focused: boolean;
}) {
  return (
    <MotiView
      animate={{ scale: focused ? 1.18 : 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 280 }}
    >
      <Ionicons name={name} size={24} color={color} />
    </MotiView>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { isOnline } = useSync();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: isDark ? colors.gray[900] : colors.background.light }}>
      {/* AnimatePresence activates the exit animation already written in OfflineBanner */}
      <AnimatePresence>
        {!isOnline && <OfflineBanner key="offline-banner" />}
      </AnimatePresence>

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary[500],
          tabBarInactiveTintColor: isDark ? colors.gray[500] : colors.gray[400],
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={isDark ? 70 : 85}
              tint={isDark ? 'dark' : 'light'}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: isDark ? colors.gray[700] : colors.gray[200],
                },
              ]}
            />
          ),
        }}
        screenListeners={{
          tabPress: (e) => {
            const routeName = e.target?.split('-')[0];
            const eventMap: Record<string, string> = {
              index: NAV_EVENTS.TAB_HOME_VIEWED,
              groups: NAV_EVENTS.TAB_GROUPS_VIEWED,
              friends: NAV_EVENTS.TAB_FRIENDS_VIEWED,
              profile: NAV_EVENTS.TAB_PROFILE_VIEWED,
            };
            if (routeName && eventMap[routeName]) {
              Analytics.track(eventMap[routeName]);
            }
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'home' : 'home-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'people' : 'people-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'layers' : 'layers-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon
                name={focused ? 'person-circle' : 'person-circle-outline'}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
