import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Modal, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../core/theme/theme';
import KeyboardSafeView from './KeyboardSafeView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BottomSheet({
  isVisible,
  onClose,
  title,
  children,
  snapPoint = 0.5, // Fraction of screen height (e.g. 0.5 for half screen)
}) {
  const { theme } = useTheme();
  const { colors, roundness, spacing } = theme;
  const insets = useSafeAreaInsets();

  const targetHeight = SCREEN_HEIGHT * snapPoint;
  
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Animate in
      translateY.value = withTiming(0, { duration: 200 });
      backdropOpacity.value = withTiming(0.6, { duration: 250 });
    } else {
      // Animate out
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 180 }, () => {
      runOnJS(onClose)();
    });
  };

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Sheet rides above the keyboard and shrinks to the space left (never under the status bar) */}
      <KeyboardSafeView style={[styles.container, { paddingTop: insets.top }]}>
        {({ keyboardOverlap, height }) => {
          // Space between the status bar and the keyboard (or screen bottom)
          const availableHeight = height > 0 ? height - insets.top - keyboardOverlap : targetHeight;
          const sheetHeight = Math.min(targetHeight, availableHeight);
          return (
        <>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { backgroundColor: '#0f172a' }, animatedBackdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={handleClose} />
        </Animated.View>

        {/* Sheet Contents */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: colors.surface,
              borderTopLeftRadius: roundness.xl,
              borderTopRightRadius: roundness.xl,
              borderWidth: 1,
              borderColor: colors.border,
            },
            animatedSheetStyle,
          ]}
        >
          {/* Header indicator */}
          <View style={styles.dragIndicatorWrapper}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.border }]} />
          </View>

          {/* Title Row */}
          <View style={[styles.headerRow, { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }]}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontSize: theme.typography.sizes.lg,
                  fontFamily: theme.typography.fontFamily.bold,
                },
              ]}
            >
              {title}
            </Text>
            <Pressable onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Child content scrollable/view */}
          {/* With the keyboard open the sheet already sits above it, so no nav-bar padding is needed */}
          <View style={[styles.content, { paddingHorizontal: spacing.lg, paddingBottom: keyboardOverlap ? spacing.sm : spacing.xl + insets.bottom }]}>
            {children}
          </View>
        </Animated.View>
        </>
          );
        }}
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 24,
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});
