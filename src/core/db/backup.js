import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { runQuery, selectAll, withTransaction } from './sqlite';
import { useStore } from '../store/store';
import { getLocalTodayStr } from '../utils/date';
import {
  cancelAllScheduledNotificationsAsync,
  scheduleTaskNotifications,
  scheduleRoutineNotifications,
} from '../notifications/notificationManager';

const BACKUP_APP_ID = 'lifeos';
const BACKUP_VERSION = 1;

// Every user-data table, in the order they are restored
const BACKUP_TABLES = ['tasks', 'notes', 'progress_logs', 'routine', 'routine_logs', 'expenses', 'targets', 'notifications'];

// Persisted preferences included in the backup (mirrors the store's partialize list)
const SETTINGS_KEYS = ['user', 'themeMode', 'notificationsEnabled', 'hapticsEnabled', 'sunriseTime', 'sunsetTime', 'notificationSettings', 'customExpenseCategories'];

/**
 * Writes all tables and preferences to a JSON file and opens the share sheet
 * (save to Drive, Files, email, etc.).
 */
export async function exportBackup() {
  const tables = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = await selectAll(`SELECT * FROM ${table}`);
  }

  const state = useStore.getState();
  const settings = {};
  SETTINGS_KEYS.forEach((key) => {
    settings[key] = state[key];
  });

  const payload = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    settings,
  };

  const file = new File(Paths.cache, `lifeos-backup-${getLocalTodayStr()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save LifeOS Backup',
    UTI: 'public.json',
  });

  const counts = {};
  BACKUP_TABLES.forEach((t) => { counts[t] = tables[t].length; });
  return counts;
}

/**
 * Lets the user pick a backup file and parses/validates it.
 * Returns null if the user cancelled.
 */
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets || !result.assets[0]) return null;

  const text = await new File(result.assets[0].uri).text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error('This file is not a valid LifeOS backup.');
  }
  if (!payload || payload.app !== BACKUP_APP_ID || !payload.tables || typeof payload.tables !== 'object' || Array.isArray(payload.tables)) {
    throw new Error('This file is not a valid LifeOS backup.');
  }
  if (payload.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  return payload;
}

/**
 * Replaces all local data with the contents of a backup, then reschedules alerts.
 */
export async function restoreBackup(payload) {
  // Only columns that exist in the current schema are restored (also keeps keys out of raw SQL)
  const columnsByTable = {};
  for (const table of BACKUP_TABLES) {
    const info = await selectAll(`PRAGMA table_info(${table})`);
    columnsByTable[table] = new Set(info.map((c) => c.name));
  }

  await withTransaction(async () => {
    for (const table of BACKUP_TABLES) {
      await runQuery(`DELETE FROM ${table}`);
      const rows = Array.isArray(payload.tables[table]) ? payload.tables[table] : [];
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => columnsByTable[table].has(c));
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        await runQuery(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map((c) => row[c])
        );
      }
    }
  });

  if (payload.settings && typeof payload.settings === 'object') {
    const restored = {};
    SETTINGS_KEYS.forEach((key) => {
      if (payload.settings[key] !== undefined) restored[key] = payload.settings[key];
    });
    useStore.setState(restored);
  }

  await refreshAfterBulkChange();
}

/**
 * After a bulk data change: reschedules every alert from the database and refreshes all screens.
 */
export async function refreshAfterBulkChange() {
  const store = useStore.getState();
  store.triggerTasksUpdate();
  store.triggerNotesUpdate();
  store.triggerProgressUpdate();
  store.triggerRoutineUpdate();
  store.triggerExpensesUpdate();
  store.triggerTargetsUpdate();
  store.triggerNotificationsUpdate();

  // Drop alerts for the old data and schedule the current items (best effort per item)
  try {
    await cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[Backup] Could not cancel old alerts:', e);
  }
  const { notificationsEnabled, notificationSettings } = useStore.getState();
  if (!notificationsEnabled) return;
  const tasks = await selectAll("SELECT * FROM tasks WHERE status = 'pending'");
  for (const task of tasks) {
    try {
      await scheduleTaskNotifications(task, notificationSettings);
    } catch (e) {
      console.warn('[Backup] Could not schedule task alert:', e);
    }
  }
  const routines = await selectAll('SELECT * FROM routine');
  for (const routine of routines) {
    try {
      await scheduleRoutineNotifications(routine, notificationSettings);
    } catch (e) {
      console.warn('[Backup] Could not schedule routine alert:', e);
    }
  }
}
