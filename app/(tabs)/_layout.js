import React, { useState, useEffect, useRef } from 'react';
import { Tabs, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, getCategoryColor, CATEGORY_COLORS } from '../../src/core/theme/theme';
import BottomSheet from '../../src/shared/components/BottomSheet';
import Button from '../../src/shared/components/Button';
import Input from '../../src/shared/components/Input';
import { ScrollView, StyleSheet, Text, View, Pressable, Alert, TextInput, Image } from 'react-native';
import TimePickerModal from '../../src/shared/components/TimePickerModal';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskFormSchema } from '../../src/features/tasks/schemas';
import { noteFormSchema } from '../../src/features/notes/schemas';
import { progressLogSchema } from '../../src/features/progress/schemas';
import { runQuery, selectAll } from '../../src/core/db/sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../src/core/store/store';
import { scheduleTaskNotifications, scheduleRoutineNotifications } from '../../src/core/notifications/notificationManager';
import { getLocalTodayStr, getLocalISOString } from '../../src/core/utils/date';
import { z } from 'zod';
import { getExpenseCategories, isDefaultExpenseCategory, MAX_CATEGORY_NAME_LENGTH } from '../../src/features/progress/categories';
import NoteToolbar from '../../src/features/notes/NoteToolbar';
import { applyNoteTool } from '../../src/features/notes/markdown';

// Routine Item Schema
const routineFormSchema = z.object({
  title: z.string().trim().min(1, { message: 'Routine title is required' }),
  time: z.string().trim().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Time must be in HH:MM format' }).optional().or(z.literal('')),
  details: z.string().trim().optional(),
  frequency: z.string().trim().default('daily'),
  endTime: z.string().trim().optional().or(z.literal('')),
});

// Expense Schema
const expenseFormSchema = z.object({
  title: z.string().trim().min(1, { message: 'Merchant/Item title is required' }),
  amount: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number({ error: 'Amount must be a number' }).positive({ message: 'Amount must be positive' })
  ),
  category: z.string().trim().min(1, { message: 'Category is required' }),
});

// Target Schema
const targetFormSchema = z.object({
  title: z.string().trim().min(1, { message: 'Target title is required' }),
  category: z.string().trim().min(1, { message: 'Category is required' }),
  totalCount: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number({ error: 'Total steps must be a number' }).int().positive({ message: 'Total must be positive' })
  ),
  dueDate: z.string().trim().min(1, { message: 'Due date is required' }),
});

export default function TabsLayout() {
  const { theme } = useTheme();
  const { colors, spacing, roundness } = theme;
  const insets = useSafeAreaInsets();
  const activeSheet = useStore((state) => state.activeSheet);
  const setActiveSheet = useStore((state) => state.setActiveSheet);
  const prefilledDate = useStore((state) => state.prefilledDate);
  const setPrefilledDate = useStore((state) => state.setPrefilledDate);
  const user = useStore((state) => state.user);
  const pathname = usePathname();

  // Center "+" adds an item for the current tab; Home/Profile keep the Quick Add menu
  const handlePlusPress = () => {
    const { tasksSubTab, progressSubTab, tasksSelectedDate } = useStore.getState();
    if (pathname.startsWith('/notes')) {
      setActiveSheet('note');
    } else if (pathname.startsWith('/tasks')) {
      if (tasksSelectedDate && tasksSelectedDate < getLocalTodayStr()) {
        Alert.alert('Restricted Action', 'Adding tasks/routines for past dates is disabled.');
        return;
      }
      setPrefilledDate(tasksSelectedDate || getLocalTodayStr()); // create on the day being viewed
      setActiveSheet(tasksSubTab === 'routine' ? 'routine' : 'task');
    } else if (pathname.startsWith('/progress')) {
      setPrefilledDate('');
      setActiveSheet(progressSubTab === 'targets' ? 'target' : 'expense');
    } else {
      setPrefilledDate('');
      setActiveSheet('quick_add');
    }
  };

  const [timePickerTarget, setTimePickerTarget] = useState(null);

  // Expense categories (built-in + user-created)
  const customExpenseCategories = useStore((state) => state.customExpenseCategories);
  const addExpenseCategory = useStore((state) => state.addExpenseCategory);
  const removeExpenseCategory = useStore((state) => state.removeExpenseCategory);
  const [isAddingExpenseCategory, setIsAddingExpenseCategory] = useState(false);
  const [newExpenseCategoryName, setNewExpenseCategoryName] = useState('');
  const expenseCategoryOptions = getExpenseCategories(customExpenseCategories);

  const handleCreateExpenseCategory = (onChange) => {
    const name = newExpenseCategoryName.trim();
    if (!name) {
      Alert.alert('Category Name', 'Please enter a name for the new category.');
      return;
    }
    if (name.length > MAX_CATEGORY_NAME_LENGTH) {
      Alert.alert('Category Name', `Keep it to ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`);
      return;
    }
    const existing = expenseCategoryOptions.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) addExpenseCategory(name);
    onChange(existing || name);
    setNewExpenseCategoryName('');
    setIsAddingExpenseCategory(false);
  };

  const handleRemoveExpenseCategory = (name, value, onChange) => {
    if (isDefaultExpenseCategory(name)) return;
    Alert.alert(
      'Remove Category',
      `Remove "${name}" from the list? Expenses already logged under it keep their category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeExpenseCategory(name);
            if (value === name) onChange('Food & Dining');
          },
        },
      ]
    );
  };

  // Quick-add note: formatting toolbar (same tools as the note editor)
  const quickNoteInputRef = useRef(null);
  const quickNoteSelectionRef = useRef({ start: 0, end: 0 });
  const handleQuickNoteTool = (tool) => {
    const text = getNoteValues('content') || '';
    const result = applyNoteTool(text, quickNoteSelectionRef.current, tool);
    if (!result) return;
    setNoteValue('content', result.text, { shouldDirty: true });
    quickNoteSelectionRef.current = result.selection;
    setTimeout(() => {
      quickNoteInputRef.current?.focus();
      quickNoteInputRef.current?.setSelection?.(result.selection.start, result.selection.end);
    }, 60);
  };

  // Rendered inside each sheet that needs it (a sibling Modal can't open over a sheet on iOS)
  const renderTimePicker = () => (
    <TimePickerModal
      isVisible={timePickerTarget !== null}
      initialTime={timePickerTarget?.value || new Date().toTimeString().slice(0, 5)}
      onClose={() => setTimePickerTarget(null)}
      onConfirm={(selectedTime) => {
        timePickerTarget?.onChange(selectedTime);
        setTimePickerTarget(null);
      }}
    />
  );
  const [showTaskTime, setShowTaskTime] = useState(false);

  // Zustand version triggers
  const triggerTasksUpdate = useStore((state) => state.triggerTasksUpdate);
  const triggerNotesUpdate = useStore((state) => state.triggerNotesUpdate);
  const triggerProgressUpdate = useStore((state) => state.triggerProgressUpdate);
  const triggerRoutineUpdate = useStore((state) => state.triggerRoutineUpdate);
  const triggerExpensesUpdate = useStore((state) => state.triggerExpensesUpdate);
  const triggerTargetsUpdate = useStore((state) => state.triggerTargetsUpdate);

  // Auto pre-populate task due date from calendar selection
  React.useEffect(() => {
    if (activeSheet === 'task') {
      resetTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: prefilledDate || getLocalTodayStr(),
        startTime: '',
        endTime: ''
      });
    }
  }, [activeSheet, prefilledDate]);

  // Form Hooks
  const {
    control: taskControl,
    handleSubmit: handleTaskSubmit,
    reset: resetTaskForm,
    setValue: setTaskValue,
    formState: { errors: taskErrors },
  } = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: '', description: '', priority: 'medium', dueDate: '', startTime: '', endTime: '' },
  });

  const {
    control: noteControl,
    handleSubmit: handleNoteSubmit,
    reset: resetNoteForm,
    getValues: getNoteValues,
    setValue: setNoteValue,
    formState: { errors: noteErrors },
  } = useForm({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { title: '', content: '', category: 'General', color: '#6366F1' },
  });

  const {
    control: progressControl,
    handleSubmit: handleProgressSubmit,
    reset: resetProgressForm,
    formState: { errors: progressErrors },
  } = useForm({
    resolver: zodResolver(progressLogSchema),
    defaultValues: { metricName: '', value: '', notes: '' },
  });

  const {
    control: routineControl,
    handleSubmit: handleRoutineSubmit,
    reset: resetRoutineForm,
    formState: { errors: routineErrors },
  } = useForm({
    resolver: zodResolver(routineFormSchema),
    defaultValues: { title: '', time: '', details: '', frequency: 'daily', endTime: '' },
  });

  const {
    control: expenseControl,
    handleSubmit: handleExpenseSubmit,
    reset: resetExpenseForm,
    formState: { errors: expenseErrors },
  } = useForm({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { title: '', amount: '', category: 'Food & Dining' },
  });

  const {
    control: targetControl,
    handleSubmit: handleTargetSubmit,
    reset: resetTargetForm,
    formState: { errors: targetErrors },
  } = useForm({
    resolver: zodResolver(targetFormSchema),
    defaultValues: { title: '', category: '', totalCount: '', dueDate: '' },
  });

  // Dynamic category selector states for Quick Add Note Sheet
  const [dbCategories, setDbCategories] = useState([]);
  const [layoutShowDropdown, setLayoutShowDropdown] = useState(false);
  const [layoutIsCustomCategoryActive, setLayoutIsCustomCategoryActive] = useState(false);
  const [layoutCustomCategoryName, setLayoutCustomCategoryName] = useState('');

  const categoryColors = {
    General: '#6366F1', // indigo
    Personal: '#10B981', // emerald
    Work: '#F59E0B', // amber
    Ideas: '#EC4899', // pink
    Others: '#EC4899'
  };

  useEffect(() => {
    if (activeSheet === 'note') {
      selectAll('SELECT DISTINCT category FROM notes')
        .then((res) => {
          const cats = res.map((r) => r.category).filter(Boolean);
          setDbCategories(cats);
        })
        .catch((err) => console.log('Error loading categories in layout:', err));
    }
  }, [activeSheet]);

  // Action Submissions
  const onTaskCreate = async (data) => {
    try {
      const sql = 'INSERT INTO tasks (title, description, priority, dueDate, startTime, endTime, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const params = [
        data.title,
        data.description || '',
        data.priority,
        data.dueDate || getLocalTodayStr(),
        data.startTime || null,
        data.endTime || null,
        new Date().toISOString(),
      ];
      const res = await runQuery(sql, params);
      const insertedId = res.lastInsertRowId;

      // Schedule notification alert
      const taskObject = {
        id: insertedId,
        title: data.title,
        dueDate: data.dueDate || getLocalTodayStr(),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        status: 'pending'
      };
      const settings = useStore.getState().notificationSettings;
      const enabled = useStore.getState().notificationsEnabled;
      if (enabled) {
        await scheduleTaskNotifications(taskObject, settings);
      }

      triggerTasksUpdate();
      Alert.alert('Task Created', `"${data.title}" has been saved successfully.`);
      resetTaskForm();
      setPrefilledDate('');
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not save task to database.');
    }
  };

  const onNoteCreate = async (data) => {
    try {
      const sql = 'INSERT INTO notes (title, content, category, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)';
      const timestamp = new Date().toISOString();
      const finalCategory = layoutIsCustomCategoryActive ? (layoutCustomCategoryName.trim() || 'General') : data.category;
      const params = [data.title, data.content || '', finalCategory, data.color || '#6366F1', timestamp, timestamp];
      await runQuery(sql, params);
      triggerNotesUpdate();
      Alert.alert('Note Created', `"${data.title}" has been saved successfully.`);
      resetNoteForm();
      setLayoutShowDropdown(false);
      setLayoutIsCustomCategoryActive(false);
      setLayoutCustomCategoryName('');
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not save note to database.');
    }
  };

  const onProgressLog = async (data) => {
    try {
      const sql = 'INSERT INTO progress_logs (metricName, value, logDate, notes) VALUES (?, ?, ?, ?)';
      const params = [data.metricName, data.value, getLocalTodayStr(), data.notes || ''];
      await runQuery(sql, params);
      triggerProgressUpdate();
      Alert.alert('Progress Logged', `Logged ${data.value} for ${data.metricName} successfully.`);
      resetProgressForm();
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not log progress metric.');
    }
  };

  const onRoutineCreate = async (data) => {
    try {
      const sql = 'INSERT INTO routine (title, time, details, frequency, scheduledDate, endTime, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      const timestamp = new Date().toISOString();
      // Weekly/monthly routines also need an anchor date for their weekday / day-of-month
      const schedDate = prefilledDate || getLocalTodayStr();
      const res = await runQuery(sql, [
        data.title,
        data.time || '', // no start time = all-day routine
        data.details || '',
        data.frequency || 'daily',
        schedDate,
        data.endTime || null,
        'pending',
        timestamp
      ]);
      const insertedId = res.lastInsertRowId;

      // Schedule notification alert
      const routineObject = {
        id: insertedId,
        title: data.title,
        time: data.time || '',
        frequency: data.frequency || 'daily',
        scheduledDate: schedDate,
        endTime: data.endTime || null
      };
      const settings = useStore.getState().notificationSettings;
      const enabled = useStore.getState().notificationsEnabled;
      if (enabled) {
        await scheduleRoutineNotifications(routineObject, settings);
      }

      triggerRoutineUpdate();
      Alert.alert('Routine Item Added', `"${data.title}" added to daily routine.`);
      resetRoutineForm();
      setPrefilledDate('');
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not save routine item.');
    }
  };

  const onExpenseCreate = async (data) => {
    try {
      const sql = 'INSERT INTO expenses (title, amount, category, date) VALUES (?, ?, ?, ?)';
      const timestamp = prefilledDate 
        ? `${prefilledDate}T12:00:00`
        : getLocalISOString();
      await runQuery(sql, [data.title, data.amount, data.category, timestamp]);
      triggerExpensesUpdate();
      Alert.alert('Expense Logged', `Spent ₹${data.amount} on "${data.title}" successfully.`);
      resetExpenseForm();
      setPrefilledDate('');
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not save expense.');
    }
  };

  const onTargetCreate = async (data) => {
    try {
      const sql = 'INSERT INTO targets (title, category, percentage, completedCount, totalCount, dueDate) VALUES (?, ?, ?, ?, ?, ?)';
      await runQuery(sql, [data.title, data.category, 0, 0, data.totalCount, data.dueDate]);
      triggerTargetsUpdate();
      Alert.alert('Target Tracker Initialized', `"${data.title}" targets tracker initialized.`);
      resetTargetForm();
      setActiveSheet(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Database Error', 'Could not initialize target.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
            overflow: 'visible',
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: theme.typography.fontFamily.bold,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: 'Notes',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* Central embedded yellow add button */}
        <Tabs.Screen
          name="plus"
          options={{
            title: '',
            tabBarButton: (props) => (
              <View style={[props.style, { alignItems: 'center', justifyContent: 'center', overflow: 'visible' }]}>
                {/* Semicircle Cutout Recess (Cradle) */}
                <View 
                  style={[
                    styles.centerTabCutout, 
                    { 
                      backgroundColor: colors.background, 
                      borderColor: colors.border,
                    }
                  ]} 
                />
                <Pressable
                  {...props}
                  onPress={handlePlusPress}
                  style={styles.centerTabBtn}
                >
                  <View style={[styles.centerTabCircle, { backgroundColor: '#F1C40F' }]}>
                    <Ionicons name="add" size={30} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => {
              const avatarUrl = user?.avatar;
              if (avatarUrl) {
                return (
                  <Image 
                    source={{ uri: avatarUrl }} 
                    style={{ 
                      width: 22, 
                      height: 22, 
                      borderRadius: 11, 
                      borderWidth: focused ? 1.5 : 0.5,
                      borderColor: focused ? colors.primary : colors.border 
                    }} 
                  />
                );
              }
              return (
                <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
              );
            },
          }}
        />

        {/* Hide Progress Screen from the Tab Bar */}
        <Tabs.Screen
          name="progress"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Quick Add Bottom Sheet Menu */}
      <BottomSheet
        isVisible={activeSheet === 'quick_add'}
        onClose={() => setActiveSheet(null)}
        title="Quick Add Action"
        snapPoint={0.4}
      >
        <View style={styles.quickAddGrid}>
          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('task'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="checkmark-done-circle" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>New Task</Text>
          </Pressable>

          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('note'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: `${colors.secondary}15` }]}>
              <Ionicons name="document-text" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>New Note</Text>
          </Pressable>

          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('routine'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: `${colors.accent}15` }]}>
              <Ionicons name="barbell" size={24} color={colors.accent} />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>New Routine</Text>
          </Pressable>

          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('expense'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: '#F1C40F15' }]}>
              <Ionicons name="card" size={24} color="#F1C40F" />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>New Expense</Text>
          </Pressable>

          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('target'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="ribbon" size={24} color={colors.success} />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>New Target</Text>
          </Pressable>

          <Pressable
            style={styles.quickAddOption}
            onPress={() => {
              setActiveSheet(null);
              setTimeout(() => setActiveSheet('progress'), 200);
            }}
          >
            <View style={[styles.quickAddIconBg, { backgroundColor: `${colors.textMuted}15` }]}>
              <Ionicons name="analytics" size={24} color={colors.textSecondary} />
            </View>
            <Text style={[styles.quickAddLabel, { color: colors.text }]}>Log Metric</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Task Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'task'}
        onClose={() => {
          setActiveSheet(null);
          setPrefilledDate('');
          resetTaskForm();
        }}
        title="Add New Task"
        snapPoint={0.65}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Controller
            control={taskControl}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Task Title"
                placeholder="Buy groceries, write plan..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={taskErrors.title?.message}
              />
            )}
          />

          <Controller
            control={taskControl}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Description (Optional)"
                placeholder="Enter details..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={taskErrors.description?.message}
              />
            )}
          />

          <Controller
            control={taskControl}
            name="priority"
            render={({ field: { onChange, value } }) => (
              <View style={styles.choiceGroup}>
                <Text style={[styles.choiceLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }]}>
                  Priority
                </Text>
                <View style={styles.buttonRow}>
                  {['low', 'medium', 'high'].map((p) => (
                    <Button
                      key={p}
                      title={p.charAt(0).toUpperCase() + p.slice(1)}
                      onPress={() => onChange(p)}
                      variant={value === p ? 'primary' : 'secondary'}
                      size="sm"
                      style={styles.choiceButton}
                    />
                  ))}
                </View>
              </View>
            )}
          />

          {/* Direct Start and End Time fields (Optional) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium, marginBottom: 4 }]}>
                Start Time (Optional)
              </Text>
              <Controller
                control={taskControl}
                name="startTime"
                render={({ field: { onChange, value } }) => (
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'startTime', value, onChange })}>
                    <View pointerEvents="none">
                      <Input
                        placeholder="Select..."
                        value={value}
                      />
                    </View>
                  </Pressable>
                )}
              />
            </View>
            
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium, marginBottom: 4 }]}>
                End Time (Optional)
              </Text>
              <Controller
                control={taskControl}
                name="endTime"
                render={({ field: { onChange, value } }) => (
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'endTime', value, onChange })}>
                    <View pointerEvents="none">
                      <Input
                        placeholder="Select..."
                        value={value}
                      />
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </View>

          <Button
            title="Create Task"
            onPress={handleTaskSubmit(onTaskCreate)}
            variant="primary"
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
        {renderTimePicker()}
      </BottomSheet>

      {/* Note Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'note'}
        onClose={() => {
          setActiveSheet(null);
          resetNoteForm();
          quickNoteSelectionRef.current = { start: 0, end: 0 };
          setLayoutShowDropdown(false);
          setLayoutIsCustomCategoryActive(false);
          setLayoutCustomCategoryName('');
        }}
        title="Add New Note"
        snapPoint={0.7}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.formContainer, { paddingHorizontal: 16 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {/* Notion-Style Large Title Input */}
          <Controller
            control={noteControl}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  color: colors.text,
                  fontFamily: theme.typography.fontFamily.bold,
                  fontSize: 24,
                  fontWeight: '800',
                  lineHeight: 30,
                  marginBottom: 12,
                  padding: 0,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                }}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                placeholder="Untitled Note"
                placeholderTextColor={colors.textMuted}
              />
            )}
          />

          {/* Notion-Style Category Selector Row */}
          <Controller
            control={noteControl}
            name="category"
            render={({ field: { onChange, value } }) => {
              const defaultCategories = ['General', 'Personal', 'Work', 'Ideas'];
              const allLayoutCategories = [...new Set([...defaultCategories, ...dbCategories])];
              return (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', width: 95 }}>
                      <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>
                        Category
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setLayoutShowDropdown(!layoutShowDropdown)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: (categoryColors[layoutIsCustomCategoryActive ? 'Others' : value] || colors.primary) + '15',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: categoryColors[layoutIsCustomCategoryActive ? 'Others' : value] || colors.primary }}>
                        {layoutIsCustomCategoryActive ? (layoutCustomCategoryName.trim() || 'Custom...') : value}
                      </Text>
                      <Ionicons name="chevron-down" size={10} color={categoryColors[layoutIsCustomCategoryActive ? 'Others' : value] || colors.primary} style={{ marginLeft: 4 }} />
                    </Pressable>
                  </View>

                  {/* Inline Dropdown List */}
                  {layoutShowDropdown && (
                    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, marginBottom: 8, overflow: 'hidden' }}>
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {allLayoutCategories.map((cat) => {
                          const isCatSelected = !layoutIsCustomCategoryActive && value === cat;
                          const catColor = categoryColors[cat] || colors.primary;
                          return (
                            <Pressable
                              key={cat}
                              onPress={() => {
                                onChange(cat);
                                setLayoutShowDropdown(false);
                                setLayoutIsCustomCategoryActive(false);
                              }}
                              style={[{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderBottomWidth: 0.5,
                                borderColor: colors.border,
                              }, isCatSelected && { backgroundColor: `${colors.primary}10` }]}
                            >
                              <Text style={{ color: colors.text, fontSize: 13, fontFamily: theme.typography.fontFamily.medium }}>{cat}</Text>
                              {isCatSelected && <Ionicons name="checkmark" size={14} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                            </Pressable>
                          );
                        })}
                        <Pressable
                          onPress={() => {
                            setLayoutIsCustomCategoryActive(true);
                            setLayoutShowDropdown(false);
                          }}
                          style={[{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                          }, layoutIsCustomCategoryActive && { backgroundColor: `${colors.primary}10` }]}
                        >
                          <Ionicons name="add-circle" size={12} color={colors.accent} style={{ marginRight: 8 }} />
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: theme.typography.fontFamily.bold }}>Others...</Text>
                          {layoutIsCustomCategoryActive && <Ionicons name="checkmark" size={14} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                        </Pressable>
                      </ScrollView>
                    </View>
                  )}

                  {/* Custom Category Input */}
                  {layoutIsCustomCategoryActive && (
                    <View style={{ borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surfaceSecondary, padding: 8, borderRadius: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginBottom: 4, fontFamily: theme.typography.fontFamily.medium }}>
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
                          paddingVertical: 4,
                        }}
                        value={layoutCustomCategoryName}
                        onChangeText={setLayoutCustomCategoryName}
                        placeholder="Enter custom tag..."
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                      />
                    </View>
                  )}
                </View>
              );
            }}
          />
          {/* Notion-Style Card Color Picker Row */}
          <Controller
            control={noteControl}
            name="color"
            render={({ field: { onChange, value } }) => (
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: 95, paddingTop: 2 }}>
                    <Ionicons name="color-palette-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }}>
                      Color
                    </Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: 10 }}>
                    {CATEGORY_COLORS.map((col) => {
                      const isSelected = value === col;
                      return (
                        <Pressable
                          key={col}
                          onPress={() => onChange(col)}
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
            )}
          />

          {/* Notion-Style Divider Line */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6, marginBottom: 12 }} />

          {/* Notion-Style Large Content Input Area */}
          <Controller
            control={noteControl}
            name="content"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  color: colors.text,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: 15,
                  lineHeight: 22,
                  minHeight: 250, // Huge writing area
                  textAlignVertical: 'top',
                  padding: 0,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                }}
                ref={quickNoteInputRef}
                onBlur={onBlur}
                onChangeText={onChange}
                onSelectionChange={(e) => { quickNoteSelectionRef.current = e.nativeEvent.selection; }}
                value={value}
                placeholder="Start typing… use the toolbar below for to-dos, headings, quotes and code."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            )}
          />

          <Button
            title="Create Note"
            onPress={handleNoteSubmit(onNoteCreate)}
            variant="primary"
            style={{ marginTop: spacing.lg, marginBottom: 30 }}
          />
        </ScrollView>
        {/* Formatting toolbar pinned to the bottom of the sheet (sits right above the keyboard) */}
        <View style={{ paddingTop: 6 }}>
          <NoteToolbar onAction={handleQuickNoteTool} />
        </View>
      </BottomSheet>

      {/* Progress Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'progress'}
        onClose={() => {
          setActiveSheet(null);
          resetProgressForm();
        }}
        title="Log Progress Metric"
        snapPoint={0.55}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Controller
            control={progressControl}
            name="metricName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Metric Name"
                placeholder="Sleep (hrs), Steps, Water (ml)..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={progressErrors.metricName?.message}
              />
            )}
          />

          <Controller
            control={progressControl}
            name="value"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Value"
                placeholder="8, 10000, 2000..."
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={progressErrors.value?.message}
              />
            )}
          />

          <Button
            title="Log Entry"
            onPress={handleProgressSubmit(onProgressLog)}
            variant="primary"
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </BottomSheet>

      {/* Routine Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'routine'}
        onClose={() => {
          setActiveSheet(null);
          setPrefilledDate('');
          resetRoutineForm();
        }}
        title="Add Daily Routine"
        snapPoint={0.6}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Controller
            control={routineControl}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Routine Title"
                placeholder="Morning stretch, reading..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={routineErrors.title?.message}
              />
            )}
          />

           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Controller
                control={routineControl}
                name="time"
                render={({ field: { onChange, value } }) => (
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'time', value, onChange })}>
                    <View pointerEvents="none">
                      <Input
                        label="Start Time (Optional)"
                        placeholder="All day"
                        value={value}
                        error={routineErrors.time?.message}
                      />
                    </View>
                  </Pressable>
                )}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Controller
                control={routineControl}
                name="endTime"
                render={({ field: { onChange, value } }) => (
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'endTime', value, onChange })}>
                    <View pointerEvents="none">
                      <Input
                        label="End Time (Optional)"
                        placeholder="Select..."
                        value={value}
                        error={routineErrors.endTime?.message}
                      />
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </View>

          <Controller
            control={routineControl}
            name="details"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Details (Optional)"
                placeholder="Drink water, 90 mins session..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={routineErrors.details?.message}
              />
            )}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Frequency</Text>
          <Controller
            control={routineControl}
            name="frequency"
            render={({ field: { onChange, value } }) => (
              <View style={styles.frequencyRow}>
                {['daily', 'weekly', 'monthly', 'once'].map((f) => {
                  const isSelected = value === f || (!value && f === 'daily');
                  return (
                    <Pressable
                      key={f}
                      onPress={() => onChange(f)}
                      style={[
                        styles.frequencyBtn,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.frequencyBtnText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                        {f.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />

          <Button
            title="Add to Routine"
            onPress={handleRoutineSubmit(onRoutineCreate)}
            variant="primary"
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
        {renderTimePicker()}
      </BottomSheet>

      {/* Expense Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'expense'}
        onClose={() => {
          setActiveSheet(null);
          setPrefilledDate('');
          setIsAddingExpenseCategory(false);
          setNewExpenseCategoryName('');
          resetExpenseForm();
        }}
        title="Log New Expense"
        snapPoint={0.65}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Controller
            control={expenseControl}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Item / Merchant"
                placeholder="Starbucks, Uber, Amazon..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={expenseErrors.title?.message}
              />
            )}
          />

          <Controller
            control={expenseControl}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Amount (₹)"
                placeholder="4.80, 15.00..."
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={expenseErrors.amount?.message}
              />
            )}
          />

          <Controller
            control={expenseControl}
            name="category"
            render={({ field: { onChange, value } }) => (
              <View style={styles.choiceGroup}>
                <Text style={[styles.choiceLabel, { color: colors.textSecondary, fontFamily: theme.typography.fontFamily.medium }]}>
                  Expense Category
                </Text>
                <View style={styles.categoryRow}>
                  {expenseCategoryOptions.map((cat) => {
                    const isSelected = value === cat;
                    const isCustom = !isDefaultExpenseCategory(cat);
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => onChange(cat)}
                        onLongPress={isCustom ? () => handleRemoveExpenseCategory(cat, value, onChange) : undefined}
                        style={[
                          styles.categoryBadge,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.categoryText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!isAddingExpenseCategory && (
                    <Pressable
                      onPress={() => setIsAddingExpenseCategory(true)}
                      style={[styles.categoryBadge, { borderStyle: 'dashed', borderColor: colors.primary, flexDirection: 'row', alignItems: 'center' }]}
                    >
                      <Ionicons name="add" size={14} color={colors.primary} />
                      <Text style={[styles.categoryText, { color: colors.primary, marginLeft: 2 }]}>New</Text>
                    </Pressable>
                  )}
                </View>
                {isAddingExpenseCategory && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <TextInput
                      value={newExpenseCategoryName}
                      onChangeText={setNewExpenseCategoryName}
                      placeholder="e.g. Rent, Pets, Travel"
                      placeholderTextColor={colors.textMuted}
                      maxLength={MAX_CATEGORY_NAME_LENGTH}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleCreateExpenseCategory(onChange)}
                      style={{
                        flex: 1,
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 13,
                      }}
                    />
                    <Pressable
                      onPress={() => handleCreateExpenseCategory(onChange)}
                      style={{ marginLeft: 8, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Add</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setIsAddingExpenseCategory(false); setNewExpenseCategoryName(''); }}
                      style={{ marginLeft: 4, padding: 8 }}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                )}
                {customExpenseCategories.length > 0 && !isAddingExpenseCategory && (
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                    Long-press one of your own categories to remove it.
                  </Text>
                )}
              </View>
            )}
          />

          <Button
            title="Log Expense"
            onPress={handleExpenseSubmit(onExpenseCreate)}
            variant="primary"
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </BottomSheet>

      {/* Target Bottom Sheet Form */}
      <BottomSheet
        isVisible={activeSheet === 'target'}
        onClose={() => {
          setActiveSheet(null);
          resetTargetForm();
        }}
        title="Create New Target"
        snapPoint={0.65}
      >
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <Controller
            control={targetControl}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Target Goal"
                placeholder="Read 12 Books, Run 100 KM..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={targetErrors.title?.message}
              />
            )}
          />

          <Controller
            control={targetControl}
            name="category"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Category / Topic"
                placeholder="Personal, Fitness, Work..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={targetErrors.category?.message}
              />
            )}
          />

          <Controller
            control={targetControl}
            name="totalCount"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Target Step Count / Goal Metric"
                placeholder="e.g. 12 (Books), 100 (KM)..."
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={targetErrors.totalCount?.message}
              />
            )}
          />

          <Controller
            control={targetControl}
            name="dueDate"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Target Date / Due Date"
                placeholder="e.g. Dec 31, July 15..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={targetErrors.dueDate?.message}
              />
            )}
          />

          <Button
            title="Create Target"
            onPress={handleTargetSubmit(onTargetCreate)}
            variant="primary"
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    paddingVertical: 8,
  },
  choiceGroup: {
    marginBottom: 16,
  },
  choiceLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  choiceButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerTabBtn: {
    top: -26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerTabCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  centerTabCutout: {
    position: 'absolute',
    top: -33,
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderTopColor: 'transparent',
    zIndex: -1,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  quickAddOption: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  quickAddIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickAddLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  frequencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  frequencyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
