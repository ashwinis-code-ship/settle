/**
 * Home Screen
 * 
 * Main dashboard showing user summary and quick actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  // Get user info from metadata
  const userName = user?.user_metadata?.name || 'User';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAddExpense = () => {
    Alert.alert('Coming Soon', 'Add expense functionality will be available soon.');
  };

  const handleCreateGroup = () => {
    router.push('/create-group');
  };

  const handleSettleUp = () => {
    Alert.alert('Coming Soon', 'Settle up functionality will be available soon.');
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
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: secondaryTextColor }]}>
              Welcome back,
            </Text>
            <Text style={[styles.name, { color: textColor }]}>
              {userName} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [
              styles.avatarButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.avatarSmall, { backgroundColor: colors.primary[500] }]}>
              <Text style={styles.avatarSmallText}>{userInitials}</Text>
            </View>
          </Pressable>
        </MotiView>

        {/* Balance Summary Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}
          style={[styles.balanceCard, { backgroundColor: colors.primary[500] }]}
        >
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>₹0.00</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-up-circle" size={20} color={colors.white} />
              <View>
                <Text style={styles.balanceItemLabel}>You're owed</Text>
                <Text style={styles.balanceItemValue}>₹0</Text>
              </View>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-down-circle" size={20} color={colors.white} />
              <View>
                <Text style={styles.balanceItemLabel}>You owe</Text>
                <Text style={styles.balanceItemValue}>₹0</Text>
              </View>
            </View>
          </View>
        </MotiView>

        {/* Quick Actions */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 300 }}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable 
              onPress={handleAddExpense}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary[500]} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Add Expense</Text>
            </Pressable>
            
            <Pressable 
              onPress={handleCreateGroup}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="people-outline" size={28} color={colors.success} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Create Group</Text>
            </Pressable>
            
            <Pressable 
              onPress={handleSettleUp}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="wallet-outline" size={28} color={colors.warning} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Settle Up</Text>
            </Pressable>
          </View>
        </MotiView>

        {/* Recent Activity Placeholder */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 400 }}
          style={styles.recentSection}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Activity</Text>
          <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
            <Ionicons name="receipt-outline" size={48} color={colors.gray[400]} />
            <Text style={[styles.emptyStateTitle, { color: textColor }]}>
              No recent activity
            </Text>
            <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>
              Your expenses and settlements will appear here
            </Text>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  avatarButton: {
    marginLeft: 16,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.8,
  },
  balanceItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.white,
    opacity: 0.3,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  recentSection: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

