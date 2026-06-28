import React from 'react';
import { StyleSheet, View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme/theme';

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
  onClear,
  ...props
}) {
  const { theme } = useTheme();
  const { colors, spacing, roundness } = theme;

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
    if (onClear) {
      onClear();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.dark ? colors.surfaceSecondary : '#FFFFFF',
          borderRadius: roundness.full,
          paddingHorizontal: spacing.md,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
    >
      <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            fontSize: theme.typography.sizes.md,
            fontFamily: theme.typography.fontFamily.regular,
          },
        ]}
        {...props}
      />
      {value ? (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    alignSelf: 'stretch',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
