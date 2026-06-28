import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../../core/theme/theme';

export default function LoadingState({
  type = 'spinner', // 'spinner' | 'skeleton'
  rows = 3,
  style,
}) {
  const { theme } = useTheme();
  const { colors, spacing, roundness } = theme;

  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (type === 'skeleton') {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.4, { duration: 600 })
        ),
        -1, // infinite loop
        true // reverse
      );
    }
  }, [type]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (type === 'spinner') {
    return (
      <View style={[styles.spinnerContainer, style]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Skeleton Loader layout
  return (
    <View style={[styles.skeletonContainer, style]}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: theme.dark ? colors.surfaceSecondary : '#FFFFFF',
              borderColor: colors.border,
              borderRadius: roundness.lg,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
            animatedStyle,
          ]}
        >
          {/* Skeleton Circle avatar */}
          <View style={[styles.skeletonCircle, { backgroundColor: colors.border }]} />
          
          {/* Skeleton text rows */}
          <View style={styles.skeletonTextContainer}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '70%', height: 16 }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%', height: 10, marginTop: 8 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  skeletonContainer: {
    alignSelf: 'stretch',
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  skeletonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 16,
  },
  skeletonTextContainer: {
    flex: 1,
  },
  skeletonLine: {
    borderRadius: 4,
  },
});
