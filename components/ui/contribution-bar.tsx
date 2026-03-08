import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import type { GroupMemberBalance } from '@/types';

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

interface ContributionBarProps {
  balances: GroupMemberBalance[];
  currentUserId: string;
  isDark: boolean;
}

export function ContributionBar({ balances, currentUserId, isDark }: ContributionBarProps) {
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;

  const totalPaid = balances.reduce((sum, b) => sum + b.total_paid, 0);

  if (totalPaid === 0) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.emptyText, { color: secondaryTextColor }]}>No expenses yet</Text>
      </View>
    );
  }

  const contributors = balances
    .filter(b => b.total_paid > 0)
    .sort((a, b) => b.total_paid - a.total_paid)
    .map((b, i) => ({
      ...b,
      percentage: (b.total_paid / totalPaid) * 100,
      color: colors.chart[i % colors.chart.length],
    }));

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.barContainer}>
        {contributors.map((contributor, index) => {
          const isFirst = index === 0;
          const isLast = index === contributors.length - 1;
          const showLabel = contributor.percentage >= 12;
          const label = contributor.user.id === currentUserId ? 'You' : getInitials(contributor.user.name);

          return (
            <View
              key={contributor.user.id}
              style={[
                styles.segment,
                {
                  width: `${contributor.percentage}%`,
                  backgroundColor: contributor.color,
                  borderTopLeftRadius: isFirst ? 8 : 0,
                  borderBottomLeftRadius: isFirst ? 8 : 0,
                  borderTopRightRadius: isLast ? 8 : 0,
                  borderBottomRightRadius: isLast ? 8 : 0,
                },
              ]}
            >
              {showLabel && <Text style={styles.segmentLabel}>{label}</Text>}
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {contributors.map(contributor => (
          <View key={contributor.user.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: contributor.color }]} />
            <Text style={[styles.legendName, { color: secondaryTextColor }]} numberOfLines={1}>
              {contributor.user.id === currentUserId ? 'You' : contributor.user.name.split(' ')[0]}
            </Text>
            <Text style={[styles.legendAmount, { color: textColor }]}>
              ₹{contributor.total_paid.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 8,
  },
  barContainer: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    fontSize: 12,
    maxWidth: 60,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '600',
  },
});
