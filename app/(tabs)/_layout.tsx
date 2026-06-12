import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSegments } from 'expo-router';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { AnimatePresence } from 'moti';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { OfflineBanner } from '@/components/ui/offline-banner';
import { brand } from '@/constants/colors';
import { useSync } from '@/contexts/sync-context';
import { usePlatformChrome } from '@/hooks/use-platform-chrome';
import { Analytics } from '@/lib/analytics';
import { NAV_EVENTS } from '@/lib/analytics-events';

const TAB_ANALYTICS: Record<string, string> = {
  index: NAV_EVENTS.TAB_HOME_VIEWED,
  friends: NAV_EVENTS.TAB_FRIENDS_VIEWED,
  groups: NAV_EVENTS.TAB_GROUPS_VIEWED,
  profile: NAV_EVENTS.TAB_PROFILE_VIEWED,
};

function TabAnalyticsListener() {
  const segments = useSegments();
  const lastTab = useRef<string | null>(null);

  useEffect(() => {
    if (segments[0] !== '(tabs)') return;

    const tab = segments[1] ?? 'index';
    if (tab === lastTab.current) return;

    const event = TAB_ANALYTICS[tab];
    if (event) {
      Analytics.track(event);
      lastTab.current = tab;
    }
  }, [segments]);

  return null;
}

export default function TabLayout() {
  const { isOnline } = useSync();
  const {
    tabBarBackground,
    tabIconDefault,
    useExplicitNativeChrome,
    iosTabBarBlurEffect,
  } = usePlatformChrome();

  return (
    <View style={{ flex: 1 }}>
      <TabAnalyticsListener />

      <AnimatePresence>
        {!isOnline && <OfflineBanner key="offline-banner" />}
      </AnimatePresence>

      {/*
        minimizeBehavior requires a native ScrollView as the screen's first child.
        FlashList (used on Home/Friends/Groups) does not support minimize-on-scroll yet.
        See: https://docs.expo.dev/router/advanced/native-tabs/#limited-support-for-flatlist
      */}
      <NativeTabs
        minimizeBehavior="onScrollDown"
        disableTransparentOnScrollEdge
        tintColor={brand.primary[500]}
        rippleColor={Platform.OS === 'android' ? brand.primary[100] : undefined}
        backgroundColor={useExplicitNativeChrome ? tabBarBackground : undefined}
        iconColor={useExplicitNativeChrome ? tabIconDefault : undefined}
        labelStyle={useExplicitNativeChrome ? { color: tabIconDefault } : undefined}
        blurEffect={iosTabBarBlurEffect}
      >
        <NativeTabs.Trigger name="index">
          <Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
          />
          <Label>Home</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="friends">
          <Icon
            sf={{ default: 'person.2', selected: 'person.2.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="people" />}
          />
          <Label>Friends</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="groups">
          <Icon
            sf={{ default: 'square.stack.3d.up', selected: 'square.stack.3d.up.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="layers" />}
          />
          <Label>Groups</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            androidSrc={<VectorIcon family={MaterialIcons} name="account-circle" />}
          />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}
