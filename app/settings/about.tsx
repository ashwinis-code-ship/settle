/**
 * About Screen
 * 
 * App information, version, and support links.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Conditional import for expo-application (not available on web)
let Application: { nativeApplicationVersion: string | null; nativeBuildVersion: string | null } | null = null;
if (Platform.OS !== 'web') {
  Application = require('expo-application');
}
import { router } from 'expo-router';
import { MotiView } from 'moti';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hapticLight } from '@/lib/haptics';

export default function AboutScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const appVersion = Application?.nativeApplicationVersion || '1.0.0';
  const buildVersion = Application?.nativeBuildVersion || '1';

  const handleBack = () => {
    router.back();
  };

  const handleLink = (url: string) => {
    hapticLight();
    Linking.openURL(url);
  };

  const handleEmail = () => {
    hapticLight();
    Linking.openURL('mailto:support@settle.app?subject=Settle App Support');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo & Info */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          style={styles.logoSection}
        >
          <View style={[styles.logoContainer, { backgroundColor: colors.primary[500] }]}>
            <Ionicons name="wallet" size={48} color={colors.white} />
          </View>
          <Text style={[styles.appName, { color: textColor }]}>Settle</Text>
          <Text style={[styles.tagline, { color: secondaryTextColor }]}>
            Split expenses with friends
          </Text>
          <Text style={[styles.version, { color: secondaryTextColor }]}>
            Version {appVersion} ({buildVersion})
          </Text>
        </MotiView>

        {/* Support Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 100 }}
          style={[styles.card, { backgroundColor: cardBg }]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Support</Text>

          <Pressable
            style={styles.linkItem}
            onPress={handleEmail}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="mail-outline" size={20} color={colors.primary[500]} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: textColor }]}>Contact Support</Text>
              <Text style={[styles.linkSubtitle, { color: secondaryTextColor }]}>
                support@settle.app
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
          </Pressable>

          <Pressable
            style={[styles.linkItem, styles.linkItemLast]}
            onPress={() => handleLink('https://settle.app/faq')}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.info + '20' }]}>
              <Ionicons name="help-circle-outline" size={20} color={colors.info} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: textColor }]}>FAQ</Text>
              <Text style={[styles.linkSubtitle, { color: secondaryTextColor }]}>
                Frequently asked questions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
          </Pressable>
        </MotiView>

        {/* Legal Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={[styles.card, { backgroundColor: cardBg }]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Legal</Text>

          <Pressable
            style={styles.linkItem}
            onPress={() => handleLink('https://settle.app/privacy')}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.gray[200] }]}>
              <Ionicons name="shield-outline" size={20} color={colors.gray[600]} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: textColor }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
          </Pressable>

          <Pressable
            style={[styles.linkItem, styles.linkItemLast]}
            onPress={() => handleLink('https://settle.app/terms')}
          >
            <View style={[styles.linkIcon, { backgroundColor: colors.gray[200] }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.gray[600]} />
            </View>
            <View style={styles.linkContent}>
              <Text style={[styles.linkTitle, { color: textColor }]}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
          </Pressable>
        </MotiView>

        {/* Footer */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
          style={styles.footer}
        >
          <Text style={[styles.footerText, { color: secondaryTextColor }]}>
            Made with ❤️ for easy expense splitting
          </Text>
          <Text style={[styles.copyright, { color: secondaryTextColor }]}>
            © 2026 Settle. All rights reserved.
          </Text>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  linkItemLast: {
    borderBottomWidth: 0,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  linkSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 14,
    marginBottom: 8,
  },
  copyright: {
    fontSize: 12,
  },
});
