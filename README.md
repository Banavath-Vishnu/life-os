# 🌌 LifeOS — The Premium Offline-First Personal Dashboard

[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000000?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native 0.81.5](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Zustand](https://img.shields.io/badge/Zustand-State-orange?style=for-the-badge)](https://github.com/pmndrs/zustand)
[![Offline First](https://img.shields.io/badge/Offline-First-success?style=for-the-badge)]()

**LifeOS** is a premium, offline-first personal dashboard application built to consolidate task management, daily routines, financial logging, and goal tracking into a single unified space. Built with Expo SDK 54, SQLite, MMKV, and Zustand, it provides complete local privacy, ultra-fast UI updates, and HSL-computed dynamic layouts.

---

## 🚀 Key Features

| Feature | Description | Technical Core |
| :--- | :--- | :--- |
| **Command Center Dashboard** | Aggregates routines, tasks, weather, target progress, and financial stats. | SVG widgets & HSL dynamic states |
| **Checklist Manager** | Multi-priority task management with time bounds and automatic notification triggers. | `react-hook-form` + `expo-notifications` |
| **Daily Routine** | Chronological timeline supporting daily, weekly, and monthly recurrence. | SQLite schema & calendar offsets |
| **Notion-Style Notes** | Spacious borderless writing canvas with custom category colors. | 12-color category map & dropdown menus |
| **Progress Tracker** | Expense transaction logs (with SVG donut charts) and milestone trackers. | `react-native-svg` path calculations |
| **Automated Auto-Theme** | Dynamic color schemes transitioning between light/dark/night based on active hours (11 PM - 4 AM). | HSL computed utility & Zustand store |

---

## 🛠️ Technology Stack

- **Framework**: Expo SDK 54 / React Native 0.81.5 (New Architecture ready)
- **Navigation**: Expo Router v6 (file-system based routing)
- **Database**: SQLite (`expo-sqlite` wrapper) with active foreign keys
- **Local Storage**: MMKV via `react-native-mmkv` for high-performance Zustand persistence
- **State Management**: Zustand v5 with MMKV persisted middleware
- **Forms & Validation**: `react-hook-form` + `zod`
- **Notifications**: `expo-notifications` (handles start-time alarms and calendar adjustments)
- **Animations**: Reanimated v4 for spring-loaded bottom sheets and modal transitions

---

## 📂 Project Architecture & Directory Structure

```
.
├── app/                        # File-system routing entry points (Expo Router)
│   ├── (tabs)/                 # Main tab navigation views
│   │   ├── index.js            # Dashboard (Command Center)
│   │   ├── tasks.js            # Tasks & Routines timeline
│   │   ├── plus.js             # Tab interceptor for Quick Add sheets
│   │   ├── progress.js         # Expenses & Goal targets
│   │   ├── notes.js            # Notes Explorer
│   │   └── profile.js          # Settings & User profile
│   ├── _layout.js              # Root Stack layout & database init
│   └── notifications.js        # Notification inbox log center
├── src/                        # Source Directory
│   ├── core/                   # Core application services
│   │   ├── db/                 # SQLite and MMKV initializers
│   │   ├── notifications/      # Local notification handlers
│   │   ├── store/              # Zustand global store configuration
│   │   └── theme/              # HSL theme engine & category palettes
│   ├── features/               # Validation schemas (tasks, notes, expenses)
│   └── shared/                 # Shared components & UI assets
│       └── components/         # Reusable views (BottomSheet, TimePicker, etc.)
```

---

## ⚙️ Setup & Installation

### Prerequisites
Make sure you have Node.js (v18+) and standard Expo requirements installed on your machine.

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Banavath-Vishnu/life-os.git
   cd life-os
   ```

2. **Install Dependencies**
   Run the following command in the root folder:
   ```bash
   npm install
   ```

3. **Start the Metro Bundler**
   ```bash
   npm run start
   ```

4. **Run on Target Platforms**
   - **Android Emulator**: Press `a` in terminal or run `npm run android`
   - **iOS Simulator**: Press `i` in terminal or run `npm run ios`
   - **Web Browser**: Press `w` in terminal or run `npm run web`

> [!IMPORTANT]
> **Database Persistence Note**:
> When running the application inside the **Expo Go** client, SQLite databases fallback to in-memory mocks. To ensure database updates persist permanently on device reboot or reload, compile and run the application inside an **Android/iOS Emulator** or build a **Custom Development Client**.

---

## 📊 Database Schema Details

The application features 8 custom tables managed via SQLite. Key schemas include:

- `tasks`: Keeps track of checklists, priority tags, status states, and alarm triggers.
- `routine` & `routine_logs`: Manages habit patterns and logs completions with a unique restriction (`UNIQUE(routineId, logDate)`) enforcing one log entry per habit per day.
- `notes`: Notion-style journals with category coloring and editing timestamps.
- `expenses` & `targets`: Coordinates financial logging and milestone trackers.

---

## 🗺️ Future Roadmap

- [ ] **Rich Text Support**: Implement markdown rendering inside the Notion-style canvas.
- [ ] **Multi-Currency Config**: Allow localized currency symbols in settings (currently locked to USD).
- [ ] **Data Portability**: Create local backup utility to import/export SQLite database file.
