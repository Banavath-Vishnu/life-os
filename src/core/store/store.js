import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '../db/mmkv';

export const useStore = create(
  persist(
    (set, get) => ({
      // User Profile settings
      user: {
        name: '',
        avatar: null,
        bio: '',
        joinedAt: new Date().toISOString(),
        isProfileSetup: false,
      },
      updateUser: (newFields) =>
        set((state) => ({
          user: { ...state.user, ...newFields },
        })),

      // App Theme Configuration (MMKV persisted)
      themeMode: 'system', // 'system' | 'light' | 'dark'
      setThemeMode: (mode) => set({ themeMode: mode }),
      sunriseTime: '6:02 AM',
      sunsetTime: '7:24 PM',
      setSunriseTime: (time) => set({ sunriseTime: time }),
      setSunsetTime: (time) => set({ sunsetTime: time }),

      notificationSettings: {
        routineOffset: 5,     // minutes before: 0, 5, 15, 30, null (disabled)
        taskStartOffset: 5,   // minutes before: 0, 5, 15, 30, null (disabled)
        taskEndAtTime: true,  // boolean: notify at the end time of task
        taskEndOffset: 5,     // minutes before: 0, 5, 10, 15, null (disabled)
        routineEndAtTime: true, // boolean: notify at the end time of routine
      },
      updateNotificationSettings: (newSettings) =>
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...newSettings }
        })),

      // App stats and settings
      notificationsEnabled: true,
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      hapticsEnabled: true,
      toggleHaptics: () =>
        set((state) => ({ hapticsEnabled: !state.hapticsEnabled })),

      // Temporary Dashboard / Cache states (non-db backed transient variables)
      quickStats: {
        tasksCompletedToday: 0,
        notesCount: 0,
        averageProgressScore: 78,
      },
      setQuickStats: (stats) =>
        set((state) => ({
          quickStats: { ...state.quickStats, ...stats },
        })),

      // Database Change Triggers (for layout FAB -> tab screens synchronization)
      tasksVersion: 0,
      notesVersion: 0,
      progressVersion: 0,
      routineVersion: 0,
      expensesVersion: 0,
      targetsVersion: 0,
      triggerTasksUpdate: () => set((state) => ({ tasksVersion: state.tasksVersion + 1 })),
      triggerNotesUpdate: () => set((state) => ({ notesVersion: state.notesVersion + 1 })),
      triggerProgressUpdate: () => set((state) => ({ progressVersion: state.progressVersion + 1 })),
      triggerRoutineUpdate: () => set((state) => ({ routineVersion: state.routineVersion + 1 })),
      triggerExpensesUpdate: () => set((state) => ({ expensesVersion: state.expensesVersion + 1 })),
      triggerTargetsUpdate: () => set((state) => ({ targetsVersion: state.targetsVersion + 1 })),
      
      notificationsVersion: 0,
      triggerNotificationsUpdate: () => set((state) => ({ notificationsVersion: state.notificationsVersion + 1 })),

      // Active Bottom Sheet overlay state (shared globally)
      activeSheet: null,
      setActiveSheet: (sheet) => set({ activeSheet: sheet }),

      // Sub-tab Navigation routing state
      tasksSubTab: 'checklist',
      setTasksSubTab: (tab) => set({ tasksSubTab: tab }),
      progressSubTab: 'expenses',
      setProgressSubTab: (tab) => set({ progressSubTab: tab }),

      // User-created expense categories (persisted)
      customExpenseCategories: [],
      addExpenseCategory: (name) =>
        set((state) => ({ customExpenseCategories: [...state.customExpenseCategories, name] })),
      removeExpenseCategory: (name) =>
        set((state) => ({ customExpenseCategories: state.customExpenseCategories.filter((c) => c !== name) })),

      // Calendar prefill bridge
      prefilledDate: '',
      setPrefilledDate: (date) => set({ prefilledDate: date }),

      // Day currently viewed on the Tasks screen (used by the tab bar "+")
      tasksSelectedDate: '',
      setTasksSelectedDate: (date) => set({ tasksSelectedDate: date }),
    }),
    {
      name: 'lifeos-app-state',
      storage: createJSONStorage(() => zustandStorage),
      // Only persist specific keys (profile and preferences)
      partialize: (state) => ({
        user: state.user,
        themeMode: state.themeMode,
        notificationsEnabled: state.notificationsEnabled,
        hapticsEnabled: state.hapticsEnabled,
        sunriseTime: state.sunriseTime,
        sunsetTime: state.sunsetTime,
        notificationSettings: state.notificationSettings,
        customExpenseCategories: state.customExpenseCategories,
      }),
    }
  )
);
