/**
 * Home Screen
 * 
 * Main dashboard showing user info and logout option.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user, signOut } = useAuth();

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  // Get user info from metadata
  const userName = user?.user_metadata?.name || 'User';
  const userPhone = user?.user_metadata?.phone || '';

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.header}
        >
          <Text style={[styles.greeting, { color: secondaryTextColor }]}>
            Welcome back,
          </Text>
          <Text style={[styles.name, { color: textColor }]}>
            {userName} 👋
          </Text>
        </MotiView>

        {/* User Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}
          style={[styles.card, { backgroundColor: cardBg }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="person" size={32} color={colors.primary[500]} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: textColor }]}>{userName}</Text>
              <Text style={[styles.userPhone, { color: secondaryTextColor }]}>{userPhone}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }]} />

          {/* Stats Placeholder */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>0</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>Groups</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>₹0</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>You owe</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>₹0</Text>
              <Text style={[styles.statLabel, { color: secondaryTextColor }]}>You're owed</Text>
            </View>
          </View>
        </MotiView>

        {/* Coming Soon */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 400 }}
          style={styles.comingSoon}
        >
          <Ionicons name="construct-outline" size={48} color={colors.gray[400]} />
          <Text style={[styles.comingSoonText, { color: secondaryTextColor }]}>
            Groups & Expenses coming soon!
          </Text>
        </MotiView>

        {/* Logout Button */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 600 }}
          style={styles.logoutContainer}
        >
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { 
                backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>
              Sign Out
            </Text>
          </Pressable>
        </MotiView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
  },
  userPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    marginTop: 16,
  },
  logoutContainer: {
    paddingBottom: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
