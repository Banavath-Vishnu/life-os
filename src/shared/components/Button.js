import React from 'react';
import { StyleSheet, Text, ActivityIndicator, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../core/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'text' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  textStyle,
  ...props
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.96, { damping: 10, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Styles based on variant
  const getVariantStyles = () => {
    const { colors, border } = theme;
    switch (variant) {
      case 'secondary':
        return {
          button: { backgroundColor: colors.primaryLight },
          text: { color: colors.primary },
        };
      case 'outline':
        return {
          button: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          text: { color: colors.primary },
        };
      case 'text':
        return {
          button: { backgroundColor: 'transparent' },
          text: { color: colors.primary },
        };
      case 'danger':
        return {
          button: { backgroundColor: colors.error },
          text: { color: '#FFFFFF' },
        };
      case 'primary':
      default:
        return {
          button: { backgroundColor: colors.primary },
          text: { color: '#FFFFFF' },
        };
    }
  };

  // Styles based on size
  const getSizeStyles = () => {
    const { spacing, typography } = theme;
    switch (size) {
      case 'sm':
        return {
          button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
          text: { fontSize: typography.sizes.sm },
        };
      case 'lg':
        return {
          button: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
          text: { fontSize: typography.sizes.lg },
        };
      case 'md':
      default:
        return {
          button: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
          text: { fontSize: typography.sizes.md },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const { colors, roundness } = theme;

  const combinedButtonStyles = [
    styles.baseButton,
    { borderRadius: roundness.md },
    variantStyles.button,
    sizeStyles.button,
    disabled && { opacity: 0.5 },
    style,
  ];

  const combinedTextStyles = [
    styles.baseText,
    { fontFamily: theme.typography.fontFamily.bold },
    variantStyles.text,
    sizeStyles.text,
    textStyle,
  ];

  return (
    <AnimatedPressable
      onPress={!disabled && !loading ? onPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, combinedButtonStyles]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary} size="small" />
      ) : (
        <>
          {iconLeft && <Animated.View style={styles.iconLeft}>{iconLeft}</Animated.View>}
          <Text style={combinedTextStyles}>{title}</Text>
          {iconRight && <Animated.View style={styles.iconRight}>{iconRight}</Animated.View>}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  baseText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
