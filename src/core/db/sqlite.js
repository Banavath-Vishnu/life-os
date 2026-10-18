import * as SQLite from 'expo-sqlite';

let db = null;

/**
 * Initializes the SQLite database and creates tables if they don't exist.
 */
export async function initDb() {
  if (db) return db;

  try {
    db = await SQLite.openDatabaseAsync('lifeos.db');

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create Tasks table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        dueDate TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    // Ensure the startTime column exists in the tasks table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE tasks ADD COLUMN startTime TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Ensure the endTime column exists in the tasks table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE tasks ADD COLUMN endTime TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Ensure the completedDate column exists in the tasks table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE tasks ADD COLUMN completedDate TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Create Notes table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        color TEXT DEFAULT '#6366F1',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    // Create Progress Metrics table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS progress_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metricName TEXT NOT NULL,
        value REAL NOT NULL,
        logDate TEXT NOT NULL,
        notes TEXT
      );
    `);

    // Create Routine table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        time TEXT NOT NULL,
        details TEXT,
        frequency TEXT NOT NULL DEFAULT 'daily',
        status TEXT NOT NULL DEFAULT 'pending',
        updatedAt TEXT NOT NULL
      );
    `);

    // Ensure the frequency column exists in the routine table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE routine ADD COLUMN frequency TEXT NOT NULL DEFAULT 'daily'");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Ensure the scheduledDate column exists in the routine table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE routine ADD COLUMN scheduledDate TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Ensure the endTime column exists in the routine table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE routine ADD COLUMN endTime TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Create Routine logs table (dynamic date-specific completions)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routine_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routineId INTEGER NOT NULL,
        logDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        UNIQUE(routineId, logDate)
      );
    `);

    // Create Expenses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL
      );
    `);

    // Create Targets table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        percentage INTEGER NOT NULL DEFAULT 0,
        completedCount INTEGER NOT NULL DEFAULT 0,
        totalCount INTEGER NOT NULL DEFAULT 10,
        dueDate TEXT NOT NULL
      );
    `);

    // Ensure the stepTexts column exists in the targets table (safe alter schema check)
    try {
      await db.execAsync("ALTER TABLE targets ADD COLUMN stepTexts TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Per-step completion flags (JSON boolean array) for independently ticked steps
    try {
      await db.execAsync("ALTER TABLE targets ADD COLUMN stepsDone TEXT");
    } catch (e) {
      // Column already exists, ignore error safely
    }

    // Step sync mode: 1 = ticking a step completes every step before it, 0 = steps are independent
    try {
      await db.execAsync("ALTER TABLE targets ADD COLUMN syncSteps INTEGER NOT NULL DEFAULT 1");
    } catch (e) {
      // Column already exists, ignore error safely
    }


    // Create Notifications table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT,
        type TEXT NOT NULL, -- 'task' | 'routine' | 'system'
        timestamp TEXT NOT NULL,
        read INTEGER DEFAULT 0
      );
    `);

    console.log('[StagHaus DB] Tables initialized successfully.');
    return db;
  } catch (error) {
    console.error('[StagHaus DB] Failed to initialize SQLite database:', error);
    throw error;
  }
}

/**
 * Executes a write/update query (INSERT, UPDATE, DELETE).
 */
export async function runQuery(sql, params = []) {
  if (!db) await initDb();
  try {
    const result = await db.runAsync(sql, params);
    return result;
  } catch (error) {
    console.error(`[StagHaus DB] Error running write query: ${sql}`, error);
    throw error;
  }
}

/**
 * Executes a SELECT query and returns all matching rows.
 */
export async function selectAll(sql, params = []) {
  if (!db) await initDb();
  try {
    const rows = await db.getAllAsync(sql, params);
    return rows;
  } catch (error) {
    console.error(`[StagHaus DB] Error running select query: ${sql}`, error);
    throw error;
  }
}

/**
 * Runs the given async function inside a single transaction (rolled back if it throws).
 */
export async function withTransaction(task) {
  if (!db) await initDb();
  await db.withTransactionAsync(task);
}
