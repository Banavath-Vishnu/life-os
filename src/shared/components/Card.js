import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../core/theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Card({
  children,
  onPress,
  style,
  glass = false,
  bordered = true,
  ...props
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 12, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { colors, roundness, spacing } = theme;

  const cardStyle = [
    styles.cardBase,
    {
      backgroundColor: glass
        ? theme.dark
          ? 'rgba(24, 24, 27, 0.7)' // Sleek translucent zinc in dark mode
          : 'rgba(255, 255, 255, 0.7)' // Translucent white in light mode
        : colors.surface,
      borderRadius: roundness.lg,
      padding: spacing.lg,
      borderColor: bordered ? colors.border : 'transparent',
      borderWidth: bordered ? 1 : 0,
      shadowColor: colors.cardShadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: theme.dark ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: theme.dark ? 2 : 4,
    },
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animatedStyle, cardStyle]}
        {...props}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
});
