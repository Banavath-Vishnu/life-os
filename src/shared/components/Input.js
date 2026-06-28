import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, interpolateColor, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../core/theme/theme';

export default function Input({
  label,
  error,
  value,
  onChangeText,
  onFocus,
  onBlur,
  style,
  inputStyle,
  containerStyle,
  iconLeft,
  iconRight,
  ...props
}) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const handleFocus = (e) => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
    if (onBlur) onBlur(e);
  };

  const animatedOutlineStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusAnim.value,
      [0, 1],
      [
        error ? theme.colors.error : theme.colors.border,
        error ? theme.colors.error : theme.colors.primary,
      ]
    );

    return {
      borderColor,
      borderWidth: 1.5,
    };
  });

  const { colors, spacing, roundness, typography } = theme;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: error ? colors.error : colors.textSecondary, fontSize: typography.sizes.sm, fontFamily: theme.typography.fontFamily.medium }]}>
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputWrapper,
          {
            borderRadius: roundness.md,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
          },
          animatedOutlineStyle,
          style,
        ]}
      >
        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: typography.sizes.md,
              fontFamily: theme.typography.fontFamily.regular,
              height: 48,
            },
            inputStyle,
          ]}
          {...props}
        />
        {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
      </Animated.View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error, fontSize: typography.sizes.xs }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  errorText: {
    marginTop: 4,
    fontWeight: '500',
  },
});
