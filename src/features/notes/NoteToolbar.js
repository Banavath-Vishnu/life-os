import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../core/theme/theme';

// label: short text shown on the button; icon: Ionicons name (used when no label)
const TOOLS = [
  { id: 'todo', icon: 'checkbox-outline', a11y: 'To-do' },
  { id: 'h1', label: 'H1', a11y: 'Heading 1' },
  { id: 'h2', label: 'H2', a11y: 'Heading 2' },
  { id: 'h3', label: 'H3', a11y: 'Heading 3' },
  { id: 'bullet', icon: 'list-outline', a11y: 'Bullet list' },
  { id: 'numbered', label: '1.', a11y: 'Numbered list' },
  { id: 'quote', icon: 'chatbox-ellipses-outline', a11y: 'Quote' },
  { id: 'codeblock', icon: 'code-slash-outline', a11y: 'Code block' },
  { id: 'bold', label: 'B', bold: true, a11y: 'Bold' },
  { id: 'italic', label: 'I', italic: true, a11y: 'Italic' },
  { id: 'strike', label: 'S', strike: true, a11y: 'Strikethrough' },
  { id: 'code', label: '</>', a11y: 'Inline code' },
  { id: 'divider', icon: 'remove-outline', a11y: 'Divider' },
];

/**
 * Horizontal formatting toolbar for the note editor. Calls onAction(toolId).
 */
export default function NoteToolbar({ onAction }) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      contentContainerStyle={styles.content}
    >
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.id}
          onPress={() => onAction(tool.id)}
          accessibilityLabel={tool.a11y}
          style={({ pressed }) => [styles.btn, pressed && { backgroundColor: `${colors.primary}20` }]}
        >
          {tool.label ? (
            <Text
              style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: tool.bold ? '900' : '700',
                fontStyle: tool.italic ? 'italic' : 'normal',
                textDecorationLine: tool.strike ? 'line-through' : 'none',
              }}
            >
              {tool.label}
            </Text>
          ) : (
            <Ionicons name={tool.icon} size={19} color={colors.text} />
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  btn: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
