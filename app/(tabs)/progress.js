import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, FlatList, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, getCategoryColor } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import Card from '../../src/shared/components/Card';
import Button from '../../src/shared/components/Button';
import EmptyState from '../../src/shared/components/EmptyState';
import LoadingState from '../../src/shared/components/LoadingState';
import { selectAll, runQuery } from '../../src/core/db/sqlite';

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;

  const expensesVersion = useStore((state) => state.expensesVersion);
  const targetsVersion = useStore((state) => state.targetsVersion);
  const triggerExpensesUpdate = useStore((state) => state.triggerExpensesUpdate);
  const triggerTargetsUpdate = useStore((state) => state.triggerTargetsUpdate);
  const setActiveSheet = useStore((state) => state.setActiveSheet);

  // Sub-tab view state: 'expenses' | 'targets'
  const activeTab = useStore((state) => state.progressSubTab);
  const setActiveTab = useStore((state) => state.setProgressSubTab);
  const [loading, setLoading] = useState(true);

  // Expenses States
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState('day'); // 'day' | 'week' | 'month'

  // Targets States
  const [targets, setTargets] = useState([]);
  const [targetCategoryFilter, setTargetCategoryFilter] = useState('All');

  // Targets Modal State
  const [isTargetModalVisible, setIsTargetModalVisible] = useState(false);
  const [activeTarget, setActiveTarget] = useState(null);
  const [editCompletedCount, setEditCompletedCount] = useState('');
  const [editTotalCount, setEditTotalCount] = useState('');

  // Load Data
  const loadExpensesData = async () => {
    try {
      const data = await selectAll('SELECT * FROM expenses ORDER BY date DESC');
      setExpenses(data || []);
    } catch (e) {
      console.warn('[Expenses] Error loading expenses:', e);
    }
  };

  const loadTargetsData = async () => {
    try {
      const data = await selectAll('SELECT * FROM targets ORDER BY id DESC');
      setTargets(data || []);
    } catch (e) {
      console.warn('[Targets] Error loading targets:', e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    if (activeTab === 'expenses') {
      await loadExpensesData();
    } else {
      await loadTargetsData();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab, expensesVersion, targetsVersion]);

  // Expenses Calculations
  const getPeriodStart = () => {
    const start = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 30);
    }
    return start.toISOString();
  };

  const filteredExpenses = expenses.filter((e) => e.date >= getPeriodStart());
  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Categories progress
  const categoryTotals = filteredExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});

  const categoriesList = ['Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Other'];

  const deleteExpense = async (id, title) => {
    Alert.alert('Delete Expense', `Are you sure you want to delete transaction "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM expenses WHERE id = ?', [id]);
            triggerExpensesUpdate();
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  // Targets handlers
  const openTargetDetail = (target) => {
    setActiveTarget(target);
    setEditCompletedCount(String(target.completedCount));
    setEditTotalCount(String(target.totalCount));
    setIsTargetModalVisible(true);
  };

  const deleteTarget = async (id, title) => {
    Alert.alert('Delete Target', `Are you sure you want to delete target goal "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM targets WHERE id = ?', [id]);
            triggerTargetsUpdate();
            setIsTargetModalVisible(false);
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  const saveTargetProgress = async () => {
    const completed = Number(editCompletedCount);
    const total = Number(editTotalCount);

    if (isNaN(completed) || isNaN(total) || total <= 0) {
      Alert.alert('Validation Error', 'Please enter valid completion steps.');
      return;
    }
    if (completed > total) {
      Alert.alert('Validation Error', 'Completed steps cannot exceed total steps.');
      return;
    }

    try {
      const percentage = Math.round((completed / total) * 100);
      await runQuery('UPDATE targets SET completedCount = ?, totalCount = ?, percentage = ? WHERE id = ?', [
        completed,
        total,
        percentage,
        activeTarget.id,
      ]);
      triggerTargetsUpdate();
      setIsTargetModalVisible(false);
      Alert.alert('Success', 'Target progress updated.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save progress.');
    }
  };

  // Targets stats
  const activeTargetsCount = targets.filter((t) => t.percentage < 100).length;
  const completedTargetsCount = targets.filter((t) => t.percentage === 100).length;

  const filteredTargets = targets.filter((t) => {
    if (targetCategoryFilter === 'All') return true;
    if (targetCategoryFilter === 'In Progress') return t.percentage < 100;
    return t.percentage === 100;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Title Row */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
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
          Progress
        </Text>
        <Pressable
          onPress={() => setActiveSheet(activeTab === 'expenses' ? 'expense' : 'target')}
          style={styles.headerAddBtn}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {/* Segmented Top Control (Expenses vs Targets) */}
      <View style={[styles.segmentContainer, { marginHorizontal: spacing.lg }]}>
        <Pressable
          onPress={() => setActiveTab('expenses')}
          style={[
            styles.segmentBtn,
            activeTab === 'expenses' && { backgroundColor: colors.surface, borderRadius: roundness.md - 2 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'expenses' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Expenses Tracker
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('targets')}
          style={[
            styles.segmentBtn,
            activeTab === 'targets' && { backgroundColor: colors.surface, borderRadius: roundness.md - 2 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'targets' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Targets Tracker
          </Text>
        </Pressable>
      </View>

      {activeTab === 'expenses' ? (
        /* ================= EXPENSES TRACKER VIEW ================= */
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Period Selector (Day, Week, Month) */}
          <View style={[styles.periodContainer, { backgroundColor: colors.surfaceSecondary, borderRadius: theme.roundness.md }]}>
            {['day', 'week', 'month'].map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodBtn,
                  period === p && { backgroundColor: colors.surface, borderRadius: theme.roundness.md - 2 },
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    {
                      color: period === p ? colors.primary : colors.textSecondary,
                      fontFamily: theme.typography.fontFamily.bold,
                    },
                  ]}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Hero Spending Card */}
          <Card style={[styles.heroCard, { backgroundColor: colors.primary }]}>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroLabel}>
                  {period === 'day' ? "Today's Spending" : period === 'week' ? 'Weekly Spending' : 'Monthly Spending'}
                </Text>
                <Text style={[styles.heroVal, { fontFamily: theme.typography.fontFamily.bold }]}>
                  ${totalSpent.toFixed(2)}
                </Text>
                <View style={styles.trendRow}>
                  <Ionicons name="trending-down" size={14} color="#6ffbbe" />
                  <Text style={styles.trendText}>vs last period</Text>
                </View>
              </View>

              {/* Svg Mini Chart rendering */}
              <View style={styles.chartWrapper}>
                <Svg width="110" height="60" viewBox="0 0 160 100">
                  <Path
                    d="M0 80 Q20 70 40 85 T80 60 T120 75 T160 30"
                    fill="none"
                    stroke="#ffffff70"
                    strokeWidth="3"
                  />
                  <Circle cx="160" cy="30" r="5" fill="#6ffbbe" />
                </Svg>
              </View>
            </View>
          </Card>

          {/* Categories Progress Breakdown */}
          <Text style={[styles.sectionLabelHeader, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Categories
          </Text>

          <View style={styles.categoriesContainer}>
            {categoriesList.map((cat, idx) => {
              const val = categoryTotals[cat] || 0;
              const pct = totalSpent > 0 ? Math.round((val / totalSpent) * 100) : 0;
              const c = getCategoryColor(cat);

              return (
                <View key={cat} style={[styles.catCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.catHeader}>
                    <Text style={[styles.catTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.medium }]}>
                      {cat}
                    </Text>
                    <Text style={[styles.catVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                      ${val.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.progressRow}>
                    <View style={[styles.progressBarOuter, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={[styles.progressBarInner, { backgroundColor: c, width: `${pct}%` }]} />
                    </View>
                    <Text style={[styles.pctText, { color: colors.textSecondary }]}>
                      {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Recent Transactions List */}
          <Text style={[styles.sectionLabelHeader, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Recent Transactions
          </Text>

          {loading ? (
            <LoadingState type="spinner" />
          ) : filteredExpenses.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
              No expenses recorded for this period.
            </Text>
          ) : (
            filteredExpenses.map((e) => (
              <View key={e.id} style={[styles.txCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconWrapper, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="card" size={18} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={[styles.txMerchant, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                      {e.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                      {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: colors.error, fontFamily: theme.typography.fontFamily.bold }]}>
                    -${e.amount.toFixed(2)}
                  </Text>
                  <Pressable onPress={() => deleteExpense(e.id, e.title)} style={styles.txDelete}>
                    <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        /* ================= TARGETS TRACKER VIEW ================= */
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Target Filters */}
          <View style={styles.targetFilterRow}>
            {['All', 'In Progress', 'Completed'].map((filter) => {
              const isSelected = targetCategoryFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setTargetCategoryFilter(filter)}
                  style={[
                    styles.targetFilterBadge,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.targetFilterText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grid of Targets */}
          {loading ? (
            <LoadingState type="spinner" />
          ) : filteredTargets.length === 0 ? (
            <EmptyState
              title="No Targets Found"
              description="Define short-term and long-term targets (AWS certification, books to read, workout goals) here."
              iconName="flag-outline"
              actionTitle="Create New Target"
              onActionPress={() => setActiveSheet('target')}
            />
          ) : (
            <View style={styles.targetsGrid}>
              {filteredTargets.map((item, idx) => {
                const c = getCategoryColor(item.category);
                
                return (
                  <Pressable key={item.id} onPress={() => openTargetDetail(item)}>
                    <Card style={styles.targetCardInner} bordered>
                      <View style={styles.targetCardHeader}>
                        <View style={styles.targetMetaRow}>
                          <View style={[styles.targetIconCircle, { backgroundColor: `${c}15` }]}>
                            <Ionicons name="ribbon" size={20} color={c} />
                          </View>
                          <View>
                            <Text style={[styles.targetTitleText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                              {item.title}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                              {item.category}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.targetPctBox, { backgroundColor: `${colors.primary}15` }]}>
                          <Text style={[styles.targetPctText, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
                            {item.percentage}%
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.targetProgressSection}>
                        <View style={[styles.targetProgressOuter, { backgroundColor: colors.surfaceSecondary }]}>
                          <View style={[styles.targetProgressInner, { backgroundColor: c, width: `${item.percentage}%` }]} />
                        </View>
                        <View style={styles.targetProgressFooter}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            {item.completedCount} / {item.totalCount} completed
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            Target: {item.dueDate}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Quick Targets Stats Section */}
          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatsBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Active Targets</Text>
              <Text style={[styles.quickStatsVal, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(activeTargetsCount).padStart(2, '0')}
              </Text>
            </View>
            <View style={[styles.quickStatsBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Completed Goals</Text>
              <Text style={[styles.quickStatsVal, { color: colors.success, fontFamily: theme.typography.fontFamily.bold }]}>
                {String(completedTargetsCount).padStart(2, '0')}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Target Detail / Progress editor Modal */}
      {activeTarget && (
        <Modal visible={isTargetModalVisible} animationType="slide" presentationStyle="overFullScreen">
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Pressable onPress={() => setIsTargetModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                Update Target Progress
              </Text>
              <Pressable onPress={() => deleteTarget(activeTarget.id, activeTarget.title)} style={styles.modalDeleteBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.modalScroll, { padding: spacing.lg }]} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 16, color: colors.text, fontFamily: theme.typography.fontFamily.bold }}>
                {activeTarget.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.lg }}>
                Category: {activeTarget.category} | Target Date: {activeTarget.dueDate}
              </Text>

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>Completed Progress Steps</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.bold,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    padding: spacing.md,
                  },
                ]}
                value={editCompletedCount}
                onChangeText={setEditCompletedCount}
                keyboardType="numeric"
                placeholder="e.g. 9"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.modalSectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Total Target Steps</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.bold,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    padding: spacing.md,
                  },
                ]}
                value={editTotalCount}
                onChangeText={setEditTotalCount}
                keyboardType="numeric"
                placeholder="e.g. 12"
                placeholderTextColor={colors.textMuted}
              />

              <Button
                title="Save Progress"
                onPress={saveTargetProgress}
                variant="primary"
                style={{ marginTop: spacing.xl }}
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
  segmentContainer: {
    flexDirection: 'row',
    height: 40,
    backgroundColor: '#0058bc10',
    padding: 3,
    borderRadius: 12,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  periodContainer: {
    flexDirection: 'row',
    height: 40,
    padding: 3,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodText: {
    fontSize: 13,
  },
  heroCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    color: '#ffffff80',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroVal: {
    color: '#FFFFFF',
    fontSize: 32,
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trendText: {
    color: '#FFFFFF80',
    fontSize: 11,
    marginLeft: 4,
  },
  chartWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabelHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 10,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  catCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitle: {
    fontSize: 13,
  },
  catVal: {
    fontSize: 13,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  pctText: {
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 8,
    width: 32,
    textAlign: 'right',
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  txMerchant: {
    fontSize: 13,
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txAmount: {
    fontSize: 13,
    marginRight: 12,
  },
  txDelete: {
    padding: 4,
  },
  targetFilterRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  targetFilterBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  targetFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetsGrid: {
    marginBottom: 16,
  },
  targetCardInner: {
    padding: 16,
    marginBottom: 12,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'start',
  },
  targetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  targetTitleText: {
    fontSize: 14,
  },
  targetPctBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  targetPctText: {
    fontSize: 12,
  },
  targetProgressSection: {
    marginTop: 14,
  },
  targetProgressOuter: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  targetProgressInner: {
    height: '100%',
    borderRadius: 3,
  },
  targetProgressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickStatsBox: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  quickStatsVal: {
    fontSize: 24,
    marginTop: 4,
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
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleInput: {
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 8,
  },
});
