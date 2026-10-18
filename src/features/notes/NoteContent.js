import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../core/theme/theme';
import { parseNoteBlocks, parseInline } from './markdown';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function InlineText({ text, style, colors }) {
  return (
    <Text style={style}>
      {parseInline(text).map((run, i) => (
        <Text
          key={i}
          style={[
            run.bold && { fontWeight: '800' },
            run.italic && { fontStyle: 'italic' },
            run.strike && { textDecorationLine: 'line-through' },
            run.code && { fontFamily: MONO, backgroundColor: colors.surfaceSecondary, color: colors.primary },
          ]}
        >
          {run.code ? ` ${run.text} ` : run.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * Read-only rendering of a note's markdown. Tapping a todo calls onToggleTodo(lineIndex).
 */
export default function NoteContent({ text, accentColor, onToggleTodo }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const accent = accentColor || colors.primary;
  const body = { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: theme.typography.fontFamily.regular };
  const blocks = parseNoteBlocks(text);

  if (!text || !text.trim()) {
    return (
      <Text style={{ color: colors.textMuted, fontSize: 15, fontStyle: 'italic' }}>
        This note is empty. Switch to Edit to start writing.
      </Text>
    );
  }

  return (
    <View>
      {blocks.map((b) => {
        const key = `${b.type}-${b.line}`;
        switch (b.type) {
          case 'h1':
          case 'h2':
          case 'h3': {
            const size = b.type === 'h1' ? 24 : b.type === 'h2' ? 20 : 17;
            return (
              <InlineText
                key={key}
                text={b.text}
                colors={colors}
                style={{ color: colors.text, fontSize: size, lineHeight: size * 1.3, fontWeight: '800', fontFamily: theme.typography.fontFamily.bold, marginTop: 10, marginBottom: 4 }}
              />
            );
          }
          case 'todo':
            return (
              <Pressable
                key={key}
                onPress={() => onToggleTodo?.(b.line)}
                hitSlop={4}
                style={[styles.row, { paddingLeft: b.indent * 8 }]}
              >
                <Ionicons
                  name={b.checked ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={b.checked ? accent : colors.textMuted}
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <InlineText
                  text={b.text}
                  colors={colors}
                  style={[body, { flex: 1 }, b.checked && { color: colors.textMuted, textDecorationLine: 'line-through' }]}
                />
              </Pressable>
            );
          case 'bullet':
            return (
              <View key={key} style={[styles.row, { paddingLeft: b.indent * 8 }]}>
                <Text style={[body, { width: 18, color: accent, fontWeight: '800' }]}>•</Text>
                <InlineText text={b.text} colors={colors} style={[body, { flex: 1 }]} />
              </View>
            );
          case 'numbered':
            return (
              <View key={key} style={[styles.row, { paddingLeft: b.indent * 8 }]}>
                <Text style={[body, { minWidth: 22, color: accent, fontWeight: '700' }]}>{b.number}.</Text>
                <InlineText text={b.text} colors={colors} style={[body, { flex: 1 }]} />
              </View>
            );
          case 'quote':
            return (
              <View key={key} style={[styles.quote, { borderLeftColor: accent, backgroundColor: `${accent}10` }]}>
                <InlineText text={b.text} colors={colors} style={[body, { fontStyle: 'italic', color: colors.textSecondary }]} />
              </View>
            );
          case 'code':
            return (
              <View key={key} style={[styles.code, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text selectable style={{ fontFamily: MONO, fontSize: 13, lineHeight: 19, color: colors.text }}>
                  {b.text || ' '}
                </Text>
              </View>
            );
          case 'divider':
            return <View key={key} style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />;
          case 'blank':
            return <View key={key} style={{ height: 10 }} />;
          default:
            return <InlineText key={key} text={b.text} colors={colors} style={[body, { marginVertical: 1 }]} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
  },
  quote: {
    borderLeftWidth: 3,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginVertical: 6,
    borderRadius: 4,
  },
  code: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
});
