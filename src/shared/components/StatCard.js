import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { useTheme } from '../../core/theme/theme';

export default function StatCard({
  title,
  value,
  iconName,
  iconColor,
  trendText,
  trendType = 'neutral', // 'up' | 'down' | 'neutral'
  style,
  ...props
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const getTrendStyles = () => {
    switch (trendType) {
      case 'up':
        return {
          color: colors.success,
          icon: 'arrow-up',
        };
      case 'down':
        return {
          color: colors.error,
          icon: 'arrow-down',
        };
      case 'neutral':
      default:
        return {
          color: colors.textSecondary,
          icon: 'remove',
        };
    }
  };

  const trend = getTrendStyles();

  return (
    <Card style={[styles.card, style]} {...props}>
      <View style={styles.header}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: colors.textSecondary,
              fontSize: typography.sizes.sm,
              fontFamily: theme.typography.fontFamily.medium,
            },
          ]}
        >
          {title}
        </Text>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: iconColor ? `${iconColor}15` : `${colors.primary}15`,
            },
          ]}
        >
          <Ionicons
            name={iconName || 'bar-chart-outline'}
            size={18}
            color={iconColor || colors.primary}
          />
        </View>
      </View>

      <Text
        style={[
          styles.value,
          {
            color: colors.text,
            fontSize: typography.sizes.xxl,
            fontFamily: theme.typography.fontFamily.bold,
            marginVertical: spacing.xs,
          },
        ]}
      >
        {value}
      </Text>

      {trendText && (
        <View style={styles.trendRow}>
          <Ionicons name={trend.icon} size={14} color={trend.color} style={styles.trendIcon} />
          <Text
            style={[
              styles.trendText,
              {
                color: trend.color,
                fontSize: typography.sizes.xs,
                fontFamily: theme.typography.fontFamily.medium,
              },
            ]}
          >
            {trendText}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '500',
    flex: 1,
    marginRight: 4,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    marginRight: 2,
  },
  trendText: {
    fontWeight: '500',
  },
});
