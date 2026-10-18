# Codebase Bugs Found & Fixed

This document lists all identified logical, database, layout, and framework compatibility bugs found and resolved across the **LifeOS Suite** codebase.

---

## 1. [Fixed] Notification Trigger Configuration Error & Missing `repeats` Parameter
- **Severity**: High
- **File**: [localNotifications.js](file:///d:/ultrapremium%20homosepian/LifeOS/src/core/notifications/localNotifications.js) (lines 129, 326, 388, 465)
- **Root Cause**:
  In `localNotifications.js`, daily and weekly routine notifications scheduled parameters inside `trigger` (such as `type` and `channelId`) that are unsupported or placed incorrectly in `expo-notifications`, and were missing `repeats: true`.
- **Resolution**:
  Moved `channelId: 'default'` inside the `content` block and updated the trigger structures to use standard Expo 54 triggers with `repeats: true`.

---

## 2. [Fixed] NaN Calculation in Dashboard Routine Highlight
- **Severity**: Medium
- **File**: [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (lines 451-454)
- **Root Cause**:
  Overdue tasks with `time: 'MISSED'` and all-day tasks with `time: 'ALL DAY'` do not contain colons. Splitting these strings on `:` and casting to `Number` resulted in `NaN` values, breaking the chronological routine timeline sort.
- **Resolution**:
  Added checks to default non-timed or invalid time format values to `0` and verify parses using `isNaN`.

---

## 3. [Fixed] Missing `triggerRoutineUpdate()` Dispatch on Dashboard Routine Toggle
- **Severity**: Medium
- **File**: [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (lines 338-361)
- **Root Cause**:
  Completing/uncompleting a routine item on the dashboard updated the SQLite database but did not dispatch a Zustand store state version bump, causing the checklist screen's routine tab to fall out of sync.
- **Resolution**:
  Imported `triggerRoutineUpdate` from Zustand store and invoked it within `handleToggleRoutine`.

---

## 4. [Fixed] Hardcoded Layout Status-Bar & Notch Spacing (`marginTop: 40`)
- **Severity**: Medium
- **Files**:
  - [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js)
  - [notes.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/notes.js)
  - [tasks.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/tasks.js)
  - [profile.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/profile.js)
  - [notifications.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/notifications.js)
- **Root Cause**:
  Layout headers used static `marginTop: 40` positioning. Since Android/iOS edge-to-edge is enabled, this could overlap with different device notches or status bars.
- **Resolution**:
  Imported `useSafeAreaInsets` and applied dynamic top-margin spacing (`Math.max(12, insets.top)`) to all main headers and modal headers.

---

## 5. [Fixed] Rolled-Over and Expired Tasks Hidden from Home Screen Checklist
- **Severity**: High
- **File**: [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (line 209)
- **Root Cause**:
  The dashboard's task checklist (`todayTasksList`) filtered out tasks that are overdue by calling `!isTaskOverdueOnDate(t, todayStr)`. As a result, pending rolled-over tasks or expired today's tasks were hidden from the Home screen checklist and counts, and only showed up when marked completed.
- **Resolution**:
  Modified `todayTasksList` to include all active tasks on the current day without filtering out overdue tasks:
  ```javascript
  const todayTasksList = allTasks.filter(t => isTaskActiveOnDate(t, todayStr));
  ```

---

## 6. [Fixed] Completed Tasks Vanish from Past Days When Toggled on Daily Routine Timeline/Checklist
- **Severity**: Medium
- **File**: [tasks.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/tasks.js) (line 383)
- **Root Cause**:
  In `toggleTaskStatus`, when a task was completed, its `completedDate` was always set to `todayStr` (the current calendar date). Because of this, if a user viewed a past date on the calendar (e.g. yesterday) and checked off a task, the task's `completedDate` was set to today's date, causing it to immediately vanish from yesterday's timeline and checklist.
- **Resolution**:
  Changed `toggleTaskStatus` in `tasks.js` to set `completedDate` to the currently viewed date (`selectedChecklistDate`) instead of `todayStr`:
  ```javascript
  const completedDate = nextStatus === 'completed' ? selectedChecklistDate : null;
  ```

---

## 7. [Fixed] Currency Mismatch (Rupee ₹ on Progress Screen vs. Dollar $ on Home Dashboard & Form Labels)
- **Severity**: Low
- **Files**:
  - [progress.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/progress.js) (lines 486, 540, 580, 628, 827, 1219, 1380, 1470)
  - [_layout.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/_layout.js) (line 1080)
  - [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (line 975)
- **Root Cause**:
  The form labels in `_layout.js` used `"Amount ($)"` and the dashboard in `index.js` rendered `$` for totals. However, `progress.js` rendered `-₹{e.amount.toFixed(2)}` (and chart axes, slices) using the Indian Rupee symbol `₹`, creating a visual inconsistency.
- **Resolution**:
  Aligned all currency symbols in the application to use the Dollar (`$`) symbol.

---

## 8. [Fixed] Future Logged Expenses Included in "Today's Spent" Calculations
- **Severity**: Medium
- **File**: [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (line 303)
- **Root Cause**:
  The database query for today's dashboard expenses used `date >= todayStr`. If a user scheduled/logged a future expense (e.g. for tomorrow), it got included in the dashboard's "Expenses Today" card and category breakdown because tomorrow's date is `>= todayStr`.
- **Resolution**:
  Changed the SQLite query to filter for the exact date matching today's date prefix:
  ```javascript
  const allExpenses = await selectAll('SELECT * FROM expenses WHERE substr(date, 1, 10) = ?', [todayStr]);
  ```

---

## 9. [Fixed] Timezone Offset Shift in Weekly & Monthly Routines Checker
- **Severity**: High
- **Files**:
  - [tasks.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/tasks.js) (lines 80-107)
  - [index.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/index.js) (lines 145-170)
- **Root Cause**:
  `isSameMonthlyDay` and `isRoutineActiveOnDate` used `new Date(dateString)` to determine weekdays and monthly dates. Because `new Date('YYYY-MM-DD')` parses as UTC midnight, users in negative timezone offsets (like the Americas) got shifted dates (e.g. Monday parsed as Sunday). This made weekly/monthly routines display on the wrong day.
- **Resolution**:
  Imported and used `getLocalDateObject` from `src/core/utils/date.js` instead of `new Date(...)` in both files.

---

## 10. [Fixed] Completed Days Calendar Borders Inactive/Overridden (tasks.js)
- **Severity**: High
- **File**: [tasks.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/tasks.js) (lines 1154-1198)
- **Root Cause**:
  1. Completed days highlight `isCompleted && isPast` was constrained only to past days (`isPast`). If the user completed all tasks for **today**, the border did not turn green (remaining default blue).
  2. The `day.isToday` and `isSelected` border conditions took precedence over `isCompleted` and `isMissed`, and the checkmark badges in the corner were hidden when `isSelected` was true (`!isSelected`). Consequently, a selected day (which is the one the user is actively completing tasks on) or today never visually showed the green completed border or checkmark badge.
- **Resolution**:
  1. Removed the `isPast` constraint from `isCompleted` styling so completed days turn green immediately.
  2. Prioritized `isCompleted` over `day.isToday` in border/background colors.
  3. Removed the `!isSelected` restriction on the corner status badges so checkmark/cross badges render on top of the selected blue highlights.

---

## 11. [Fixed] Notification Settings Reset On App Restart (stale MMKV partialize schema in store.js)
- **Severity**: Medium
- **File**: [store.js](file:///d:/ultrapremium%20homosepian/LifeOS/src/core/store/store.js) (line 92)
- **Root Cause**:
  The Zustand persistence middleware uses a `partialize` filter to specify which state properties are saved to MMKV storage. It omitted `notificationSettings`, meaning any custom alert offsets (e.g. changing task offset to 15 minutes in the Profile screen) were lost and reset to defaults when the app restarted.
- **Resolution**:
  Added `notificationSettings` to the `partialize` filter in `store.js`:
  ```javascript
      partialize: (state) => ({
        user: state.user,
        themeMode: state.themeMode,
        notificationsEnabled: state.notificationsEnabled,
        sunriseTime: state.sunriseTime,
        sunsetTime: state.sunsetTime,
        notificationSettings: state.notificationSettings,
      }),
  ```

---

## 12. [Fixed] Timezone Shift in Daily Expenses Trends & Period Boundaries
- **Severity**: Medium
- **File**: [progress.js](file:///d:/ultrapremium%20homosepian/LifeOS/app/(tabs)/progress.js) (lines 267-272, 289-303)
- **Root Cause**:
  `currentTotal`, `prevTotal` and `getPeriodStart` filtered/queried expenses using `.toISOString()`. The `.toISOString()` call converts local date boundaries to UTC. String comparison of local ISO strings with UTC ISO strings shifted expenses logged in the late evening (e.g. after 6:30 PM in India) to the next day's calculations, distorting trend statistics and daily filters.
- **Resolution**:
  Imported `getLocalISOString` in `progress.js` and replaced `.toISOString()` calls with `getLocalISOString(date)` for trend calculations and period start boundaries.


---

## Second Pass (2026-10-17)

| # | Severity | Bug | Fix |
|---|---|---|---|
| 13 | High | Weekly/monthly routines saved with `scheduledDate = null`, so they showed every day and never got alerts | `_layout.js` saves an anchor date for every frequency; `tasks.js`/`index.js` fall back to `updatedAt` for old rows |
| 14 | High | Android `channelId` was in `content`, which expo-notifications 0.32 ignores (regression from #1), so alerts used the fallback channel | `channelId: 'default'` moved into every `trigger` |
| 15 | High | Pending tasks due 2+ days ago were never counted as overdue/missed | Overdue = any day after the due date |
| 16 | High | Overnight tasks marked MISSED at midnight while still running | Exception while the end time has not passed |
| 17 | High | Completing a task from Home didn't cancel its alerts | Home toggles now call `scheduleTaskNotifications` |
| 18 | High | "Reset App Data" left alerts for deleted items scheduled; rescheduler never cleared orphans | Cancel all on reset; rescheduler cancels all first and aborts stale runs |
| 19 | High | Future-dated expenses counted in Progress Day/Week/Month totals | Upper bound of today on period filters and trend |
| 20 | Medium | Month chart counted 5-day boundary days twice; week/month totals used a different window than the charts | Non-overlapping buckets; windows start at local midnight (today − 6 / − 29) |
| 21 | Medium | Weekly/monthly routine alerts parsed `scheduledDate` as UTC | `getLocalDateObject` |
| 22 | Medium | Home expense donut passed `"--15"` as `strokeDashoffset` | Numeric offsets |
| 23 | Medium | Every checkbox toggle on Tasks showed a spinner and reset scroll | Spinner only on first load |
| 24 | Medium | Routine card showed "Next Day" end time for overdue/all-day tasks | Compare `endTime` to `startTime` |
| 25 | Medium | Date strip highlight went stale after Calendar Explorer navigation | Highlight derived from `selectedChecklistDate` |
| 26 | Medium | `prefilledDate` from the calendar leaked into later FAB task/routine creation | Cleared after create / on close |
| 27 | Medium | Tasks with only an end time got no end alerts | Start alert guarded separately |
| 28 | Medium | Push-token fetch blocked the splash screen on slow networks | Not awaited; runs after `setDbReady` |
| 29 | Medium | Category filter survived a period change while the chart highlight reset | Reset together |
| 30 | Low | Notifications logged twice (received + tapped) | De-dupe by identifier + date |
| 31 | Low | Weekly pre-start alert crossing midnight fired on the wrong weekday | Shift to previous weekday |
| 32 | Low | Missed tab saved `completedDate` as the selected strip day | Uses today on the Missed tab |
| 33 | Low | "NOW" badge defaulted to the first routine / a task item | No default; tasks excluded |
| 34 | Low | Target progress accepted negatives; 199/200 rounded to 100% "Completed" | Integer/non-negative validation; `Math.floor` |
| 35 | Low | Zod 4 ignored `invalid_type_error` / `errorMap` custom messages | v4 `error` option |
| 36 | Low | Progress focus listener used a stale `todayStr` after midnight | Recomputed on focus |
| 37 | Low | Deprecated `shouldShowAlert` handler key | `shouldShowBanner` / `shouldShowList` |
| 38 | Low | Onboarding audio kept playing if the story closed while loading | Cancelled flag unloads late sound |

---

## Third Pass (2026-10-17)

| # | Severity | Bug | Fix |
|---|---|---|---|
| 39 | High | Typing a new "Total Target Steps" (e.g. 10 → "1" → 12) permanently erased step names/ticks 2–10 | Arrays only grow while typing; trimmed to the total on Save |
| 40 | Medium | Changing a routine's repeat type kept its old anchor date, so switching to "Once" made it vanish with no alerts | Frequency change re-anchors to the viewed day |
| 41 | Medium | Pending tasks showed as MISSED on future days | Overdue rule returns false for days after today |
| 42 | Medium | Task editor saved any typed due date (e.g. `2026-10-5`), breaking ordering and alerts | Strict real-date `YYYY-MM-DD` validation |
| 43 | Medium | Turning step Sync off could leave Completed > Total, so Save always failed | Count clamped and kept in step with ticks |
| 44 | Medium | A notification error after restore/demo seed showed "failed" and skipped screen refresh (retry duplicated demo rows) | Screens refresh first; each alert scheduled best-effort |
| 45 | Medium | `prefilledDate` leaked from the calendar expense sheet into later expenses/tasks/routines | Cleared on expense close and on Progress/Quick Add "+" |
| 46 | Medium (iOS) | Time picker couldn't open over a bottom sheet or edit modal | Picker rendered inside the sheet/modal that uses it |
| 47 | Low | Past days marked red in the date strip showed "All Caught Up" | Past day lists its own pending tasks under "Missed on This Day" |
| 48 | Low | Countdown label ("Active Now…") shown on overdue / rolled-over tasks | Only for tasks due (or overnight-running) that day |
| 49 | Low | "NOW" badge shown when viewing other days | Only on today |
| 50 | Low | Leftover Missed filter changed completion date of tasks ticked on the Routine tab | Missed rule only on the Checklist tab |
| 51 | Low | Tasks/Home stayed on yesterday after midnight; "+" refused as a past date | Refresh and roll forward when the app becomes active |
| 52 | Low | Routine tab flashed "Schedule Empty" / previous day's items | Spinner until that day's routines are loaded |
| 53 | Low | Demo "Pay Rent" dates overflowed at month-end | Day clamped to month length |
| 54 | Low | Excel note Created/Updated dates used the UTC day | Converted to local day |
| 55 | Low | Backup file with `"tables": null` made Restore silently do nothing | Validation rejects it |
| 56 | Low | Home banner said "pending tasks from past days" while also counting today's expired ones | Reworded to "missed tasks need attention" |

> Note on #7: the app now consistently uses ₹ everywhere (forms, alerts, charts); the earlier switch to `$` was reverted.
