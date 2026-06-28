# LifeOS Developer Project Overview

Welcome to the **LifeOS Developer Overview**! This document serves as a comprehensive developer handbook and system specification. It outlines the architectural patterns, database schemas, notification subsystems, state stores, navigation flows, and dependencies of the **LifeOS Suite**. Use this file as a handoff blueprint.

---

## 1. Project Overview

### Purpose of the Application
**LifeOS** is a premium, offline-first personal dashboard application built to consolidate task management, habits/routines tracking, financial logs, and goal monitoring into a single unified space.

### Main Problem It Solves
It eliminates cognitive fragmentation caused by context-switching between separate checklist, habit-tracking, budgeting, and journaling apps.

### Target Users
High-productivity professionals, students, and self-trackers who prefer a single, unified Command Center that functions offline with complete privacy.

### Core Features
*   **Command Center Dashboard**: Aggregates routines, tasks, weather, target progress, and financial stats.
*   **Checklist Manager**: Multi-priority task management with time bounds, category tagging, and automatic notification reminders.
*   **Daily Routine**: Chronological timeline supporting daily, weekly, and monthly recurrence with routine-end alarms.
*   **Notion-Style Notes**: Spacious borderless writing canvas with dynamic dropdown category tagging, custom category creation, and 12-color custom card styling.
*   **Progress Tracker**: Side-by-side transaction log (with SVG donut charts) and multi-step target milestone tracking.
*   **Automated Auto-Theme**: HSL-computed dynamic colors transitioning automatically between light/dark themes, with custom night mode activation from 11 PM to 4 AM.

---

## 2. Tech Stack

*   **Frameworks**: Expo SDK 54 / React Native 0.81.5 (New Architecture ready).
*   **Navigation**: Expo Router v6 (File-system based navigation).
*   **Database**: SQLite (`expo-sqlite` wrapper) with PRAGMA foreign keys enabled.
*   **Local Storage**: MMKV (`react-native-mmkv` wrapper).
*   **State Management**: Zustand v5 with MMKV persisted middleware.
*   **Form Management**: `react-hook-form` with Zod validation.
*   **Notifications**: `expo-notifications` (Local alerts with overnight calendar offsets).
*   **Charts**: Native SVG (`react-native-svg` path calculations).
*   **Animations**: Reanimated v4 (spring transitions & modal sheet entry).
*   **Development Tools**: Expo DevTools, Metro Bundler, SQLite database viewer.

---

## 3. Folder Structure

*   `app/`: File-system routing entry points for Expo Router.
    *   `app/(tabs)/`: Contains all main tab navigation views (Dashboard, Tasks/Routines, Notes, Progress, Settings).
    *   `app/_layout.js`: Root shell stack navigator that triggers the SQLite database initialization on app startup.
    *   `app/notifications.js`: Log and center of received reminders.
*   `src/`: Main source code directory.
    *   `src/core/`: Essential system infrastructure.
        *   `src/core/db/`: Persistence layers (MMKV and SQLite schema creation).
        *   `src/core/notifications/`: Local scheduling alerts and reminder routines.
        *   `src/core/store/`: Zustand global state store variables.
        *   `src/core/theme/`: HSL palette tokens, automatic light/dark night rules, and 12-color category map.
    *   `src/features/`: Feature validation schemas (Notes, Tasks, Expenses).
    *   `src/shared/`: Shared assets and design system components.
        *   `src/shared/components/`: Reusable UI elements (BottomSheet, TimePickerModal, Button, Input, ProgressRing, OnboardingStory).

---

## 4. Feature Breakdown

### Checklist & Routines Manager
*   **Purpose**: Track tasks and daily habits.
*   **Main Screens**: `app/(tabs)/tasks.js`
*   **Main Components**: `BottomSheet.js`, `TimePickerModal.js`.
*   **Database Tables**: `tasks`, `routine`, `routine_logs`.
*   **Notification Usage**: Start-time reminders and routine-end alarms.
*   **Current Limitations**: Routine scheduling is restricted to standard daily/weekly/monthly recurrence intervals.

### Notion-Style Notes
*   **Purpose**: Log journaling entries and notes with tag filtering.
*   **Main Screens**: `app/(tabs)/notes.js`
*   **Main Components**: Dropdown select menu, 12-color palette.
*   **Database Tables**: `notes`.
*   **Notification Usage**: None.
*   **Current Limitations**: Text editing is plain text (no markdown parsing or rich text editing yet).

### Progress & Expenses
*   **Purpose**: Side-by-side transaction log (with SVG donut charts) and targets progress.
*   **Main Screens**: `app/(tabs)/progress.js`
*   **Main Components**: SVG donut charts, progress bars.
*   **Database Tables**: `expenses`, `targets`.
*   **Notification Usage**: None.
*   **Current Limitations**: Expenses are local and manual (no bank syncing or CSV export).

---

## 5. Database Schema & Data Flow

### Tables
*   `tasks`: `id` (INTEGER PK), `title` (TEXT), `description` (TEXT), `priority` (TEXT), `status` (TEXT), `dueDate` (TEXT), `startTime` (TEXT), `endTime` (TEXT), `createdAt` (TEXT).
*   `notes`: `id` (INTEGER PK), `title` (TEXT), `content` (TEXT), `category` (TEXT), `color` (TEXT), `createdAt` (TEXT), `updatedAt` (TEXT).
*   `routine`: `id` (INTEGER PK), `title` (TEXT), `time` (TEXT), `details` (TEXT), `frequency` (TEXT), `status` (TEXT), `scheduledDate` (TEXT), `endTime` (TEXT), `updatedAt` (TEXT).
*   `routine_logs`: `id` (INTEGER PK), `routineId` (INTEGER FK), `logDate` (TEXT), `status` (TEXT).
*   `expenses`: `id` (INTEGER PK), `title` (TEXT), `amount` (REAL), `category` (TEXT), `date` (TEXT).
*   `targets`: `id` (INTEGER PK), `title` (TEXT), `category` (TEXT), `percentage` (INTEGER), `completedCount` (INTEGER), `totalCount` (INTEGER), `dueDate` (TEXT).
*   `notifications`: `id` (INTEGER PK), `title` (TEXT), `body` (TEXT), `type` (TEXT), `timestamp` (TEXT), `read` (INTEGER).

### Relationships
*   `routine_logs` belongs to `routine` via foreign key `routineId`. Enforces unique habit completions per calendar day via `UNIQUE(routineId, logDate)`.

### Data Flow
*   Write queries pass through `runQuery(sql, params)`.
*   Select queries pass through `selectAll(sql, params)`.
*   Zustand store triggers update increments (`tasksVersion`, `expensesVersion`, `notesVersion`) which reactively reload views.

---

## 6. Application Flow
1.  **Launch**: App starts -> `app/_layout.js` initializes SQLite schemas -> Checks notification permissions.
2.  **Dashboard**: User enters Command Center (`index.js`). Displays greet message, pending tasks count, target rings, and weather.
3.  **Task Management**: Users open Tasks tab. They toggle, edit, or delete checklist items.
4.  **Note Journaling**: Users open Notes tab. They click notes to edit titles/content or change custom color card categories.
5.  **Progress tracking**: Users log daily expenses or tick steps on target goals.

---

## 7. Navigation Flow
```
Root Stack
 └── (tabs) Navigator (Tab Bar)
      ├── index (Dashboard Command Center)
      ├── tasks (Checklist & Routine)
      ├── plus (Tab interceptor triggering Quick Add Note/Task sheet)
      ├── progress (Expenses & Targets Tracker)
      ├── notes (Notes Explorer)
      └── profile (Settings & Hero Avatar)
```

---

## 8. State Management
*   **Global State**: Managed by Zustand (`useStore`). Stored values are persisted via MMKV. Controls application theme Mode, notification settings toggles, active sheets, and user profiles.
*   **Local State**: Managed by React `useState` hooks inside individual views (e.g. search bars, active category filters, text editing states).

---

## 9. Notification Subsystem
*   **Architecture**: schedules local push notifications on Android/iOS using `expo-notifications`.
*   **Scheduling Logic**: On task/routine edit, the scheduler cancels previous triggers and registers new alarms for the task's start time and the routine's end time.
*   **Overnight Alarms**: If a routine's end time falls before its start time (crossing midnight), the scheduler offsets the target alarm time by `+1 day` to fire on the correct morning.

---

## 10. Dependency Analysis
*   `expo-router`: Navigation router. Essential.
*   `expo-sqlite`: SQLite local DB. Essential.
*   `react-native-mmkv`: Fast Zustand persistence. Essential.
*   `expo-notifications`: Alert scheduling. Essential.
*   `react-native-reanimated`: Fluid sheet animations. Essential.
*   `react-hook-form`: Form control. Essential.
*   `zod`: Field validators. Essential.
*   `react-native-svg`: Dashboard chart widgets. Essential.

---

## 11. Build Information
*   **Expo SDK**: 54
*   **React Native**: 0.81.5
*   **Native Modules**: Mmkv local storage binaries, SQLite db connectors, Notifications modules.
*   **Known Build Issues**: When testing in Expo Go clients, persistent SQLite file writes fallback to in-memory mocks. Run on an emulator or custom development client for persistent database storage.

---

## 12. Performance Notes
*   **Donut charts**: Handled via lightweight native SVG paths.
*   **Database Queries**: SQLite queries are index-optimized. Keep queries out of component rendering loops to avoid blocking the main JS thread.

---

## 13. Current Known Issues
*   In Expo Go client, remote push tokens are skipped as expected (logs a skip warning).
*   No rich text editing is supported in the notes canvas.
*   Currency symbols are locked to USD ($) in the expenses UI.

---

## 14. Future Roadmap
*   Add multi-currency configuration support in profile settings.
*   Support markdown rendering and export options for Notion notes.
*   Provide local backup import/export utilities for SQLite data backups.

---

## 15. Architecture Diagram
```
  [User Interface (React Native Views)]
       │                      │
       ▼                      ▼
 [Zustand Store]     [SQLite database] ◄───► [localNotifications]
       │                      ▲                     │
       ▼                      │                     ▼
 [MMKV Storage]      [sqlite.js queries]     [expo-notifications]
```

---

## 16. File Index
*   [app/_layout.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/_layout.js): App navigator shell & database init.
*   [app/notifications.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/notifications.js): Notification inbox center logs.
*   [app/(tabs)/_layout.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/_layout.js): Bottom tab navigator with Notion Quick Add forms.
*   [app/(tabs)/index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js): Command Center dashboard.
*   [app/(tabs)/notes.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/notes.js): Notion-style notes journal explorer.
*   [app/(tabs)/profile.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/profile.js): Superhero profiles, preferences, and avatars.
*   [app/(tabs)/progress.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/progress.js): Expenses list and targets milestones.
*   [app/(tabs)/tasks.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/tasks.js): Tasks list and routines timelines.
*   [src/core/theme/theme.js](file:///d:/ultrapremium%20homosepian/LifeOS/src/core/theme/theme.js): HSL color configuration & 12-color category mapping.
*   [src/shared/components/OnboardingStory.js](file:///d:/ultrapremium%20homosepian/LifeOS/src/shared/components/OnboardingStory.js): Storytelling auto-sliding visual carousel with overlay texts and expo-av ambient lofi audio.

---

## 17. Statistics
*   **Total Screens**: 8 views
*   **Total Components**: 11 components
*   **Total Services**: 7 modules
*   **Total Hooks**: 2 custom hooks
*   **Total Database Tables**: 8 tables
*   **Approximate Lines of Code**: ~8,000+ lines
*   **Total Dependencies**: 24 packages
