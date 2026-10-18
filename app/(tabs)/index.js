import React, { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, Dimensions, Image, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Line } from 'react-native-svg';
import { useTheme, getCategoryColor } from '../../src/core/theme/theme';
import { useStore } from '../../src/core/store/store';
import Card from '../../src/shared/components/Card';
import LoadingState from '../../src/shared/components/LoadingState';
import { selectAll, runQuery } from '../../src/core/db/sqlite';
import { useRouter } from 'expo-router';
import { getLocalTodayStr, getYesterdayStr, getNextDayStr, getLocalDateObject, formatLocalDate } from '../../src/core/utils/date';
import { scheduleTaskNotifications } from '../../src/core/notifications/notificationManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BrandLogo from '../../src/shared/components/BrandLogo';

// Bulletproof parser for "2026-06-28T05:43"
const parseTime = (isoString) => {
  if (!isoString) return '';
  const timePart = isoString.split('T')[1];
  if (!timePart) return '';
  const [hoursStr, minutesStr] = timePart.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, roundness } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useStore((state) => state.user);

  // Zustand triggers
  const tasksVersion = useStore((state) => state.tasksVersion);
  const notesVersion = useStore((state) => state.notesVersion);
  const progressVersion = useStore((state) => state.progressVersion);
  const routineVersion = useStore((state) => state.routineVersion);
  const expensesVersion = useStore((state) => state.expensesVersion);
  const targetsVersion = useStore((state) => state.targetsVersion);
  const notificationsVersion = useStore((state) => state.notificationsVersion);
  const hapticsEnabled = useStore((state) => state.hapticsEnabled);

  // Zustand tab routing setters
  const setTasksSubTab = useStore((state) => state.setTasksSubTab);
  const setProgressSubTab = useStore((state) => state.setProgressSubTab);
  const triggerTasksUpdate = useStore((state) => state.triggerTasksUpdate);
  const triggerRoutineUpdate = useStore((state) => state.triggerRoutineUpdate);

  const [loading, setLoading] = useState(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Weather & Geolocation Live States
  const [locationName, setLocationName] = useState('Hyderabad, IN');
  const [currentTemp, setCurrentTemp] = useState('26.5°C');
  const sunriseTime = useStore((state) => state.sunriseTime) || '6:02 AM';
  const sunsetTime = useStore((state) => state.sunsetTime) || '7:24 PM';
  const setSunriseTime = useStore((state) => state.setSunriseTime);
  const setSunsetTime = useStore((state) => state.setSunsetTime);

  // Live Metrics
  const [tasksCount, setTasksCount] = useState({ completed: 0, total: 0 });
  const [missedTasksCount, setMissedTasksCount] = useState(0);
  const [targetsCount, setTargetsCount] = useState({ completed: 0, total: 0 });
  const [routineCount, setRoutineCount] = useState({ completed: 0, total: 0 });
  const [expensesToday, setExpensesToday] = useState(0);

  // Items Lists
  const [todayTasks, setTodayTasks] = useState([]);
  const [todayRoutines, setTodayRoutines] = useState([]);
  const [topTargets, setTopTargets] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState({});
  const [recentNotes, setRecentNotes] = useState([]);

  // Fetch Geolocation and Weather Info
  const fetchWeatherAndLocation = async () => {
    let lat = 17.3850;
    let lon = 78.4867;
    let city = 'Hyderabad';
    let country = 'IN';

    try {
      // 1. IP Geolocation Lookup
      const geoRes = await fetch('https://ipapi.co/json/');
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.latitude && geoData.longitude) {
          lat = geoData.latitude;
          lon = geoData.longitude;
          city = geoData.city || 'Hyderabad';
          country = geoData.country_code || 'IN';
        }
      }
    } catch (e) {
      console.log('[Dashboard] Geolocation API lookup failed, falling back to default:', e);
    }

    try {
      // 2. Weather & Solar Forecast Lookup
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=sunrise,sunset&timezone=auto`;
      const weatherRes = await fetch(weatherUrl);
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();

        if (weatherData.current && weatherData.current.temperature_2m !== undefined) {
          setCurrentTemp(`${weatherData.current.temperature_2m}°C`);
        }

        if (weatherData.daily && weatherData.daily.sunrise && weatherData.daily.sunrise[0]) {
          setSunriseTime(parseTime(weatherData.daily.sunrise[0]));
        }
        if (weatherData.daily && weatherData.daily.sunset && weatherData.daily.sunset[0]) {
          setSunsetTime(parseTime(weatherData.daily.sunset[0]));
        }
      }

      setLocationName(`${city}, ${country}`);
    } catch (err) {
      console.warn('[Dashboard] Open-Meteo weather lookup failed:', err);
    }
  };

  const loadDashboardData = async () => {
    try {
      const todayStr = getLocalTodayStr();

      const isTaskActiveOnDate = (task, dateStr) => {
        if (task.status === 'completed') {
          return task.completedDate === dateStr;
        }
        if (task.status === 'pending') {
          const activeDate = task.dueDate < todayStr ? todayStr : task.dueDate;
          if (dateStr === activeDate) return true;
          if (task.startTime && task.endTime && task.endTime < task.startTime) {
            const yesterday = getYesterdayStr(dateStr);
            if (task.dueDate === yesterday) return true;
          }
        }
        return false;
      };

      // Recurrence checker for Weekly & Monthly routines (with end-of-month fallback)
      const isSameMonthlyDay = (scheduledDateStr, targetDateStr) => {
        const sDate = getLocalDateObject(scheduledDateStr);
        const tDate = getLocalDateObject(targetDateStr);
        const targetDay = sDate.getDate();

        const tYear = tDate.getFullYear();
        const tMonth = tDate.getMonth();
        const daysInTargetMonth = new Date(tYear, tMonth + 1, 0).getDate();

        const actualTargetDay = Math.min(targetDay, daysInTargetMonth);
        return tDate.getDate() === actualTargetDay;
      };

      const isRoutineActiveOnDate = (r, dateStr) => {
        if (r.frequency === 'daily') return true;
        // Older weekly/monthly routines were saved without a scheduledDate; anchor them to their creation day
        const anchorDate = r.scheduledDate || (r.updatedAt ? formatLocalDate(new Date(r.updatedAt)) : null);
        if (r.frequency === 'weekly') {
          if (!anchorDate) return false;
          return getLocalDateObject(anchorDate).getDay() === getLocalDateObject(dateStr).getDay();
        }
        if (r.frequency === 'monthly') {
          if (!anchorDate) return false;
          return isSameMonthlyDay(anchorDate, dateStr);
        }
        if (r.frequency === 'once') {
          return r.scheduledDate === dateStr;
        }
        return false;
      };

      // Task expired end-time overdue checker
      const isTaskOverdueOnDate = (task, dateStr) => {
        if (task.status !== 'pending' || !task.dueDate) return false;

        // Case 1: Any day after the due date (pending tasks roll over until done),
        // except an overnight task from yesterday that is still running
        if (task.dueDate < dateStr) {
          // Future days haven't happened yet, so nothing can be missed on them
          if (dateStr > getLocalTodayStr()) return false;
          const isOvernight = task.startTime && task.endTime && task.endTime < task.startTime;
          if (isOvernight && dateStr === getNextDayStr(task.dueDate) && dateStr === getLocalTodayStr()) {
            const now = new Date();
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const [endH, endM] = task.endTime.split(':').map(Number);
            if (nowMins <= endH * 60 + endM) return false;
          }
          return true;
        }

        // Case 2: A past due date that ended with the task still pending
        if (task.dueDate === dateStr && dateStr < getLocalTodayStr()) {
          const isOvernight = task.startTime && task.endTime && task.endTime < task.startTime;
          // overnight task from yesterday may still be running today
          if (!(isOvernight && dateStr === getYesterdayStr(getLocalTodayStr()))) return true;
        }

        // Case 3: The due date itself, but past the end time
        if (task.dueDate === dateStr && task.endTime) {
          if (task.startTime && task.endTime < task.startTime) {
            return false; // Overnight task spans to next day
          }
          const today = getLocalTodayStr();
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

      // 1. Tasks Metrics & List
      const allTasks = await selectAll('SELECT * FROM tasks ORDER BY id DESC');
      const todayTasksList = allTasks.filter(t => isTaskActiveOnDate(t, todayStr));
      const completedTasks = todayTasksList.filter(t => t.status === 'completed').length;
      setTasksCount({ completed: completedTasks, total: todayTasksList.length });
      setTodayTasks(todayTasksList.slice(0, 3));

      const missedTasksList = allTasks.filter(t => isTaskOverdueOnDate(t, todayStr));
      setMissedTasksCount(missedTasksList.length);

      // 2. Targets Metrics & List
      const allTargets = await selectAll('SELECT * FROM targets');
      const completedTargets = allTargets.filter(t => t.percentage === 100).length;
      setTargetsCount({ completed: completedTargets, total: allTargets.length });
      setTopTargets(allTargets.slice(0, 2));

      // 3. Routine Metrics & List (using left-joined routine_logs for todayStr)
      const allRoutines = await selectAll(
        `SELECT r.*, COALESCE(l.status, 'pending') as status 
         FROM routine r 
         LEFT JOIN routine_logs l ON r.id = l.routineId AND l.logDate = ?`,
        [todayStr]
      );

      const activeRoutines = (allRoutines || []).filter(r => isRoutineActiveOnDate(r, todayStr));

      const formattedRoutines = activeRoutines.map(r => ({
        ...r,
        time: r.time || 'ALL DAY', // no start time = all-day routine
        sortTime: r.time || 'ALL DAY',
        endTime: r.endTime
      }));

      // Routines not ticked yesterday show as MISSED today only
      const yesterdayStr = getYesterdayStr(todayStr);
      const yesterdayLogs = await selectAll(
        "SELECT routineId FROM routine_logs WHERE logDate = ? AND status = 'completed'",
        [yesterdayStr]
      );
      const doneYesterday = new Set((yesterdayLogs || []).map(l => l.routineId));
      const missedRoutines = (allRoutines || []).filter(r => {
        const anchorDate = r.scheduledDate || (r.updatedAt ? formatLocalDate(new Date(r.updatedAt)) : null);
        if (!anchorDate || anchorDate > yesterdayStr) return false; // didn't exist yet
        return isRoutineActiveOnDate(r, yesterdayStr) && !doneYesterday.has(r.id);
      }).map(r => ({
        id: `routine-missed-${r.id}`,
        title: r.title,
        time: 'MISSED',
        sortTime: 'ALL DAY',
        details: r.details,
        frequency: r.frequency,
        status: 'pending',
        isOverdue: true,
        dueDate: yesterdayStr,
        endTime: r.endTime
      }));

      // Load tasks due today
      const dayTasksForRoutine = allTasks.filter(t => isTaskActiveOnDate(t, todayStr) && !isTaskOverdueOnDate(t, todayStr));
      const taskRoutineItems = dayTasksForRoutine.map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        time: t.startTime || 'ALL DAY',
        sortTime: t.startTime || 'ALL DAY',
        details: t.description || 'Checklist Task',
        frequency: 'task',
        status: t.status,
        isTaskLink: true,
        originalTaskId: t.id,
        endTime: t.endTime,
        dueDate: t.dueDate
      }));

      // Load overdue tasks due yesterday or earlier that are still pending
      // Timeline: a missed task only shows on its due day (once expired) and the day after
      const overdueTasks = allTasks.filter(t =>
        isTaskOverdueOnDate(t, todayStr) && (t.dueDate === yesterdayStr || t.dueDate === todayStr)
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

      const combinedRoutines = [...formattedOverdueTasks, ...missedRoutines, ...formattedRoutines, ...taskRoutineItems];
      combinedRoutines.sort((a, b) => {
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

      const completedRoutines = combinedRoutines.filter(r => r.status === 'completed').length;
      setRoutineCount({ completed: completedRoutines, total: combinedRoutines.length });
      setTodayRoutines(combinedRoutines);

      // 4. Expenses Today calculation & Breakdown
      const allExpenses = await selectAll('SELECT * FROM expenses WHERE substr(date, 1, 10) = ?', [todayStr]);
      const spentToday = allExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      setExpensesToday(spentToday);

      const categoryTotals = allExpenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {});
      setExpenseCategories(categoryTotals);

      // 5. Recent Notes
      const notes = await selectAll('SELECT * FROM notes ORDER BY updatedAt DESC LIMIT 3');
      setRecentNotes(notes || []);

      // 6. Unread Notifications Count
      const unreadRow = await selectAll('SELECT COUNT(*) as count FROM notifications WHERE read = 0');
      const unreadCount = unreadRow && unreadRow[0] ? unreadRow[0].count : 0;
      setUnreadNotificationsCount(unreadCount);

    } catch (e) {
      console.warn('[Dashboard] Error querying database:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherAndLocation();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [tasksVersion, notesVersion, progressVersion, routineVersion, expensesVersion, targetsVersion, notificationsVersion]);

  // Refresh when returning to the app (new day, expired task times)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadDashboardData();
    });
    return () => sub.remove();
  }, []);

  // Reschedule or cancel a task's alerts after its status changes (mirrors the Tasks screen)
  const rescheduleTaskAlerts = async (id, nextStatus) => {
    const rows = await selectAll('SELECT * FROM tasks WHERE id = ?', [id]);
    const { notificationSettings, notificationsEnabled } = useStore.getState();
    if (rows && rows[0] && notificationsEnabled) {
      await scheduleTaskNotifications({ ...rows[0], status: nextStatus }, notificationSettings);
    }
  };

  const handleToggleTask = async (id, currentStatus) => {
    try {
      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      }
      const todayStr = getLocalTodayStr();
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const completedDate = nextStatus === 'completed' ? todayStr : null;
      await runQuery('UPDATE tasks SET status = ?, completedDate = ? WHERE id = ?', [nextStatus, completedDate, id]);
      await rescheduleTaskAlerts(id, nextStatus);
      triggerTasksUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRoutine = async (id, currentStatus) => {
    try {
      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      }
      const todayStr = getLocalTodayStr();
      if (String(id).startsWith('routine-missed-')) {
        // Ticking a missed routine records it for yesterday, when it was due
        await runQuery('INSERT OR IGNORE INTO routine_logs (routineId, logDate, status) VALUES (?, ?, ?)', [
          Number(String(id).replace('routine-missed-', '')),
          getYesterdayStr(todayStr),
          'completed'
        ]);
        triggerRoutineUpdate();
      } else if (String(id).startsWith('task-')) {
        const originalTaskId = Number(String(id).replace('task-overdue-', '').replace('task-', ''));
        const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        const completedDate = nextStatus === 'completed' ? todayStr : null;
        await runQuery('UPDATE tasks SET status = ?, completedDate = ? WHERE id = ?', [nextStatus, completedDate, originalTaskId]);
        await rescheduleTaskAlerts(originalTaskId, nextStatus);
        triggerTasksUpdate();
      } else {
        if (currentStatus === 'completed') {
          await runQuery('DELETE FROM routine_logs WHERE routineId = ? AND logDate = ?', [id, todayStr]);
        } else {
          await runQuery('INSERT OR IGNORE INTO routine_logs (routineId, logDate, status) VALUES (?, ?, ?)', [
            id,
            todayStr,
            'completed'
          ]);
        }
        triggerRoutineUpdate();
      }
      loadDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  // Navigations
  const navigateToTasksChecklist = () => {
    setTasksSubTab('checklist');
    router.push('/tasks');
  };

  const navigateToTasksRoutine = () => {
    setTasksSubTab('routine');
    router.push('/tasks');
  };

  const navigateToExpenses = () => {
    setProgressSubTab('expenses');
    router.push('/progress');
  };

  const navigateToTargets = () => {
    setProgressSubTab('targets');
    router.push('/progress');
  };

  // Helper parser: "6:02 AM" -> minutes from midnight
  const parseTimeToMinutes = (timeStr, defaultVal) => {
    if (!timeStr) return defaultVal;
    try {
      const [time, ampm] = timeStr.split(' ');
      const [hStr, mStr] = time.split(':');
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    } catch (err) {
      return defaultVal;
    }
  };

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const sunriseMins = parseTimeToMinutes(sunriseTime, 6 * 60 + 2); // 6:02 AM
  const sunsetMins = parseTimeToMinutes(sunsetTime, 19 * 60 + 24); // 7:24 PM
  const isNight = currentMins >= sunsetMins || currentMins < sunriseMins;

  // Calculate coordinates dynamically on solar/lunar arch path
  const getPositionCoords = () => {
    const defaultCoords = { x: 150, y: 115 };
    try {
      if (!isNight) {
        // Sun Path: Left (Sunrise) to Right (Sunset)
        const ratio = (currentMins - sunriseMins) / (sunsetMins - sunriseMins);
        const angle = Math.PI - ratio * Math.PI;
        const x = 150 + 120 * Math.cos(angle);
        const y = 130 - 120 * Math.sin(angle);
        return { x, y };
      } else {
        // Moon Path: Left (Moonrise at Sunset) to Right (Moonset at Sunrise)
        let nightElapsed = 0;
        const nightTotal = (1440 - sunsetMins) + sunriseMins;

        if (currentMins > sunsetMins) {
          nightElapsed = currentMins - sunsetMins;
        } else {
          nightElapsed = (1440 - sunsetMins) + currentMins;
        }

        const ratio = nightElapsed / nightTotal;
        const angle = Math.PI - ratio * Math.PI; // Starts at PI (Left), travels to 0 (Right)
        const x = 150 + 120 * Math.cos(angle);
        const y = 130 - 120 * Math.sin(angle);
        return { x, y };
      }
    } catch (err) {
      return defaultCoords;
    }
  };

  const activeCoords = getPositionCoords();

  // Dynamic Routine active node finder
  const getActiveRoutineId = () => {
    if (!todayRoutines || todayRoutines.length === 0) return null;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    // Only real routines get the NOW marker (not linked/overdue/all-day tasks)
    const itemsWithMins = todayRoutines.filter(item => !item.isTaskLink && !item.isOverdue && item.time && item.time.includes(':')).map(item => {
      if (!item.time || !item.time.includes(':')) {
        return { id: item.id, mins: 0 };
      }
      const [h, m] = item.time.split(':').map(Number);
      return { id: item.id, mins: (isNaN(h) || isNaN(m)) ? 0 : h * 60 + m };
    });
    itemsWithMins.sort((a, b) => a.mins - b.mins);
    let activeItem = null;
    for (let i = 0; i < itemsWithMins.length; i++) {
      if (itemsWithMins[i].mins <= currentMins) {
        activeItem = itemsWithMins[i];
      }
    }
    return activeItem ? activeItem.id : null;
  };

  const activeRoutineId = getActiveRoutineId();

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <LoadingState type="spinner" />
      </View>
    );
  }

  // Categories spent values
  const foodSpent = expenseCategories['Food & Dining'] || 0;
  const transportSpent = expenseCategories['Transport'] || 0;
  const shoppingSpent = expenseCategories['Shopping'] || 0;
  // Everything that isn't Food/Transport/Shopping (incl. user-created categories) counts as Other
  const allCategorySpent = Object.values(expenseCategories).reduce((acc, v) => acc + (v || 0), 0);
  const otherSpent = Math.max(0, allCategorySpent - foodSpent - transportSpent - shoppingSpent);
  const totalCategorySpent = foodSpent + transportSpent + shoppingSpent + otherSpent;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Top Header Row */}
        <View style={[styles.headerBar, { marginTop: Math.max(12, insets.top) }]}>
          <View style={{ width: 38, height: 38 }} />
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatar, { backgroundColor: colors.primary, overflow: 'hidden' }]}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
              ) : (
                <Text style={styles.avatarText}>
                  {user.name.split(' ').map((n) => n[0]).join('')}
                </Text>
              )}
            </View>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.headerBtn}>
            {unreadNotificationsCount > 0 && (
              <View style={[styles.badgeDot, { backgroundColor: colors.accent, width: 15, height: 15, borderRadius: 7.5, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: -3, right: -3, zIndex: 10 }]}>
                <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '800' }}>
                  {unreadNotificationsCount}
                </Text>
              </View>
            )}
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Greetings */}
        <View style={styles.greetingsBlock}>
          <Text style={[styles.greetingText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            {(() => {
              const hr = now.getHours();
              if (hr >= 5 && hr < 12) return 'Good Morning';
              if (hr >= 12 && hr < 17) return 'Good Afternoon';
              if (hr >= 17 && hr < 23) return 'Good Evening';
              return 'Good Night';
            })()}, {user.name.split(' ')[0]} 👋
          </Text>
          <Text style={[styles.subGreetingText, { color: colors.textSecondary }]}>
            {isNight ? "Night, we have to rest for health" : "Let's make today productive!"}
          </Text>
        </View>

        {/* Location & Temp Pill Badge */}
        <View style={styles.locationBadgeRow}>
          <View style={[styles.locationBadge, { backgroundColor: '#0058bc10', borderColor: colors.border }]}>
            <Ionicons name="location-sharp" size={12} color={colors.primary} />
            <Text style={[styles.locationText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              {locationName}
            </Text>
            <View style={styles.badgeSeparator} />
            <Ionicons name={isNight ? "moon" : "thermometer"} size={12} color={isNight ? "#F5F6FA" : "#F1C40F"} />
            <Text style={[styles.locationText, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              {currentTemp}
            </Text>
          </View>
        </View>

        {/* Solar/Lunar Dial Sunrise/Sunset Arch */}
        <View style={styles.solarDialWrapper}>
          <Svg width="100%" height="150" viewBox="0 0 300 150">
            <Defs>
              {/* Day Mountain gradients */}
              <LinearGradient id="mountainGrad1" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={isNight ? "#1B2A4A" : "#E2E8F8"} stopOpacity={isNight ? "0.7" : "0.4"} />
                <Stop offset="1" stopColor={isNight ? "#0B1325" : "#FFFFFF"} stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="mountainGrad2" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={isNight ? "#0B1226" : "#0058bc"} stopOpacity={isNight ? "0.9" : "0.08"} />
                <Stop offset="1" stopColor={isNight ? "#05070F" : "#FFFFFF"} stopOpacity="1" />
              </LinearGradient>
            </Defs>

            {/* Dotted Sun/Moon Path Arc */}
            <Path
              d="M 30 130 A 120 120 0 0 1 270 130"
              fill="none"
              stroke={isNight ? "#1F2C46" : "#D3DAEA"}
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Landscape mountains Vector Graphics */}
            <Path d="M10 130 L80 90 L160 115 L220 85 L290 130 Z" fill="url(#mountainGrad1)" />
            <Path d="M40 130 L110 100 L180 122 L250 95 L280 130 Z" fill="url(#mountainGrad2)" />

            {/* Starry night details */}
            {isNight && (
              <>
                <Circle cx="50" cy="30" r="1" fill="#FFFFFF" opacity="0.8" />
                <Circle cx="85" cy="50" r="1.5" fill="#FFFFFF" opacity="0.6" />
                <Circle cx="120" cy="25" r="1" fill="#FFFFFF" opacity="0.9" />
                <Circle cx="180" cy="40" r="1.5" fill="#FFFFFF" opacity="0.7" />
                <Circle cx="215" cy="30" r="1" fill="#FFFFFF" opacity="0.8" />
                <Circle cx="250" cy="55" r="1.2" fill="#FFFFFF" opacity="0.5" />
              </>
            )}

            {/* Daytime clouds details */}
            {!isNight && (
              <>
                <G opacity="0.65" transform="translate(45, 20) scale(0.6)">
                  <Path
                    d="M 10,25 A 8,8 0 0,1 22,17 A 12,12 0 0,1 46,19 A 9,9 0 0,1 58,25 A 8,8 0 0,1 54,35 L 14,35 A 8,8 0 0,1 10,25 Z"
                    fill="#FFFFFF"
                  />
                </G>
                <G opacity="0.5" transform="translate(200, 32) scale(0.5)">
                  <Path
                    d="M 10,25 A 8,8 0 0,1 22,17 A 12,12 0 0,1 46,19 A 9,9 0 0,1 58,25 A 8,8 0 0,1 54,35 L 14,35 A 8,8 0 0,1 10,25 Z"
                    fill="#FFFFFF"
                  />
                </G>
                <G opacity="0.55" transform="translate(120, 15) scale(0.45)">
                  <Path
                    d="M 10,25 A 8,8 0 0,1 22,17 A 12,12 0 0,1 46,19 A 9,9 0 0,1 58,25 A 8,8 0 0,1 54,35 L 14,35 A 8,8 0 0,1 10,25 Z"
                    fill="#FFFFFF"
                  />
                </G>
              </>
            )}

            {/* Rising Sun or Crescent Moon dynamic marker */}
            {!isNight ? (
              // Sun
              <G>
                {/* Radiating Rays */}
                <Line x1={activeCoords.x} y1={activeCoords.y - 18} x2={activeCoords.x} y2={activeCoords.y - 23} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x} y1={activeCoords.y + 18} x2={activeCoords.x} y2={activeCoords.y + 23} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x - 18} y1={activeCoords.y} x2={activeCoords.x - 23} y2={activeCoords.y} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x + 18} y1={activeCoords.y} x2={activeCoords.x + 23} y2={activeCoords.y} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />

                <Line x1={activeCoords.x - 13} y1={activeCoords.y - 13} x2={activeCoords.x - 17} y2={activeCoords.y - 17} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x + 13} y1={activeCoords.y - 13} x2={activeCoords.x + 17} y2={activeCoords.y - 17} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x - 13} y1={activeCoords.y + 13} x2={activeCoords.x - 17} y2={activeCoords.y + 17} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />
                <Line x1={activeCoords.x + 13} y1={activeCoords.y + 13} x2={activeCoords.x + 17} y2={activeCoords.y + 17} stroke="#F1C40F" strokeWidth="2" strokeLinecap="round" />

                <Circle cx={activeCoords.x} cy={activeCoords.y} r="14" fill="#FFFFFF" stroke="#F1C40F" strokeWidth="2" />
                <Circle cx={activeCoords.x} cy={activeCoords.y} r="5" fill="#F1C40F" />
              </G>
            ) : (
              // Moon (Crescent SVG path)
              <G transform={`translate(${activeCoords.x - 12}, ${activeCoords.y - 12})`}>
                <Circle cx="12" cy="12" r="14" fill="#FFFFFF" stroke="#D3DAEA" strokeWidth="2" />
                <Path
                  d="M12 4a8 8 0 0 0-6.19 12.96 8 8 0 1 1 11.34-9.9A8 8 0 0 0 12 4z"
                  fill="#717786"
                />
              </G>
            )}
          </Svg>

          {/* Sunrise / Moonrise Overlay (Left) */}
          <View style={styles.leftSolarOverlay}>
            <Ionicons
              name={isNight ? "moon-outline" : "sunny-outline"}
              size={14}
              color={isNight ? "#717786" : "#F1C40F"}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.solarOverlayLabel, { color: colors.textSecondary }]}>
              {isNight ? "Moonrise" : "Sunrise"}
            </Text>
            <Text style={[styles.solarOverlayTime, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              {isNight ? sunsetTime : sunriseTime}
            </Text>
          </View>

          {/* Sunset / Moonset Overlay (Right) */}
          <View style={styles.rightSolarOverlay}>
            <Ionicons
              name={isNight ? "moon-outline" : "sunny-outline"}
              size={14}
              color={isNight ? "#717786" : "#F1C40F"}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.solarOverlayLabel, { color: colors.textSecondary }]}>
              {isNight ? "Moonset" : "Sunset"}
            </Text>
            <Text style={[styles.solarOverlayTime, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
              {isNight ? sunriseTime : sunsetTime}
            </Text>
          </View>

          {/* Quote Block */}
          <View style={[styles.quoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.quoteText, { color: colors.textSecondary }]}>
              “ Discipline is choosing between what you want now and what you want most. ”
            </Text>
          </View>
        </View>

        {/* Bento Grid Stats */}
        <View style={styles.bentoGrid}>
          {/* Card 1: Tasks */}
          <Pressable onPress={navigateToTasksChecklist} style={styles.bentoCol}>
            <Card style={styles.bentoCardInner} bordered>
              <View style={[styles.bentoIconWrapper, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="checkbox" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>Tasks</Text>
              <Text style={[styles.bentoVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {tasksCount.completed} / {tasksCount.total}
              </Text>
              <Text style={{ fontSize: 9, color: colors.textMuted }}>Today</Text>
            </Card>
          </Pressable>

          {/* Card 2: Targets */}
          <Pressable onPress={navigateToTargets} style={styles.bentoCol}>
            <Card style={styles.bentoCardInner} bordered>
              <View style={[styles.bentoIconWrapper, { backgroundColor: `${colors.success}15` }]}>
                <Ionicons name="ribbon" size={20} color={colors.success} />
              </View>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>Targets</Text>
              <Text style={[styles.bentoVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {targetsCount.completed} / {targetsCount.total}
              </Text>
              <Text style={{ fontSize: 9, color: colors.textMuted }}>On Track</Text>
            </Card>
          </Pressable>

          {/* Card 3: Routine */}
          <Pressable onPress={navigateToTasksRoutine} style={styles.bentoCol}>
            <Card style={styles.bentoCardInner} bordered>
              <View style={[styles.bentoIconWrapper, { backgroundColor: `${colors.accent}15` }]}>
                <Ionicons name="barbell" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>Routine</Text>
              <Text style={[styles.bentoVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                {routineCount.completed} / {routineCount.total}
              </Text>
              <Text style={{ fontSize: 9, color: colors.textMuted }}>Completed</Text>
            </Card>
          </Pressable>

          {/* Card 4: Expenses */}
          <Pressable onPress={navigateToExpenses} style={styles.bentoCol}>
            <Card style={styles.bentoCardInner} bordered>
              <View style={[styles.bentoIconWrapper, { backgroundColor: '#F1C40F15' }]}>
                <Ionicons name="card" size={20} color="#F1C40F" />
              </View>
              <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.bentoVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                ₹{expensesToday.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 9, color: colors.textMuted }}>Today</Text>
            </Card>
          </Pressable>
        </View>

        {/* Section: Today's Tasks */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Today's Tasks <Text style={{ color: colors.primary, fontSize: 13 }}>{tasksCount.total}</Text>
          </Text>
          <Pressable onPress={navigateToTasksChecklist}>
            <Text style={[styles.viewAllBtn, { color: colors.textSecondary }]}>View All ›</Text>
          </Pressable>
        </View>

        <Card style={styles.taskListCard} bordered>
          {todayTasks.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 12 }}>
              No tasks due today.
            </Text>
          ) : (
            todayTasks.map((t) => {
              const isChecked = t.status === 'completed';
              return (
                <View key={t.id} style={[styles.taskRowItem, { borderColor: colors.border }]}>
                  <Pressable onPress={() => handleToggleTask(t.id, t.status)} style={styles.checkboxTouch}>
                    <Ionicons
                      name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isChecked ? colors.success : colors.textMuted}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.taskRowTitle,
                        {
                          color: colors.text,
                          textDecorationLine: isChecked ? 'line-through' : 'none',
                          opacity: isChecked ? 0.6 : 1,
                        },
                      ]}
                    >
                      {t.title}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted }}>
                      {t.priority.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>
                    {t.dueDate || 'Today'}
                  </Text>
                </View>
              );
            })
          )}

          {missedTasksCount > 0 && (
            <Pressable
              onPress={navigateToTasksChecklist}
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 10,
                marginTop: 6,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons name="warning-outline" size={14} color={colors.warning} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 11, color: colors.warning, fontWeight: '700' }}>
                {missedTasksCount} missed task{missedTasksCount > 1 ? 's' : ''} need{missedTasksCount > 1 ? '' : 's'} attention
              </Text>
            </Pressable>
          )}
        </Card>

        {/* Section: Today's Routine */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Today's Routine
          </Text>
          <Pressable onPress={navigateToTasksRoutine}>
            <Text style={[styles.viewAllBtn, { color: colors.textSecondary }]}>View All ›</Text>
          </Pressable>
        </View>

        <Card style={styles.routineListCard} bordered>
          {todayRoutines.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>
              No routine items scheduled.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
              <View style={styles.horizontalTimelineRow}>
                {/* Horizontal line connector */}
                <View style={[styles.horizontalLine, { backgroundColor: colors.border }]} />

                {todayRoutines.map((r, idx) => {
                  const isDone = r.status === 'completed';
                  const isNow = r.id === activeRoutineId;
                  return (
                    <View key={r.id} style={styles.timelineNodeBlock}>
                      <Pressable
                        onPress={() => handleToggleRoutine(r.id, r.status)}
                        style={[
                          styles.timelineNodeCircle,
                          {
                            backgroundColor: isDone
                              ? colors.success
                              : isNow
                                ? colors.primary
                                : colors.surfaceSecondary,
                            borderColor: isDone ? colors.success : isNow ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isDone ? 'checkmark' : isNow ? 'time' : 'ellipse-outline'}
                          size={14}
                          color={isDone || isNow ? '#FFFFFF' : colors.textMuted}
                        />
                      </Pressable>
                      <Text style={[styles.timelineNodeTitle, { color: colors.text }]}>{r.title.split(' ')[0]}</Text>
                      <Text style={styles.timelineNodeTime}>{r.time}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Card>

        {/* Side-by-side Targets & Expenses */}
        <View style={styles.splitRow}>
          {/* Targets Block */}
          <View style={styles.splitCol}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                Targets
              </Text>
              <Pressable onPress={navigateToTargets}>
                <Text style={[styles.viewAllBtn, { color: colors.textSecondary }]}>View All ›</Text>
              </Pressable>
            </View>

            <Card style={styles.splitCardInner} bordered>
              {topTargets.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 12 }}>
                  No active targets.
                </Text>
              ) : (
                topTargets.map((target) => (
                  <View key={target.id} style={styles.targetProgressItem}>
                    <Text style={[styles.targetProgressLabel, { color: colors.text }]} numberOfLines={1}>
                      {target.title}
                    </Text>
                    <View style={styles.progressRow}>
                      <View style={[styles.progressBarOuter, { backgroundColor: colors.surfaceSecondary }]}>
                        <View style={[styles.progressBarInner, { backgroundColor: colors.primary, width: `${target.percentage}%` }]} />
                      </View>
                      <Text style={[styles.pctText, { color: colors.textSecondary }]}>
                        {target.percentage}%
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>

          {/* Expenses Block */}
          <View style={styles.splitCol}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                Expenses
              </Text>
              <Pressable onPress={navigateToExpenses}>
                <Text style={[styles.viewAllBtn, { color: colors.textSecondary }]}>View All ›</Text>
              </Pressable>
            </View>

            <Card style={styles.splitCardInner} bordered>
              <View style={styles.expensesDonutRow}>
                {/* SVG Donut Chart */}
                <View style={styles.donutContainer}>
                  <Svg width="56" height="56" viewBox="0 0 40 40">
                    <Circle cx="20" cy="20" r="15.915" fill="transparent" stroke={colors.border} strokeWidth="5" />
                    {foodSpent > 0 && (
                      <Circle cx="20" cy="20" r="15.915" fill="transparent" stroke={getCategoryColor('Food & Dining')} strokeWidth="5"
                        strokeDasharray={`${Math.round((foodSpent / totalCategorySpent) * 100)} ${100 - Math.round((foodSpent / totalCategorySpent) * 100)}`}
                        strokeDashoffset="25" />
                    )}
                    {transportSpent > 0 && (
                      <Circle cx="20" cy="20" r="15.915" fill="transparent" stroke={getCategoryColor('Transport')} strokeWidth="5"
                        strokeDasharray={`${Math.round((transportSpent / totalCategorySpent) * 100)} ${100 - Math.round((transportSpent / totalCategorySpent) * 100)}`}
                        strokeDashoffset={25 - Math.round((foodSpent / totalCategorySpent) * 100)} />
                    )}
                    {shoppingSpent > 0 && (
                      <Circle cx="20" cy="20" r="15.915" fill="transparent" stroke={getCategoryColor('Shopping')} strokeWidth="5"
                        strokeDasharray={`${Math.round((shoppingSpent / totalCategorySpent) * 100)} ${100 - Math.round((shoppingSpent / totalCategorySpent) * 100)}`}
                        strokeDashoffset={25 - Math.round((foodSpent / totalCategorySpent) * 100) - Math.round((transportSpent / totalCategorySpent) * 100)} />
                    )}
                  </Svg>
                </View>

                {/* Donut Legend */}
                <View style={styles.legendContainer}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: getCategoryColor('Food & Dining') }]} />
                    <Text style={styles.legendText} numberOfLines={1}>Food & Dining</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: getCategoryColor('Transport') }]} />
                    <Text style={styles.legendText} numberOfLines={1}>Transport</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: getCategoryColor('Shopping') }]} />
                    <Text style={styles.legendText} numberOfLines={1}>Shopping</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.totalSpentRow, { borderTopColor: colors.border }]}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Total Today</Text>
                <Text style={[styles.totalSpentVal, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
                  ₹{expensesToday.toFixed(2)}
                </Text>
              </View>
            </Card>
          </View>
        </View>

        {/* Section: Recent Notes */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold }]}>
            Recent Notes
          </Text>
          <Pressable onPress={() => router.push('/notes')}>
            <Text style={[styles.viewAllBtn, { color: colors.textSecondary }]}>View All ›</Text>
          </Pressable>
        </View>

        {recentNotes.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 12 }}>
            No notes created yet.
          </Text>
        ) : (
          <View style={{ width: '100%' }}>
            {recentNotes.map((note) => (
              <Pressable key={note.id} onPress={() => router.push({ pathname: '/notes', params: { openNoteId: String(note.id) } })} style={{ width: '100%' }}>
                <Card style={[styles.recentNoteCard, { marginRight: 0 }]} bordered>
                  <View style={styles.noteCardHeader}>
                    <View style={[styles.noteCategoryDot, { backgroundColor: note.color || colors.primary }]} />
                    <Text style={styles.noteCategoryText} numberOfLines={1}>{note.category}</Text>
                  </View>
                  <Text style={[styles.recentNoteTitle, { color: colors.text, fontFamily: theme.typography.fontFamily.bold, marginTop: 4 }]} numberOfLines={1}>
                    {note.title}
                  </Text>
                  {note.content ? (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: theme.typography.fontFamily.regular, marginTop: 2 }} numberOfLines={1}>
                      {note.content}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 6 }}>
                    {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    height: 48,
  },
  headerBtn: {
    padding: 8,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ba1a1a',
    zIndex: 10,
  },
  avatarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  greetingsBlock: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  greetingText: {
    fontSize: 22,
  },
  subGreetingText: {
    fontSize: 13,
    marginTop: 2,
  },
  locationBadgeRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  locationText: {
    fontSize: 11,
    marginLeft: 4,
  },
  badgeSeparator: {
    width: 1,
    height: 12,
    backgroundColor: '#D3DAEA',
    marginHorizontal: 8,
  },
  solarDialWrapper: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    width: '100%',
  },
  solarMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: -20,
  },
  metaTimeCol: {
    width: '45%',
  },
  metaIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaLabelText: {
    fontSize: 10,
    color: '#717786',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  metaTimeVal: {
    fontSize: 15,
  },
  leftSolarOverlay: {
    position: 'absolute',
    left: 8,
    top: 40,
    alignItems: 'center',
  },
  rightSolarOverlay: {
    position: 'absolute',
    right: 8,
    top: 40,
    alignItems: 'center',
  },
  solarOverlayLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  solarOverlayTime: {
    fontSize: 13,
    marginTop: 2,
  },
  quoteCard: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 14,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  bentoCol: {
    width: '48%',
    marginBottom: 12,
  },
  bentoCardInner: {
    padding: 12,
    margin: 0,
    alignItems: 'center',
  },
  bentoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bentoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bentoVal: {
    fontSize: 15,
    marginVertical: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskListCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  taskRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  checkboxTouch: {
    paddingRight: 10,
  },
  taskRowTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  routineListCard: {
    padding: 10,
    marginBottom: 20,
  },
  horizontalTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 70,
    paddingHorizontal: 8,
  },
  horizontalLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 22,
    height: 2,
    zIndex: 1,
  },
  timelineNodeBlock: {
    width: 68,
    alignItems: 'center',
    zIndex: 10,
  },
  timelineNodeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  timelineNodeTitle: {
    fontSize: 9,
    fontWeight: '600',
  },
  timelineNodeTime: {
    fontSize: 8,
    color: '#717786',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  splitCol: {
    width: '48%',
  },
  splitCardInner: {
    margin: 0,
    padding: 12,
    height: 140,
    justifyContent: 'space-between',
  },
  targetProgressItem: {
    marginBottom: 10,
  },
  targetProgressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBarOuter: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    borderRadius: 2.5,
  },
  pctText: {
    fontSize: 9,
    paddingLeft: 6,
    width: 24,
    textAlign: 'right',
  },
  expensesDonutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    fontSize: 8,
    color: '#717786',
    flex: 1,
  },
  totalSpentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 6,
  },
  totalSpentVal: {
    fontSize: 11,
  },
  recentNoteCard: {
    flex: 1,
    padding: 12,
    marginBottom: 10,
    margin: 0,
    marginRight: 10,
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  noteCategoryText: {
    fontSize: 9,
    color: '#717786',
    fontWeight: '600',
  },
  recentNoteTitle: {
    fontSize: 12,
    marginTop: 4,
  },
});
