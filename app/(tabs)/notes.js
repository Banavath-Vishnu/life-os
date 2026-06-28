import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useTheme, getCategoryColor, CATEGORY_COLORS } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import SearchBar from '../../src/shared/components/SearchBar';
import Card from '../../src/shared/components/Card';
import Button from '../../src/shared/components/Button';
import EmptyState from '../../src/shared/components/EmptyState';
import LoadingState from '../../src/shared/components/LoadingState';
import { selectAll, runQuery } from '../../src/core/db/sqlite';
import { Ionicons } from '@expo/vector-icons';

export default function NotesScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;

  const notesVersion = useStore((state) => state.notesVersion);
  const triggerNotesUpdate = useStore((state) => state.triggerNotesUpdate);
  const setActiveSheet = useStore((state) => state.setActiveSheet);

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Note Detail/Edit Modal State
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [editColor, setEditColor] = useState('#6366F1');

  // Category Dropdown and custom category picker states
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCustomCategoryActive, setIsCustomCategoryActive] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Dynamically compute existing categories that contain at least one note
  const categories = ['All', ...new Set(notes.map((n) => n.category).filter(Boolean))];
  const defaultCategories = ['General', 'Personal', 'Work', 'Ideas'];
  const dropdownCategories = [...new Set([...defaultCategories, ...notes.map((n) => n.category).filter(Boolean)])];

  const categoryColors = {
    General: '#6366F1', // indigo
    Personal: '#10B981', // emerald
    Work: '#F59E0B', // amber
    Ideas: '#EC4899', // pink
  };

  const loadNotes = async () => {
    try {
      const data = await selectAll('SELECT * FROM notes ORDER BY id DESC');
      setNotes(data || []);
    } catch (e) {
      console.warn('[Notes Screen] Error loading notes: ', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [notesVersion]);

  // Reset selected category filter to All if the category has been deleted
  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [notes, selectedCategory]);

  const deleteNote = async (id, title) => {
    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await runQuery('DELETE FROM notes WHERE id = ?', [id]);
              triggerNotesUpdate();
              if (isDetailVisible) setIsDetailVisible(false);
            } catch (err) {
              console.error(err);
            }
          },
        },
      ]
    );
  };

  const openNoteDetail = (note) => {
    setActiveNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setEditCategory(note.category);
    setEditColor(note.color || '#6366F1');
    setShowDropdown(false);
    setIsCustomCategoryActive(false);
    setCustomCategoryName('');
    setIsDetailVisible(true);
  };

  const saveNoteChanges = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'Note title cannot be empty.');
      return;
    }
    const finalCategory = isCustomCategoryActive ? (customCategoryName.trim() || 'General') : editCategory;
    if (!finalCategory.trim()) {
      Alert.alert('Validation Error', 'Category name cannot be empty.');
      return;
    }
    try {
      const sql = 'UPDATE notes SET title = ?, content = ?, category = ?, color = ?, updatedAt = ? WHERE id = ?';
      const timestamp = new Date().toISOString();
      const params = [editTitle, editContent, finalCategory, editColor, timestamp, activeNote.id];
      await runQuery(sql, params);
      triggerNotesUpdate();
      setIsDetailVisible(false);
      Alert.alert('Success', 'Note updated successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save note changes.');
    }
  };

  // Filter notes based on category and search query
  const filteredNotes = notes.filter((note) => {
    const matchesCategory = selectedCategory === 'All' || note.category === selectedCategory;
    const matchesSearch =
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      (note.content && note.content.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const renderNoteCard = ({ item }) => {
    const categoryColor = item.color || getCategoryColor(item.category);
    return (
      <Pressable onPress={() => openNoteDetail(item)} style={styles.noteCard}>
        <Card style={styles.noteCardInner} bordered>
          <View style={styles.noteHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}15` }]}>
              <Text style={[styles.categoryText, { color: categoryColor, fontSize: 10 }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                deleteNote(item.id, item.title);
              }}
              style={styles.deleteIcon}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </Pressable>
          </View>

          <Text
            numberOfLines={2}
            style={[
              styles.noteTitle,
              { color: colors.text, fontSize: typography.sizes.md, fontFamily: theme.typography.fontFamily.bold },
            ]}
          >
            {item.title}
          </Text>

          <Text
            numberOfLines={4}
            style={[
              styles.noteContent,
              {
                color: colors.textSecondary,
                fontSize: typography.sizes.sm,
                fontFamily: theme.typography.fontFamily.regular,
                marginTop: spacing.xs,
              },
            ]}
          >
            {item.content || 'No description provided.'}
          </Text>

          <Text style={[styles.noteDate, { color: colors.textMuted, fontSize: 10, marginTop: spacing.sm }]}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Title Row */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
        <Text
          style={[
            styles.screenTitle,
            {
              color: colors.text,
              fontSize: typography.sizes.xxl,
              fontFamily: theme.typography.fontFamily.bold,
            },
          ]}
        >
          My Notes
        </Text>
        <Pressable onPress={() => setActiveSheet('note')} style={styles.headerAddBtn}>
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search Input bar */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search title or content..." />
      </View>

      {/* Category Horizontal list */}
      <View style={styles.categoryScrollContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item)}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      fontFamily: theme.typography.fontFamily.medium,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <LoadingState type="skeleton" rows={3} />
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title={search ? 'No Match Found' : 'No Notes Yet'}
            description={
              search
                ? 'Try editing your keyword search query.'
                : 'Keep journals, store ideas, or log memories.'
            }
            onActionPress={search ? null : () => setActiveSheet('note')}
            actionTitle={search ? null : 'Create First Note'}
          />
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          numColumns={2}
          columnWrapperStyle={styles.rowGrid}
          showsVerticalScrollIndicator={false}
          renderItem={renderNoteCard}
          refreshing={loading}
          onRefresh={loadNotes}
        />
      )}

      {/* Full Screen View/Edit Modal */}
      {activeNote && (
        <Modal visible={isDetailVisible} animationType="slide" presentationStyle="overFullScreen">
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Pressable onPress={() => setIsDetailVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                View & Edit Note
              </Text>
              <Pressable onPress={() => deleteNote(activeNote.id, activeNote.title)} style={styles.modalDeleteBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.modalScroll, { padding: spacing.lg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Notion-Style Large Title */}
              <TextInput
                style={[
                  styles.notionTitleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.bold,
                    fontSize: 28,
                    fontWeight: '800',
                    lineHeight: 36,
                    marginBottom: 16,
                  },
                ]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Untitled"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              {/* Notion-Style Metadata Key-Value Table */}
              <View style={{ marginBottom: 16 }}>
                {/* Row 1: Category */}
                <View style={styles.metadataRow}>
                  <View style={styles.metadataLabelWrapper}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Category</Text>
                  </View>
                  <Pressable 
                    onPress={() => setShowDropdown(!showDropdown)} 
                    style={[
                      styles.notionSelectPill, 
                      { 
                        backgroundColor: (categoryColors[editCategory] || colors.primary) + '15',
                        borderColor: colors.border 
                      }
                    ]}
                  >
                    <Text style={[styles.notionSelectPillText, { color: categoryColors[editCategory] || colors.primary }]}>
                      {isCustomCategoryActive ? 'Others...' : editCategory}
                    </Text>
                    <Ionicons name="chevron-down" size={10} color={categoryColors[editCategory] || colors.primary} style={{ marginLeft: 4 }} />
                  </Pressable>
                </View>

                {/* Inline Dropdown Select Menu */}
                {showDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {dropdownCategories.map((cat) => {
                        const isCatSelected = !isCustomCategoryActive && editCategory === cat;
                        const catColor = categoryColors[cat] || colors.primary;
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => {
                              setEditCategory(cat);
                              setEditColor(catColor);
                              setShowDropdown(false);
                              setIsCustomCategoryActive(false);
                            }}
                            style={[
                              styles.dropdownItem, 
                              { borderColor: colors.border },
                              isCatSelected && { backgroundColor: `${colors.primary}10` }
                            ]}
                          >
                            <Text style={{ color: colors.text, fontSize: 13, fontFamily: theme.typography.fontFamily.medium }}>
                              {cat}
                            </Text>
                            {isCatSelected && (
                              <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                            )}
                          </Pressable>
                        );
                      })}
                      {/* Special Others... item */}
                      <Pressable
                        onPress={() => {
                          setIsCustomCategoryActive(true);
                          setShowDropdown(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          isCustomCategoryActive && { backgroundColor: `${colors.primary}10` }
                        ]}
                      >
                        <Ionicons name="add-circle" size={14} color={colors.accent} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: theme.typography.fontFamily.bold }}>
                          Others...
                        </Text>
                        {isCustomCategoryActive && (
                          <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                        )}
                      </Pressable>
                    </ScrollView>
                  </View>
                )}

                {/* Custom Category Input (shown when Others... is active) */}
                {isCustomCategoryActive && (
                  <View style={[styles.customCategoryWrapper, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, padding: 10, borderRadius: 8, marginBottom: 12 }]}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontFamily: theme.typography.fontFamily.medium }}>
                      Custom Category Name:
                    </Text>
                    <TextInput
                      style={{
                        color: colors.text,
                        fontFamily: theme.typography.fontFamily.medium,
                        fontSize: 13,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                      }}
                      value={customCategoryName}
                      onChangeText={setCustomCategoryName}
                      placeholder="Enter custom tag..."
                      placeholderTextColor={colors.textMuted}
                      autoFocus
                    />
                  </View>
                )}

                {/* Row 2: Created Date */}
                <View style={styles.metadataRow}>
                  <View style={styles.metadataLabelWrapper}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Created</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {new Date(activeNote.createdAt).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* Row 3: Card Color */}
                <View style={[styles.metadataRow, { alignItems: 'flex-start', marginTop: 6, marginBottom: 8 }]}>
                  <View style={[styles.metadataLabelWrapper, { paddingTop: 2 }]}>
                    <Ionicons name="color-palette-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>Color</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: 10 }}>
                    {CATEGORY_COLORS.map((col) => {
                      const isSelected = editColor === col;
                      return (
                        <Pressable
                          key={col}
                          onPress={() => setEditColor(col)}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: col,
                            borderWidth: isSelected ? 2 : 0,
                            borderColor: colors.text,
                            transform: [{ scale: isSelected ? 1.15 : 1 }],
                            marginBottom: 6,
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Notion-Style Divider Line */}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8, marginBottom: 16 }} />

              {/* Notion-Style Large Multiline Writing area */}
              <TextInput
                style={[
                  styles.notionContentInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    minHeight: 350,
                    textAlignVertical: 'top',
                  },
                ]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Start typing your note here..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Button
                title="Save Changes"
                onPress={saveNoteChanges}
                variant="primary"
                style={{ marginTop: spacing.xl, marginBottom: 40 }}
              />
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  headerAddBtn: {
    padding: 4,
  },
  screenTitle: {
    fontWeight: '800',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  categoryScrollContainer: {
    height: 48,
    marginBottom: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowGrid: {
    justifyContent: 'space-between',
  },
  noteCard: {
    width: '48%',
    marginBottom: 12,
  },
  noteCardInner: {
    flex: 1,
    padding: 12,
    margin: 0,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontWeight: '700',
  },
  deleteIcon: {
    padding: 4,
  },
  noteTitle: {
    fontWeight: '700',
  },
  noteContent: {
    lineHeight: 18,
  },
  noteDate: {
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 40,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingBottom: 80,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalCategoryBadge: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  titleInput: {
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
  contentInput: {
    borderWidth: 1,
    fontSize: 14,
    minHeight: 200,
  },
  notionTitleInput: {
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  notionContentInput: {
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metadataLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
  },
  metadataLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  notionSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  notionSelectPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  customCategoryWrapper: {
    borderWidth: 1,
  },
});
