/**
 * Friend Detail Screen
 * 
 * Shows all transactions with a specific friend.
 * Will be fully implemented in task 5.2
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FriendDetailScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const handleBack = () => {
    router.back();
  };

  const handleAddExpense = () => {
    router.push({
      pathname: '/add-expense',
      params: { friendId: params.id, friendName: params.name },
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          {params.name || 'Friend'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Friend Info Card */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={[styles.friendCard, { backgroundColor: cardBg }]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
          <Text style={styles.avatarText}>
            {getInitials(params.name || 'F')}
          </Text>
        </View>
        <Text style={[styles.friendName, { color: textColor }]}>
          {params.name || 'Friend'}
        </Text>
        <Text style={[styles.friendSubtitle, { color: secondaryTextColor }]}>
          Transaction history coming soon
        </Text>
      </MotiView>

      {/* Coming Soon Message */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
        style={[styles.comingSoon, { backgroundColor: cardBg }]}
      >
        <Ionicons name="construct-outline" size={48} color={colors.primary[500]} />
        <Text style={[styles.comingSoonTitle, { color: textColor }]}>
          Coming Soon
        </Text>
        <Text style={[styles.comingSoonText, { color: secondaryTextColor }]}>
          View all expenses and settlements with this friend
        </Text>
      </MotiView>

      {/* Add Expense Button */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
        style={styles.addExpenseContainer}
      >
        <Pressable
          onPress={handleAddExpense}
          style={[styles.addExpenseButton, { backgroundColor: colors.primary[500] }]}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.white} />
          <Text style={styles.addExpenseText}>Add Expense</Text>
        </Pressable>
      </MotiView>
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  friendCard: {
    alignItems: 'center',
    margin: 16,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  friendSubtitle: {
    fontSize: 14,
  },
  comingSoon: {
    alignItems: 'center',
    margin: 16,
    padding: 32,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    textAlign: 'center',
  },
  addExpenseContainer: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  addExpenseText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
