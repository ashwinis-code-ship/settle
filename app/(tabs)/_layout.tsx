import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Analytics } from '@/lib/analytics';
import { NAV_EVENTS } from '@/lib/analytics-events';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: isDark ? colors.gray[900] : colors.background.light }}>
      <OfflineBanner />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: isDark ? colors.gray[500] : colors.gray[400],
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? colors.gray[900] : colors.white,
          borderTopColor: isDark ? colors.gray[800] : colors.gray[200],
        },
      }}
      screenListeners={{
        tabPress: (e) => {
          // Extract route name from target (format: "routeName-uniqueId")
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'people' : 'people-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'layers' : 'layers-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? 'person-circle' : 'person-circle-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}
