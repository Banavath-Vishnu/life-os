import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from './Button';
import { useTheme } from '../../core/theme/theme';

export default function EmptyState({
  title = 'No Items Found',
  description = 'Add some items to get started.',
  iconName = 'folder-open-outline',
  actionTitle,
  onActionPress,
  style,
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={[styles.container, { padding: spacing.xl }, style]}>
      <View style={[styles.iconWrapper, { backgroundColor: theme.dark ? colors.surfaceSecondary : '#F1F5F9' }]}>
        <Ionicons name={iconName} size={40} color={colors.textSecondary} />
      </View>

      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontFamily: theme.typography.fontFamily.bold,
            marginBottom: spacing.xs,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.description,
          {
            color: colors.textSecondary,
            fontSize: typography.sizes.sm,
            fontFamily: theme.typography.fontFamily.regular,
            marginBottom: actionTitle ? spacing.lg : 0,
          },
        ]}
      >
        {description}
      </Text>

      {actionTitle && onActionPress && (
        <Button
          title={actionTitle}
          onPress={onActionPress}
          variant="secondary"
          size="sm"
          style={styles.actionBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 260,
  },
  actionBtn: {
    alignSelf: 'auto',
    minWidth: 140,
  },
});
