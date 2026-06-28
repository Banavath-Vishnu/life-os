import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import Card from '../../src/shared/components/Card';
import Button from '../../src/shared/components/Button';
import EmptyState from '../../src/shared/components/EmptyState';
import LoadingState from '../../src/shared/components/LoadingState';
import TimePickerModal from '../../src/shared/components/TimePickerModal';
import { scheduleTaskNotifications, cancelScheduledNotificationAsync } from '../../src/core/notifications/notificationManager';
import { selectAll, runQuery } from '../../src/core/db/sqlite';

// Helper date utilities
const getYesterdayStr = (dateStr) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const getNextDayStr = (dateStr) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const isTaskActiveOnDate = (task, dateStr) => {
  if (task.dueDate === dateStr) return true;
  if (task.startTime && task.endTime && task.endTime < task.startTime) {
    const yesterday = getYesterdayStr(dateStr);
    if (task.dueDate === yesterday) return true;
  }
  return false;
};

const formatTaskTime = (t, dateStr) => {
  if (!t.startTime) return 'ALL DAY';
  
  const isStartDay = t.dueDate === dateStr;
  const isOvernight = t.endTime && t.endTime < t.startTime;
  
  if (isOvernight) {
    if (isStartDay) {
      return `${t.startTime} - Next Day ${t.endTime}`;
    } else {
      return `Yesterday ${t.startTime} - ${t.endTime}`;
    }
  }
  
  return t.endTime ? `${t.startTime} - ${t.endTime}` : t.startTime;
};

const getTaskCountdownLabel = (t, dateStr) => {
  if (!t.startTime || t.status === 'completed') return null;
  
  const today = new Date().toISOString().split('T')[0];
  if (dateStr !== today) return null;

  const isStartDay = t.dueDate === dateStr;
  const isOvernight = t.endTime && t.endTime < t.startTime;
  
  if (isOvernight && !isStartDay) {
    return '⚡ Ongoing from Yesterday';
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = t.startTime.split(':').map(Number);
  const startMins = startH * 60 + startM;
  
  const diff = startMins - nowMins;
  
  if (diff > 0 && diff <= 15) {
    return `⏳ Starts in ${diff} minute${diff > 1 ? 's' : ''}`;
  }
  if (diff === 0) {
    return '⚡ Starting Now';
  }
  if (diff < 0 && diff >= -60) {
    return `⚡ Active Now (Started ${Math.abs(diff)} mins ago)`;
  }
  
  return null;
};

// Recurrence checker for Weekly & Monthly routines (with end-of-month fallback)
const isSameMonthlyDay = (scheduledDateStr, targetDateStr) => {
  const sDate = new Date(scheduledDateStr);
  const tDate = new Date(targetDateStr);
  const targetDay = sDate.getDate();
  
  const tYear = tDate.getFullYear();
  const tMonth = tDate.getMonth();
  const daysInTargetMonth = new Date(tYear, tMonth + 1, 0).getDate();
  
  const actualTargetDay = Math.min(targetDay, daysInTargetMonth);
  return tDate.getDate() === actualTargetDay;
};

const isRoutineActiveOnDate = (r, dateStr) => {
  if (r.frequency === 'daily') return true;
  if (r.frequency === 'weekly') {
    return new Date(r.scheduledDate).getDay() === new Date(dateStr).getDay();
  }
  if (r.frequency === 'monthly') {
    return isSameMonthlyDay(r.scheduledDate, dateStr);
  }
  if (r.frequency === 'once') {
    return r.scheduledDate === dateStr;
  }
  return false;
};

// Task expired end-time overdue checker
const isTaskOverdueOnDate = (task, dateStr) => {
  if (task.status !== 'pending' || !task.dueDate) return false;
  
  if (task.dueDate < dateStr) return true;
  
  if (task.dueDate === dateStr && task.endTime) {
    if (task.startTime && task.endTime < task.startTime) {
      return false; // Overnight task spans to next day
    }
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [endH, endM] = task.endTime.split(':').map(Number);
      const endMins = endH * 60 + endM;
      return nowMins > endMins;
    }
  }
  
  const yesterday = getYesterdayStr(dateStr);
  if (task.dueDate === yesterday && task.startTime && task.endTime && task.endTime < task.startTime) {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [endH, endM] = task.endTime.split(':').map(Number);
      const endMins = endH * 60 + endM;
      return nowMins > endMins;
    }
  }
  
  return false;
};

export default function TasksScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;

  const tasksVersion = useStore((state) => state.tasksVersion);
  const routineVersion = useStore((state) => state.routineVersion);
  const triggerTasksUpdate = useStore((state) => state.triggerTasksUpdate);
  const triggerRoutineUpdate = useStore((state) => state.triggerRoutineUpdate);
  const setActiveSheet = useStore((state) => state.setActiveSheet);
  const setPrefilledDate = useStore((state) => state.setPrefilledDate);

  // Main Screen View Selector: 'checklist' | 'routine'
  const activeTab = useStore((state) => state.tasksSubTab);
  const setActiveTab = useStore((state) => state.setTasksSubTab);
  const [loading, setLoading] = useState(true);

  // Checklist States
  const [tasks, setTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState('today'); // 'today' | 'missed' | 'upcoming' | 'completed'
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedChecklistDate, setSelectedChecklistDate] = useState(todayStr);

  // Task Edit Modal States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Clock picker overlay state
  const [timePickerTarget, setTimePickerTarget] = useState(null);

  // Generate 10 days of dates dynamically: 3 days before today, today, and 6 days after today
  const getDaysOfWeek = () => {
    const days = [];
    const today = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = -3; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      const isPast = d < today && !isToday;
      days.push({
        key: d.toISOString().split('T')[0],
        label: dayNames[d.getDay()],
        date: String(d.getDate()),
        month: monthNamesShort[d.getMonth()].toUpperCase(),
        isToday: isToday,
        isPast: isPast,
        fullDateStr: d.toISOString().split('T')[0]
      });
    }
    return days;
  };

  const DAYS_OF_WEEK = getDaysOfWeek();
  const todayDayName = DAYS_OF_WEEK.find(d => d.isToday)?.key || todayStr;

  // Routine States
  const [routines, setRoutines] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayDayName);

  // Calendar Explorer Modal States
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth()); // 0-indexed
  const [calSelectedDate, setCalSelectedDate] = useState(todayStr);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Dynamic Routine active node finder
  const getActiveRoutineId = () => {
    if (!routines || routines.length === 0) return null;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    const realRoutines = routines.filter(r => !r.isTaskLink && !r.isOverdue);
    if (realRoutines.length === 0) return null;

    const itemsWithMins = realRoutines.map(item => {
      const [h, m] = item.time.split(':').map(Number);
      return { id: item.id, mins: h * 60 + m };
    });
    itemsWithMins.sort((a, b) => a.mins - b.mins);
    let activeItem = itemsWithMins[0];
    for (let i = 0; i < itemsWithMins.length; i++) {
      if (itemsWithMins[i].mins <= currentMins) {
        activeItem = itemsWithMins[i];
      }
    }
    return activeItem ? activeItem.id : null;
  };

  const activeRoutineId = getActiveRoutineId();

  // Helper to check if past day's tasks are fully completed
  const isDayFullyCompleted = (fullDateStr) => {
    const dayTasks = tasks.filter(t => t.dueDate === fullDateStr);
    if (dayTasks.length === 0) return false;
    return dayTasks.every(t => t.status === 'completed');
  };

  // Load Data
  const loadChecklistData = async () => {
    try {
      const data = await selectAll('SELECT * FROM tasks ORDER BY id DESC');
      setTasks(data || []);
    } catch (e) {
      console.warn('[Tasks] Error loading tasks: ', e);
    }
  };

  const loadRoutineData = async () => {
    try {
      // 1. Query all standard recurring routines and once items, left-joined with log entries for selected day
      const data = await selectAll(
        `SELECT r.*, COALESCE(l.status, 'pending') as status 
         FROM routine r 
         LEFT JOIN routine_logs l ON r.id = l.routineId AND l.logDate = ?`,
        [selectedChecklistDate]
      );

      // Filter in JS using recurrence helpers to support Weekly & Monthly correct intervals
      const activeRoutines = (data || []).filter(r => isRoutineActiveOnDate(r, selectedChecklistDate));

      const formattedRoutines = activeRoutines.map(r => ({
        ...r,
        time: r.time, // Show start time only on timeline
        sortTime: r.time,
        endTime: r.endTime
      }));

      // 2. Query checklist tasks active on this date (excluding those that are overdue!)
      const allTasksData = await selectAll('SELECT * FROM tasks');
      const activeDayTasks = allTasksData.filter(t => 
        isTaskActiveOnDate(t, selectedChecklistDate) && 
        !isTaskOverdueOnDate(t, selectedChecklistDate)
      );

      const taskRoutineItems = activeDayTasks.map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        time: t.startTime || 'ALL DAY', // Show start time only
        sortTime: t.startTime || 'ALL DAY',
        details: t.description || 'Checklist Task',
        frequency: 'task',
        status: t.status,
        isTaskLink: true,
        originalTaskId: t.id,
        endTime: t.endTime,
        dueDate: t.dueDate
      }));

      // 3. Query overdue tasks (due before selected day, or due today/yesterday but past their end time)
      const overdueTasks = allTasksData.filter(t => 
        isTaskOverdueOnDate(t, selectedChecklistDate)
      );
      const formattedOverdueTasks = overdueTasks.map(t => ({
        id: `task-overdue-${t.id}`,
        title: t.title,
        time: 'MISSED',
        sortTime: 'ALL DAY',
        details: t.description || 'Checklist Task',
        frequency: 'task',
        status: t.status,
        isTaskLink: true,
        isOverdue: true,
        dueDate: t.dueDate,
        originalTaskId: t.id,
        endTime: t.endTime
      }));

      // 4. Combine and Sort: Group 1 (Overdue), Group 2 (ALL DAY), Group 3 (Timed chronologically)
      const combined = [...formattedOverdueTasks, ...formattedRoutines, ...taskRoutineItems];
      combined.sort((a, b) => {
        // Group 1: Overdue tasks go first
        const aOverdue = a.isOverdue;
        const bOverdue = b.isOverdue;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        if (aOverdue && bOverdue) {
          // Sort overdue tasks day wise (older first)
          return a.dueDate.localeCompare(b.dueDate);
        }

        // Group 2: ALL DAY tasks go next
        const aAllDay = a.time === 'ALL DAY';
        const bAllDay = b.time === 'ALL DAY';
        if (aAllDay && !bAllDay) return -1;
        if (!aAllDay && bAllDay) return 1;
        if (aAllDay && bAllDay) return 0;

        // Group 3: Timed items sorted chronologically
        const aTime = a.sortTime;
        const bTime = b.sortTime;
        return aTime.localeCompare(bTime);
      });

      setRoutines(combined);
    } catch (e) {
      console.warn('[Tasks] Error loading routine: ', e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await loadChecklistData();
    if (activeTab === 'routine') {
      await loadRoutineData();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab, tasksVersion, routineVersion, selectedChecklistDate]);

  // Tasks Checklist handlers
  const toggleTaskStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await runQuery('UPDATE tasks SET status = ? WHERE id = ?', [nextStatus, id]);
      
      // Reschedule or cancel notification alerts
      const tasksList = await selectAll('SELECT * FROM tasks WHERE id = ?', [id]);
      if (tasksList && tasksList[0]) {
        const settings = useStore.getState().notificationSettings;
        const enabled = useStore.getState().notificationsEnabled;
        if (enabled) {
          await scheduleTaskNotifications({ ...tasksList[0], status: nextStatus }, settings);
        }
      }

      triggerTasksUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTask = async (id, title) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM tasks WHERE id = ?', [id]);
            
            try {
              await cancelScheduledNotificationAsync(`task-start-${id}`);
              await cancelScheduledNotificationAsync(`task-end-${id}`);
              await cancelScheduledNotificationAsync(`task-pre-end-${id}`);
            } catch (err) {
              // Ignore if not present
            }

            triggerTasksUpdate();
            if (isEditModalVisible) setIsEditModalVisible(false);
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  const openTaskDetail = (task) => {
    setActiveTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate || '');
    setEditStartTime(task.startTime || '');
    setEditEndTime(task.endTime || '');
    setIsEditModalVisible(true);
  };

  const saveTaskChanges = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Validation Error', 'Task title cannot be empty.');
      return;
    }
    try {
      const sql = 'UPDATE tasks SET title = ?, description = ?, priority = ?, dueDate = ?, startTime = ?, endTime = ? WHERE id = ?';
      const params = [
        editTitle,
        editDescription,
        editPriority,
        editDueDate,
        editStartTime || null,
        editEndTime || null,
        activeTask.id
      ];
      await runQuery(sql, params);

      // Reschedule push alerts
      const taskObject = {
        id: activeTask.id,
        title: editTitle,
        dueDate: editDueDate,
        startTime: editStartTime || null,
        endTime: editEndTime || null,
        status: activeTask.status
      };
      const settings = useStore.getState().notificationSettings;
      const enabled = useStore.getState().notificationsEnabled;
      if (enabled) {
        await scheduleTaskNotifications(taskObject, settings);
      }

      triggerTasksUpdate();
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Task updated successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save task changes.');
    }
  };

  // Date-specific Routine status handlers (supports mapped task links)
  const toggleRoutineStatus = async (id, currentStatus) => {
    try {
      if (String(id).startsWith('task-')) {
        const originalTaskId = Number(String(id).replace('task-overdue-', '').replace('task-', ''));
        await toggleTaskStatus(originalTaskId, currentStatus);
      } else {
        if (currentStatus === 'completed') {
          await runQuery('DELETE FROM routine_logs WHERE routineId = ? AND logDate = ?', [id, selectedChecklistDate]);
        } else {
          await runQuery('INSERT OR IGNORE INTO routine_logs (routineId, logDate, status) VALUES (?, ?, ?)', [
            id,
            selectedChecklistDate,
            'completed'
          ]);
        }
        triggerRoutineUpdate();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRoutine = async (id, title) => {
    Alert.alert('Delete Routine Item', `Are you sure you want to delete "${title}" from your daily schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await runQuery('DELETE FROM routine WHERE id = ?', [id]);
            
            try {
              await cancelScheduledNotificationAsync(`routine-start-${id}`);
              await cancelScheduledNotificationAsync(`routine-pre-start-${id}`);
              await cancelScheduledNotificationAsync(`routine-end-${id}`);
              for (let m = 0; m < 6; m++) {
                await cancelScheduledNotificationAsync(`routine-start-monthly-${id}-${m}`);
                await cancelScheduledNotificationAsync(`routine-pre-start-monthly-${id}-${m}`);
                await cancelScheduledNotificationAsync(`routine-end-monthly-${id}-${m}`);
              }
            } catch (err) {
              // Ignore if not present
            }

            triggerRoutineUpdate();
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  const handleDeletePress = (item) => {
    if (item.isTaskLink) {
      deleteTask(item.originalTaskId, item.title);
    } else {
      deleteRoutine(item.id, item.title);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  // Calendar Day generation MON-SUN columns
  const getCalendarDays = () => {
    const firstDay = new Date(calYear, calMonth, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Sunday
    
    const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
    const daysGrid = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      daysGrid.push({ dayNum: '', key: `pad-${i}` });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      daysGrid.push({
        dayNum: i,
        key: `day-${i}`,
        dateStr: dateStr
      });
    }
    
    return daysGrid;
  };

  // Calendar action callbacks
  const handleMarkFutureTask = () => {
    if (calSelectedDate < todayStr) {
      Alert.alert('Restricted Action', 'Adding tasks/routines for past dates is disabled.');
      return;
    }
    setIsCalendarVisible(false);
    setPrefilledDate(calSelectedDate);
    setTimeout(() => {
      setActiveSheet('task');
    }, 250);
  };

  const handleShowTasksForDate = () => {
    setIsCalendarVisible(false);
    setSelectedChecklistDate(calSelectedDate);
    setTaskFilter('today');
  };

  // Helper to calculate exact days difference
  const getDaysDiff = (dateStr1, dateStr2) => {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    const diffTime = d1 - d2;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filter checklist tasks
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'completed') {
      return t.status === 'completed';
    } else if (taskFilter === 'today') {
      return t.dueDate === selectedChecklistDate;
    } else if (taskFilter === 'missed') {
      return t.status === 'pending' && t.dueDate && t.dueDate < todayStr;
    } else {
      return t.status === 'pending' && t.dueDate && t.dueDate > selectedChecklistDate;
    }
  });

  // Construct structured checklist items with grouped headers for "today" or "missed" views
  const getChecklistListData = () => {
    if (taskFilter === 'today') {
      const listData = [];
      if (selectedChecklistDate !== todayStr) {
        listData.push({
          isInfoBanner: true,
          title: `Selected Day: ${selectedChecklistDate}`,
          key: 'info-banner-selected-day'
        });
      }
      
      const dayTasks = tasks.filter(t => isTaskActiveOnDate(t, selectedChecklistDate));
      
      // Separate active and overdue-today tasks
      const overdueToday = dayTasks.filter(t => isTaskOverdueOnDate(t, selectedChecklistDate));
      const activeToday = dayTasks.filter(t => !isTaskOverdueOnDate(t, selectedChecklistDate));

      if (overdueToday.length > 0) {
        listData.push({ isHeader: true, title: 'Overdue Today (Time Expired)', key: 'header-overdue-today' });
        overdueToday.forEach(task => {
          listData.push({ isHeader: false, ...task, key: `task-${task.id}` });
        });
      }

      if (activeToday.length > 0) {
        if (listData.length > 0) {
          listData.push({ isHeader: true, title: "Today's Focus", key: 'header-today-focus' });
        }
        activeToday.forEach(task => {
          listData.push({ isHeader: false, ...task, key: `task-${task.id}` });
        });
      }
      return listData;
    }

    if (taskFilter === 'missed') {
      const listData = [];
      const overdueTasks = tasks.filter(t => isTaskOverdueOnDate(t, todayStr));
      overdueTasks.sort((a, b) => b.dueDate.localeCompare(a.dueDate)); // Most recent past days first

      const overdueGroups = {};
      overdueTasks.forEach((t) => {
        if (t.dueDate === todayStr) {
          if (!overdueGroups['Overdue Today']) overdueGroups['Overdue Today'] = [];
          overdueGroups['Overdue Today'].push(t);
          return;
        }
        const diff = getDaysDiff(todayStr, t.dueDate);
        if (diff <= 0) return;
        let groupTitle = `Pending ${diff} Days Ago`;
        if (diff === 1) {
          groupTitle = 'Pending Yesterday';
        }
        if (!overdueGroups[groupTitle]) {
          overdueGroups[groupTitle] = [];
        }
        overdueGroups[groupTitle].push(t);
      });

      // Add overdue groups to listData
      Object.keys(overdueGroups).forEach((groupTitle) => {
        listData.push({ isHeader: true, title: groupTitle, key: `header-${groupTitle}` });
        overdueGroups[groupTitle].forEach((task) => {
          listData.push({ isHeader: false, ...task, key: `task-${task.id}` });
        });
      });
      return listData;
    }

    return filteredTasks;
  };

  const checklistListData = getChecklistListData();

  const renderTaskItem = ({ item }) => {
    if (item.isInfoBanner) {
      return (
        <View style={[styles.infoBanner, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.infoBannerText, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
            {item.title}
          </Text>
        </View>
      );
    }
    if (item.isHeader) {
      return (
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeaderText, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
            {item.title}
          </Text>
          <View style={[styles.sectionHeaderLine, { backgroundColor: colors.border }]} />
        </View>
      );
    }
    const isCompleted = item.status === 'completed';
    const countdownLabel = getTaskCountdownLabel(item, selectedChecklistDate);

    return (
      <Card style={styles.taskCard}>
        {countdownLabel && (
          <View style={[styles.countdownBanner, { backgroundColor: `${colors.primary}10`, borderRadius: roundness.sm }]}>
            <Ionicons name="time-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.countdownText, { color: colors.primary, fontFamily: theme.typography.fontFamily.bold }]}>
              {countdownLabel}
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Pressable onPress={() => toggleTaskStatus(item.id, item.status)} style={styles.checkboxWrapper}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isCompleted ? colors.success : colors.textMuted}
            />
          </Pressable>

          <Pressable onPress={() => openTaskDetail(item)} style={styles.contentWrapper}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontSize: typography.sizes.md,
                  fontFamily: theme.typography.fontFamily.medium,
                  textDecorationLine: isCompleted ? 'line-through' : 'none',
                  opacity: isCompleted ? 0.6 : 1,
                },
              ]}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text
                style={[
                  styles.description,
                  {
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontFamily: theme.typography.fontFamily.regular,
                    marginTop: 2,
                  },
                ]}
              >
                {item.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              {item.dueDate ? (
                <Text style={{ fontSize: 10, color: colors.textMuted, marginRight: 8 }}>
                  Due: {item.dueDate}
                </Text>
              ) : null}
              {item.startTime ? (
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>
                  🕒 {formatTaskTime(item, selectedChecklistDate)}
                </Text>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.metaWrapper}>
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor:
                    item.priority === 'high'
                      ? `${colors.error}15`
                      : item.priority === 'medium'
                      ? `${colors.warning}15`
                      : `${colors.success}15`,
                },
              ]}
            >
              <Text
                style={[
                  styles.priorityText,
                  {
                    color:
                      item.priority === 'high'
                        ? colors.error
                        : item.priority === 'medium'
                        ? colors.warning
                        : colors.success,
                    fontSize: 9,
                    fontFamily: theme.typography.fontFamily.bold,
                  },
                ]}
              >
                {item.priority.toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={() => deleteTask(item.id, item.title)} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  const renderRoutineItem = (item, index) => {
    const isCompleted = item.status === 'completed';
    const isActive = !item.isTaskLink && item.id === activeRoutineId;

    // Determine overnight suffix formatting inside the card
    let displayEndTime = item.endTime || '';
    if (item.endTime && item.isTaskLink) {
      const isStartDay = item.dueDate === selectedChecklistDate;
      const isOvernight = item.endTime < item.sortTime;
      if (isOvernight && isStartDay) {
        displayEndTime = `Next Day ${item.endTime}`;
      }
    }

    return (
      <View key={item.id} style={styles.timelineRow}>
        {/* Left Side: Start Time (e.g. 06:00, ALL DAY, or MISSED) */}
        <View style={styles.timeWrapper}>
          <Text
            style={[
              styles.timeText,
              {
                color: item.isOverdue 
                  ? colors.warning 
                  : item.isTaskLink 
                  ? colors.primary 
                  : isActive 
                  ? colors.primary 
                  : colors.textSecondary,
                fontFamily: (isActive || item.isTaskLink || item.isOverdue) 
                  ? theme.typography.fontFamily.bold 
                  : theme.typography.fontFamily.medium,
                opacity: isCompleted ? 0.5 : 1,
              },
            ]}
          >
            {item.time}
          </Text>
        </View>

        {/* Center: Timeline Node */}
        <View style={styles.nodeWrapper}>
          <Pressable
            onPress={() => toggleRoutineStatus(item.id, item.status)}
            style={[
              styles.nodeCircle,
              {
                backgroundColor: isCompleted
                  ? `${colors.success}15`
                  : item.isOverdue
                  ? `${colors.warning}15`
                  : item.isTaskLink
                  ? `${colors.primary}15`
                  : isActive
                  ? colors.primary
                  : colors.surfaceSecondary,
                borderColor: isCompleted 
                  ? colors.success 
                  : item.isOverdue 
                  ? colors.warning 
                  : item.isTaskLink 
                  ? colors.primary 
                  : isActive 
                  ? colors.primary 
                  : colors.border,
              },
            ]}
          >
            <Ionicons
              name={isCompleted 
                ? 'checkmark-circle' 
                : item.isOverdue 
                ? 'warning-outline' 
                : item.isTaskLink 
                ? 'document-text-outline' 
                : isActive 
                ? 'time' 
                : 'ellipse-outline'}
              size={18}
              color={isCompleted 
                ? colors.success 
                : item.isOverdue 
                ? colors.warning 
                : (isActive && !item.isTaskLink) 
                ? '#FFFFFF' 
                : colors.primary}
            />
          </Pressable>
        </View>

        {/* Right Side: Routine details Card */}
        <View style={styles.routineCardWrapper}>
          <Card
            style={[
              styles.routineCardInner,
              item.isOverdue && {
                borderColor: colors.warning,
                borderLeftWidth: 4,
                borderLeftColor: colors.warning,
                backgroundColor: `${colors.warning}02`,
              },
              item.isTaskLink && !item.isOverdue && {
                borderColor: colors.primary,
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
                backgroundColor: `${colors.primary}03`,
              },
              isActive && {
                borderColor: colors.primary,
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
                backgroundColor: `${colors.primary}05`,
              },
            ]}
          >
            <View style={styles.routineHeader}>
              <Text
                style={[
                  styles.routineTitle,
                  {
                    color: colors.text,
                    fontSize: typography.sizes.sm,
                    fontFamily: theme.typography.fontFamily.bold,
                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                    opacity: isCompleted ? 0.5 : 1,
                  },
                ]}
              >
                {item.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isActive && (
                  <View style={[styles.nowBadge, { backgroundColor: colors.primary, marginRight: 6 }]}>
                    <Text style={styles.nowBadgeText}>NOW</Text>
                  </View>
                )}
                {/* Delete button placed in header flex group to prevent bottom overlapping */}
                <Pressable
                  onPress={() => handleDeletePress(item)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
            {item.details ? (
              <Text
                style={[
                  styles.routineDetails,
                  {
                    color: colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    marginTop: 2,
                    opacity: isCompleted ? 0.5 : 1,
                  },
                ]}
              >
                {item.details}
              </Text>
            ) : null}

            {/* Overdue Warning Badge */}
            {item.isOverdue && (
              <Text style={{ fontSize: 10, color: colors.warning, fontWeight: '700', marginTop: 4 }}>
                ⚠️ Missed on {item.dueDate}
              </Text>
            )}

            {/* Bottom Meta Row containing Repetition Badge & End Time aligned to bottom right */}
            <View style={styles.routineMetaRow}>
              <View
                style={[
                  styles.frequencyBadge,
                  {
                    backgroundColor:
                      item.frequency === 'task'
                        ? `${colors.primary}20`
                        : item.frequency === 'once'
                        ? '#E74C3C20'
                        : item.frequency === 'weekly'
                        ? `${colors.success}15`
                        : item.frequency === 'monthly'
                        ? `${colors.warning}15`
                        : `${colors.primary}15`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.frequencyText,
                    {
                      color:
                        item.frequency === 'task'
                          ? colors.primary
                          : item.frequency === 'once'
                          ? '#E74C3C'
                          : item.frequency === 'weekly'
                          ? colors.success
                          : item.frequency === 'monthly'
                          ? colors.warning
                          : colors.primary,
                      fontFamily: theme.typography.fontFamily.bold,
                    },
                  ]}
                >
                  {item.frequency ? item.frequency.toUpperCase() : 'DAILY'}
                </Text>
              </View>

              {/* End Time Tag - displayed on the bottom right of the card without overlaps */}
              {displayEndTime ? (
                <Text style={[styles.endTimeText, { color: colors.textMuted, fontFamily: theme.typography.fontFamily.medium }]}>
                  End: {displayEndTime}
                </Text>
              ) : null}
            </View>
          </Card>
        </View>
      </View>
    );
  };

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
          Tasks
        </Text>
        <Pressable
          onPress={() => {
            if (selectedChecklistDate < todayStr) {
              Alert.alert('Restricted Action', 'Adding tasks/routines for past dates is disabled.');
              return;
            }
            setPrefilledDate(selectedChecklistDate); // Ensure the selected date is bridged to the creation sheets!
            setActiveSheet(activeTab === 'checklist' ? 'task' : 'routine');
          }}
          style={styles.headerAddBtn}
        >
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {/* Segmented Top Control (Checklist vs Daily Routine) */}
      <View style={[styles.segmentContainer, { marginHorizontal: spacing.lg }]}>
        <Pressable
          onPress={() => setActiveTab('checklist')}
          style={[
            styles.segmentBtn,
            activeTab === 'checklist' && { backgroundColor: colors.surface, borderRadius: roundness.md - 2 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'checklist' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Tasks Checklist
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('routine')}
          style={[
            styles.segmentBtn,
            activeTab === 'routine' && { backgroundColor: colors.surface, borderRadius: roundness.md - 2 },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color: activeTab === 'routine' ? colors.primary : colors.textSecondary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
          >
            Daily Routine
          </Text>
        </Pressable>
      </View>

      {/* Dynamic 10-Day Calendar Bar (displayed for both modes to sync context) */}
      <View style={styles.dayScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: 8 }}
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDay === day.key;
            const isPast = day.isPast;
            const isCompleted = isDayFullyCompleted(day.fullDateStr);
            
            return (
              <Pressable
                key={day.key}
                onPress={() => {
                  setSelectedDay(day.key);
                  setSelectedChecklistDate(day.fullDateStr);
                }}
                style={[
                  styles.dayBadge,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isCompleted && isPast
                      ? `${colors.success}10`
                      : colors.surface,
                    borderColor: isSelected
                      ? colors.primary
                      : day.isToday
                      ? colors.primary
                      : isCompleted && isPast
                      ? colors.success
                      : colors.border,
                    borderWidth: day.isToday ? 2.5 : 1,
                    opacity: isPast && !isSelected ? 0.65 : 1, // Visual opacity indicator for past dates
                  },
                ]}
              >
                <Text style={[styles.dayLabel, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayNum, { color: isSelected ? '#FFFFFF' : colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                  {day.date}
                </Text>
                <Text style={[styles.dayMonthText, { color: isSelected ? '#FFFFFF' : colors.textMuted }]}>
                  {day.month}
                </Text>
                {isCompleted && isPast && !isSelected && (
                  <View style={styles.completedBadgeCheck}>
                    <Ionicons name="checkmark-circle" size={10} color={colors.success} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        
        {/* Calendar View trigger button */}
        <Pressable
          onPress={() => setIsCalendarVisible(true)}
          style={[styles.calendarLaunchBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {activeTab === 'checklist' ? (
        /* ================= CHECKLIST VIEW ================= */
        <View style={{ flex: 1, marginTop: 8 }}>
          {/* Sub Filters: Today, Missed, Upcoming, Completed */}
          <View style={[styles.tabFilterRow, { marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: theme.roundness.md }]}>
            {['today', 'missed', 'upcoming', 'completed'].map((f) => (
              <Pressable
                key={f}
                onPress={() => setTaskFilter(f)}
                style={[
                  styles.tabFilterBtn,
                  taskFilter === f && { backgroundColor: colors.surface, borderRadius: theme.roundness.md - 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabFilterText,
                    {
                      color: taskFilter === f ? colors.primary : colors.textSecondary,
                      fontFamily: theme.typography.fontFamily.bold,
                    },
                  ]}
                >
                  {f === 'today' ? 'Selected Day' : f === 'missed' ? 'Missed' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={styles.center}>
              <LoadingState type="spinner" />
            </View>
          ) : checklistListData.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                title={taskFilter === 'completed' ? 'No Completed Tasks' : 'All Caught Up!'}
                description={
                  taskFilter === 'completed'
                    ? 'Check off tasks to see them archived here.'
                    : 'Enjoy your free time, or create new goals to accomplish.'
                }
                iconName={taskFilter === 'completed' ? 'checkmark-done-circle-outline' : 'sparkles-outline'}
                actionTitle={taskFilter !== 'completed' && selectedChecklistDate >= todayStr ? 'Create New Task' : null}
                onActionPress={taskFilter !== 'completed' && selectedChecklistDate >= todayStr ? () => {
                  setPrefilledDate(selectedChecklistDate);
                  setActiveSheet('task');
                } : null}
              />
            </View>
          ) : (
            <FlatList
              data={checklistListData}
              keyExtractor={(item) => item.key || String(item.id)}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              renderItem={renderTaskItem}
              ListFooterComponent={
                selectedChecklistDate >= todayStr ? (
                  <Button
                    title="Add New Task"
                    onPress={() => {
                      setPrefilledDate(selectedChecklistDate);
                      setActiveSheet('task');
                    }}
                    variant="primary"
                    style={{ marginVertical: 16 }}
                  />
                ) : null
              }
            />
          )}
        </View>
      ) : (
        /* ================= DAILY ROUTINE VIEW ================= */
        <View style={{ flex: 1, marginTop: 8 }}>
          {loading ? (
            <View style={styles.center}>
              <LoadingState type="spinner" />
            </View>
          ) : routines.length === 0 ? (
            <View style={styles.center}>
              <EmptyState
                title="Daily Schedule Empty"
                description="Seize the day! Outline your recurring routines (workouts, deep focus blocks) here."
                iconName="calendar-outline"
                actionTitle={selectedChecklistDate >= todayStr ? "Add Routine Item" : null}
                onActionPress={selectedChecklistDate >= todayStr ? () => {
                  setPrefilledDate(selectedChecklistDate);
                  setActiveSheet('routine');
                } : null}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <View style={styles.timelineContainer}>
                {/* Timeline vertical axis line */}
                <View style={[styles.verticalLine, { backgroundColor: colors.border }]} />
                
                {routines.map((item, index) => renderRoutineItem(item, index))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* Calendar View Explorer Modal */}
      <Modal visible={isCalendarVisible} animationType="slide" presentationStyle="overFullScreen">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <Pressable onPress={() => setIsCalendarVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              Calendar Explorer
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.calendarWrapper}>
            {/* Month & Year selector header */}
            <View style={styles.calendarMonthHeader}>
              <Pressable onPress={handlePrevMonth} style={styles.monthNavBtn}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.calendarMonthText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {monthNames[calMonth]} {calYear}
              </Text>
              <Pressable onPress={handleNextMonth} style={styles.monthNavBtn}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* Weekday headers */}
            <View style={styles.calendarWeekdaysRow}>
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                <Text key={day} style={[styles.weekdayHeaderText, { color: colors.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarGrid}>
              {getCalendarDays().map((day) => {
                const isSelected = calSelectedDate === day.dateStr;
                const isToday = day.dateStr === todayStr;
                
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => day.dateStr && setCalSelectedDate(day.dateStr)}
                    disabled={!day.dayNum}
                    style={[
                      styles.calendarDayCell,
                      isSelected && { backgroundColor: colors.primary, borderRadius: 8 },
                      !isSelected && isToday && { borderColor: colors.primary, borderWidth: 1, borderRadius: 8 }
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        {
                          color: isSelected
                            ? '#FFFFFF'
                            : isToday
                            ? colors.primary
                            : day.dayNum
                            ? colors.text
                            : 'transparent',
                          fontFamily: (isSelected || isToday) ? theme.typography.fontFamily.bold : theme.typography.fontFamily.regular
                        }
                      ]}
                    >
                      {day.dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Selected Date actions */}
            <View style={styles.calSelectionCard}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                Selected Date: <Text style={{ color: colors.text, fontWeight: '700' }}>{calSelectedDate}</Text>
              </Text>
              <View style={styles.calActionsRow}>
                <Button
                  title={calSelectedDate < todayStr ? "Past Date (Locked)" : "Add Task for Date"}
                  onPress={handleMarkFutureTask}
                  variant={calSelectedDate < todayStr ? "secondary" : "primary"}
                  disabled={calSelectedDate < todayStr}
                  style={{ flex: 1, marginRight: 6, opacity: calSelectedDate < todayStr ? 0.5 : 1 }}
                />
                <Button
                  title="View Checklist"
                  onPress={handleShowTasksForDate}
                  variant="secondary"
                  style={{ flex: 1, marginLeft: 6 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Details Edit Modal */}
      {activeTask && (
        <Modal visible={isEditModalVisible} animationType="slide" presentationStyle="overFullScreen">
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Pressable onPress={() => setIsEditModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                Edit Task Details
              </Text>
              <Pressable onPress={() => deleteTask(activeTask.id, activeTask.title)} style={styles.modalDeleteBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.modalScroll, { padding: spacing.lg }]} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Title</Text>
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
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Task Title"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Description</Text>
              <TextInput
                style={[
                  styles.contentInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.regular,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    padding: spacing.md,
                  },
                ]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Task details..."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Priority</Text>
              <View style={styles.modalCategoryRow}>
                {['low', 'medium', 'high'].map((p) => {
                  const isPriSelected = editPriority === p;
                  const priColor = p === 'high' ? colors.error : p === 'medium' ? colors.warning : colors.success;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setEditPriority(p)}
                      style={[
                        styles.modalCategoryBadge,
                        {
                          backgroundColor: isPriSelected ? priColor : colors.surface,
                          borderColor: isPriSelected ? priColor : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.modalCategoryText, { color: isPriSelected ? '#FFFFFF' : colors.textSecondary }]}>
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    fontFamily: theme.typography.fontFamily.regular,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: roundness.md,
                    padding: spacing.md,
                  },
                ]}
                value={editDueDate}
                onChangeText={setEditDueDate}
                placeholder="2026-12-31"
                placeholderTextColor={colors.textMuted}
              />

              {/* Start & End time inputs with clock pickers */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Start Time</Text>
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'editStartTime', value: editStartTime, onChange: setEditStartTime })}>
                    <View pointerEvents="none">
                      <TextInput
                        style={[
                          styles.titleInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: roundness.md,
                            padding: spacing.md,
                          },
                        ]}
                        value={editStartTime}
                        placeholder="Pick..."
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </Pressable>
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>End Time</Text>
                  <Pressable onPress={() => setTimePickerTarget({ fieldName: 'editEndTime', value: editEndTime, onChange: setEditEndTime })}>
                    <View pointerEvents="none">
                      <TextInput
                        style={[
                          styles.titleInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: roundness.md,
                            padding: spacing.md,
                          },
                        ]}
                        value={editEndTime}
                        placeholder="Pick..."
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </Pressable>
                </View>
              </View>

              <Button
                title="Save Changes"
                onPress={saveTaskChanges}
                variant="primary"
                style={{ marginTop: spacing.xl }}
              />
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Shared TimePicker clock modal */}
      <TimePickerModal
        isVisible={timePickerTarget !== null}
        initialTime={timePickerTarget?.value || new Date().toTimeString().slice(0, 5)}
        onClose={() => setTimePickerTarget(null)}
        onConfirm={(selectedTime) => {
          timePickerTarget?.onChange(selectedTime);
          setTimePickerTarget(null);
        }}
      />
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
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tabFilterRow: {
    flexDirection: 'row',
    height: 40,
    padding: 3,
    marginBottom: 8,
  },
  tabFilterBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabFilterText: {
    fontSize: 13,
  },
  taskCard: {
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxWrapper: {
    paddingRight: 10,
  },
  contentWrapper: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  description: {
    lineHeight: 16,
  },
  metaWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 42,
    paddingLeft: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontWeight: '700',
  },
  deleteButton: {
    padding: 4,
  },
  dayScrollWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 8,
  },
  dayBadge: {
    width: 56,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 13,
    marginTop: 2,
  },
  dayMonthText: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1,
  },
  completedBadgeCheck: {
    position: 'absolute',
    bottom: 2,
  },
  calendarLaunchBtn: {
    width: 44,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: 12,
  },
  verticalLine: {
    position: 'absolute',
    left: 45,
    top: 10,
    bottom: 10,
    width: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timeWrapper: {
    width: 40,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 11,
  },
  nodeWrapper: {
    width: 28,
    alignItems: 'center',
    marginHorizontal: 8,
    zIndex: 10,
  },
  nodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  routineCardWrapper: {
    flex: 1,
  },
  routineCardInner: {
    padding: 12,
    margin: 0,
    borderRadius: 12,
    position: 'relative',
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineTitle: {
    fontWeight: '600',
    flex: 1,
    paddingRight: 32,
  },
  nowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  nowBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  routineDetails: {
    lineHeight: 14,
  },
  routineTrash: {
    padding: 4,
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
    minHeight: 100,
  },
  calendarWrapper: {
    padding: 16,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthNavBtn: {
    padding: 8,
  },
  calendarMonthText: {
    fontSize: 18,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayHeaderText: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  calendarDayCell: {
    width: '14.2%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  calendarDayText: {
    fontSize: 14,
  },
  calSelectionCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0058bc08',
    marginTop: 10,
  },
  calActionsRow: {
    flexDirection: 'row',
  },
  frequencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  frequencyText: {
    fontSize: 9,
    fontWeight: '700',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    marginLeft: 10,
    opacity: 0.5,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    justifyContent: 'center',
  },
  infoBannerText: {
    fontSize: 12,
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  countdownText: {
    fontSize: 10,
  },
  routineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  endTimeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
