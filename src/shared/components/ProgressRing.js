import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../core/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  progress = 0, // Value between 0 and 1
  size = 120,
  strokeWidth = 12,
  color,
  trackColor,
  showLabel = true,
  labelStyle,
}) {
  const { theme } = useTheme();
  const themeColor = color || theme.colors.primary;
  const themeTrackColor = trackColor || theme.colors.border;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    // Clamping progress between 0 and 1
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    animatedProgress.value = withSpring(clampedProgress, {
      damping: 15,
      stiffness: 90,
    });
  }, [progress]);

  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - animatedProgress.value * circumference;
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={themeTrackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={themeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedCircleProps}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {showLabel && (
        <View style={styles.labelContainer}>
          <Text
            style={[
              styles.percentageText,
              {
                color: theme.colors.text,
                fontSize: size * 0.18,
                fontFamily: theme.typography.fontFamily.bold,
              },
              labelStyle,
            ]}
          >
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  labelContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontWeight: '700',
  },
});
