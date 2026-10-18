import { Platform } from 'react-native';
import { runQuery } from '../db/sqlite';
import { useStore } from '../store/store';
import { getLocalDateObject } from '../utils/date';

// Direct submodule imports from expo-notifications to bypass index.js side effects in Expo Go
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import cancelAllScheduledNotificationsAsync from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { requestPermissionsAsync, getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { addNotificationReceivedListener, addNotificationResponseReceivedListener } from 'expo-notifications/build/NotificationsEmitter';

// Configure default notification handler (show alerts while app is foregrounded)
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the OS and configure Android channel
 */
export async function requestNotificationPermissions() {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('default', {
      name: 'Default Alerts',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

/**
 * Logs a triggered/received notification into the SQLite history database
 */
export async function logNotificationToDb(title, body, type) {
  try {
    const timestamp = new Date().toISOString();
    await runQuery(
      'INSERT INTO notifications (title, body, type, timestamp, read) VALUES (?, ?, ?, ?, 0)',
      [title, body, type, timestamp]
    );
    // Increment notifications version inside the Zustand store to trigger reactive updates
    useStore.getState().triggerNotificationsUpdate();
  } catch (err) {
    console.warn('[LocalNotifications] Failed to log notification in SQLite:', err);
  }
}

/**
 * Set up listeners for foreground local notifications & notification taps
 */
const loggedNotificationKeys = new Set();
const getNotificationKey = (notification) => `${notification.request.identifier}-${notification.date}`;

export function registerLocalNotificationListeners() {
  const subscription = addNotificationReceivedListener(async (notification) => {
    loggedNotificationKeys.add(getNotificationKey(notification));
    const { title, body, data } = notification.request.content;
    const type = data?.type || 'system';
    await logNotificationToDb(title, body, type);
  });

  const responseSubscription = addNotificationResponseReceivedListener(async (response) => {
    const key = getNotificationKey(response.notification);
    if (loggedNotificationKeys.has(key)) return;
    loggedNotificationKeys.add(key);
    const { title, body, data } = response.notification.request.content;
    const type = data?.type || 'system';
    await logNotificationToDb(title, body, type);
  });

  return () => {
    subscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Schedules all alerts for a checklist Task based on user preferences
 */
export async function scheduleTaskNotifications(task, settings) {
  const taskIdStr = String(task.id);

  // 1. Cancel previous scheduled task notifications
  try {
    await cancelScheduledNotificationAsync(`task-start-${taskIdStr}`);
    await cancelScheduledNotificationAsync(`task-end-${taskIdStr}`);
    await cancelScheduledNotificationAsync(`task-pre-end-${taskIdStr}`);
  } catch (err) {
    // Ignore if not present
  }

  // If task is completed or has no times, we are done
  if (task.status === 'completed' || !task.dueDate || (!task.startTime && !task.endTime)) {
    return;
  }

  const today = new Date();

  // 2. Schedule Task Start Alert
  if (task.startTime && settings.taskStartOffset !== null) {
    const startDate = new Date(`${task.dueDate}T${task.startTime}`);
    const triggerDate = new Date(startDate.getTime() - settings.taskStartOffset * 60 * 1000);

    if (triggerDate > today) {
      const offsetMsg = settings.taskStartOffset === 0 
        ? 'is starting now!' 
        : `starts in ${settings.taskStartOffset} minutes.`;

      await scheduleNotificationAsync({
        identifier: `task-start-${taskIdStr}`,
        content: {
          title: 'Task Alert ⏳',
          body: `"${task.title}" ${offsetMsg}`,
          data: { type: 'task', id: task.id },
        },
        trigger: {
          type: 'date',
          channelId: 'default',
          date: triggerDate,
        },
      });
    }
  }

  // 3. Schedule Task End Alerts
  if (task.endTime) {
    const endDate = new Date(`${task.dueDate}T${task.endTime}`);
    
    // Support overnight span calculations
    if (task.startTime && task.endTime < task.startTime) {
      endDate.setDate(endDate.getDate() + 1);
    }

    // Schedule: At End Time
    if (settings.taskEndAtTime && endDate > today) {
      await scheduleNotificationAsync({
        identifier: `task-end-${taskIdStr}`,
        content: {
          title: 'Task End Alert 🏁',
          body: `"${task.title}" should be completed now.`,
          data: { type: 'task', id: task.id },
        },
        trigger: {
          type: 'date',
          channelId: 'default',
          date: endDate,
        },
      });
    }

    // Schedule: Before End Time
    if (settings.taskEndOffset !== null) {
      const preEndTrigger = new Date(endDate.getTime() - settings.taskEndOffset * 60 * 1000);
      if (preEndTrigger > today) {
        await scheduleNotificationAsync({
          identifier: `task-pre-end-${taskIdStr}`,
          content: {
            title: 'Task Ending Soon ⚠️',
            body: `"${task.title}" ends in ${settings.taskEndOffset} minutes.`,
            data: { type: 'task', id: task.id },
          },
          trigger: {
            type: 'date',
            channelId: 'default',
            date: preEndTrigger,
          },
        });
      }
    }
  }
}

/**
 * Schedules recurring alerts for a Daily Routine item based on user settings
 */
export async function scheduleRoutineNotifications(routine, settings) {
  const routineIdStr = String(routine.id);

  // 1. Cancel previous routine alerts (pre-start, at-start, and end alerts)
  try {
    await cancelScheduledNotificationAsync(`routine-start-${routineIdStr}`);
    await cancelScheduledNotificationAsync(`routine-pre-start-${routineIdStr}`);
    await cancelScheduledNotificationAsync(`routine-end-${routineIdStr}`);
    // Cancel any monthly specific date slots (we schedule up to 6 months)
    for (let m = 0; m < 6; m++) {
      await cancelScheduledNotificationAsync(`routine-start-monthly-${routineIdStr}-${m}`);
      await cancelScheduledNotificationAsync(`routine-pre-start-monthly-${routineIdStr}-${m}`);
      await cancelScheduledNotificationAsync(`routine-end-monthly-${routineIdStr}-${m}`);
    }
  } catch (err) {
    // Ignore cancel warnings
  }

  // If no time is configured, we cannot schedule
  if (!routine.time) {
    return;
  }

  const [startHour, startMinute] = routine.time.split(':').map(Number);
  
  // Calculate pre-start offset values
  const hasOffset = settings.routineOffset !== null && settings.routineOffset > 0;
  let preStartHour = startHour;
  let preStartMinute = startMinute;
  let preStartIsPrevDay = false;

  if (hasOffset) {
    let totalMins = startHour * 60 + startMinute - settings.routineOffset;
    if (totalMins < 0) {
      totalMins += 24 * 60;
      preStartIsPrevDay = true;
    }
    preStartHour = Math.floor(totalMins / 60);
    preStartMinute = totalMins % 60;
  }

  // End Time parameters
  const hasEndTime = !!routine.endTime && settings.routineEndAtTime;
  let endHour = 0;
  let endMinute = 0;
  if (hasEndTime) {
    const [eh, em] = routine.endTime.split(':').map(Number);
    endHour = eh;
    endMinute = em;
  }

  const titlePreStart = 'Routine Coming Up ⏳';
  const bodyPreStart = `"${routine.title}" starts in ${settings.routineOffset} minutes.`;

  const titleStart = 'Routine Alert ⚡';
  const bodyStart = `It's time for "${routine.title}"`;

  const titleEnd = 'Routine Ended 🏁';
  const bodyEnd = `Time's up for "${routine.title}".`;

  const today = new Date();

  // 2. Once Frequency
  if (routine.frequency === 'once') {
    if (!routine.scheduledDate) return;
    const triggerDate = new Date(`${routine.scheduledDate}T${routine.time}`);
    
    // Schedule Pre-Start Reminder
    if (hasOffset) {
      const alertTimePre = new Date(triggerDate.getTime() - settings.routineOffset * 60 * 1000);
      if (alertTimePre > today) {
        await scheduleNotificationAsync({
          identifier: `routine-pre-start-${routineIdStr}`,
          content: {
            title: titlePreStart,
            body: bodyPreStart,
            data: { type: 'routine', id: routine.id },
          },
          trigger: {
            type: 'date',
            channelId: 'default',
            date: alertTimePre,
          },
        });
      }
    }

    // Schedule At-Start Reminder (Always, if routineOffset is set, or if offset is 0)
    if (settings.routineOffset !== null) {
      if (triggerDate > today) {
        await scheduleNotificationAsync({
          identifier: `routine-start-${routineIdStr}`,
          content: {
            title: titleStart,
            body: bodyStart,
            data: { type: 'routine', id: routine.id },
          },
          trigger: {
            type: 'date',
            channelId: 'default',
            date: triggerDate,
          },
        });
      }
    }

    // Schedule End Reminder
    if (hasEndTime) {
      const triggerEndDate = new Date(`${routine.scheduledDate}T${routine.endTime}`);
      if (routine.endTime < routine.time) {
        triggerEndDate.setDate(triggerEndDate.getDate() + 1);
      }
      if (triggerEndDate > today) {
        await scheduleNotificationAsync({
          identifier: `routine-end-${routineIdStr}`,
          content: {
            title: titleEnd,
            body: bodyEnd,
            data: { type: 'routine', id: routine.id },
          },
          trigger: {
            type: 'date',
            channelId: 'default',
            date: triggerEndDate,
          },
        });
      }
    }
    return;
  }

  // 3. Daily Recurrence
  if (routine.frequency === 'daily') {
    // Schedule Pre-Start
    if (hasOffset) {
      await scheduleNotificationAsync({
        identifier: `routine-pre-start-${routineIdStr}`,
        content: {
          title: titlePreStart,
          body: bodyPreStart,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'daily',
          channelId: 'default',
          hour: preStartHour,
          minute: preStartMinute,
        },
      });
    }

    // Schedule At-Start
    if (settings.routineOffset !== null) {
      await scheduleNotificationAsync({
        identifier: `routine-start-${routineIdStr}`,
        content: {
          title: titleStart,
          body: bodyStart,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'daily',
          channelId: 'default',
          hour: startHour,
          minute: startMinute,
        },
      });
    }

    // Schedule End Alert
    if (hasEndTime) {
      await scheduleNotificationAsync({
        identifier: `routine-end-${routineIdStr}`,
        content: {
          title: titleEnd,
          body: bodyEnd,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'daily',
          channelId: 'default',
          hour: endHour,
          minute: endMinute,
        },
      });
    }
    return;
  }

  // 4. Weekly Recurrence (scheduled on the weekday of scheduledDate)
  if (routine.frequency === 'weekly') {
    if (!routine.scheduledDate) return;
    const jsWeekday = getLocalDateObject(routine.scheduledDate).getDay();
    const expoWeekday = jsWeekday + 1;
    const preStartExpoWeekday = preStartIsPrevDay ? ((expoWeekday + 5) % 7) + 1 : expoWeekday;

    // Schedule Pre-Start
    if (hasOffset) {
      await scheduleNotificationAsync({
        identifier: `routine-pre-start-${routineIdStr}`,
        content: {
          title: titlePreStart,
          body: bodyPreStart,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'weekly',
          channelId: 'default',
          weekday: preStartExpoWeekday,
          hour: preStartHour,
          minute: preStartMinute,
        },
      });
    }

    // Schedule At-Start
    if (settings.routineOffset !== null) {
      await scheduleNotificationAsync({
        identifier: `routine-start-${routineIdStr}`,
        content: {
          title: titleStart,
          body: bodyStart,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'weekly',
          channelId: 'default',
          weekday: expoWeekday,
          hour: startHour,
          minute: startMinute,
        },
      });
    }

    // Schedule End Alert
    if (hasEndTime) {
      let endExpoWeekday = expoWeekday;
      if (routine.endTime < routine.time) {
        endExpoWeekday = (expoWeekday % 7) + 1;
      }
      await scheduleNotificationAsync({
        identifier: `routine-end-${routineIdStr}`,
        content: {
          title: titleEnd,
          body: bodyEnd,
          data: { type: 'routine', id: routine.id },
        },
        trigger: {
          type: 'weekly',
          channelId: 'default',
          weekday: endExpoWeekday,
          hour: endHour,
          minute: endMinute,
        },
      });
    }
    return;
  }

  // 5. Monthly Recurrence (schedule exact Date objects for the next 6 months to handle month-end fallbacks)
  if (routine.frequency === 'monthly') {
    if (!routine.scheduledDate) return;
    const sDate = getLocalDateObject(routine.scheduledDate);
    const targetDay = sDate.getDate();

    let currYear = today.getFullYear();
    let currMonth = today.getMonth();

    for (let m = 0; m < 6; m++) {
      const tempMonth = currMonth + m;
      const targetYear = currYear + Math.floor(tempMonth / 12);
      const targetMonthIndex = tempMonth % 12;

      const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
      const actualTargetDay = Math.min(targetDay, daysInTargetMonth);

      const targetMonthStr = String(targetMonthIndex + 1).padStart(2, '0');
      const targetDayStr = String(actualTargetDay).padStart(2, '0');
      
      const scheduledDateStr = `${targetYear}-${targetMonthStr}-${targetDayStr}`;
      const triggerDate = new Date(`${scheduledDateStr}T${routine.time}`);

      // Schedule Pre-Start
      if (hasOffset) {
        const alertTimePre = new Date(triggerDate.getTime() - settings.routineOffset * 60 * 1000);
        if (alertTimePre > today) {
          await scheduleNotificationAsync({
            identifier: `routine-pre-start-monthly-${routineIdStr}-${m}`,
            content: {
              title: titlePreStart,
              body: bodyPreStart,
              data: { type: 'routine', id: routine.id },
            },
            trigger: {
              type: 'date',
              channelId: 'default',
              date: alertTimePre,
            },
          });
        }
      }

      // Schedule At-Start
      if (settings.routineOffset !== null) {
        if (triggerDate > today) {
          await scheduleNotificationAsync({
            identifier: `routine-start-monthly-${routineIdStr}-${m}`,
            content: {
              title: titleStart,
              body: bodyStart,
              data: { type: 'routine', id: routine.id },
            },
            trigger: {
              type: 'date',
              channelId: 'default',
              date: triggerDate,
            },
          });
        }
      }

      // Schedule End Alert
      if (hasEndTime) {
        const triggerEndDate = new Date(`${scheduledDateStr}T${routine.endTime}`);
        if (routine.endTime < routine.time) {
          triggerEndDate.setDate(triggerEndDate.getDate() + 1);
        }
        if (triggerEndDate > today) {
          await scheduleNotificationAsync({
            identifier: `routine-end-monthly-${routineIdStr}-${m}`,
            content: {
              title: titleEnd,
              body: bodyEnd,
              data: { type: 'routine', id: routine.id },
            },
            trigger: {
              type: 'date',
              channelId: 'default',
              date: triggerEndDate,
            },
          });
        }
      }
    }
  }
}

// Clean export of cancel functions so notification manager can cancel
export { cancelAllScheduledNotificationsAsync, cancelScheduledNotificationAsync };
