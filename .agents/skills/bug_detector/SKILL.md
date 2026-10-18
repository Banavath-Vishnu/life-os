---
name: bug-detector
description: Scans all JavaScript, JSON, and configurations in the repository to find bugs, database logic issues, and layout errors, producing bugs_found.md.
---

# Senior Bug Detector (25+ Years Experience Mindset)

Use this skill to perform deep codebase sweeps to identify not only syntax errors but also **semantic logic flaws**, **UI prioritization conflicts**, **timezone-shifting bugs**, and **silent data mismatches** that static linters miss.

## Expert Bug Hunting Focus Areas

### 1. UI State & Ternary Style Prioritization (Visual Overrides)
- **Style Priority Conflicts**: Search for ternary operators in React Native style arrays (e.g., `borderColor`, `backgroundColor`) where a generic state (like `isSelected` or `day.isToday`) is evaluated before a semantic task status (like `isCompleted` or `isMissed`). This causes the active selection style to completely mask status cues.
- **Lost Cues on Selection**: Check for conditional rendering (e.g., `!isSelected && <Badge />`) that hides status icons when an item is selected or active. Ensure users can see item status (completed/missed) even when selected.

### 2. Timezone Shifting & Date String Parser Bugs
- **UTC Date Shifting**: Flag any use of `new Date(dateString)` or `new Date('YYYY-MM-DD')` for extracting days, months, or weekdays. In negative timezone offsets (e.g. the Americas), parsing a date string without a time component shifts the local date to the previous day in UTC, causing routines/tasks to show up on the wrong day.
- **Proposed Solution**: Force local timezone-safe parsing helpers like `getLocalDateObject()` instead of native date constructors.
- **Date String Comparisons**: Ensure string comparisons of dates (e.g., checking `dueDate < todayStr` or `dateStr >= todayStr`) account for time offsets and suffixes (e.g. `T12:00:00` vs `Z`).

### 3. Database Operations & SQLite (expo-sqlite)
- **Mismatched Column Schemas**: Cross-reference table creation queries with inserts/updates.
- **Unparameterized Queries**: Ensure all queries containing user input or dynamic values use parameterized variables (`?`) instead of string interpolation.
- **Incorrect Date Boundary Queries**: Look for date filtering queries like `date >= todayStr` which mistakenly capture future logged/scheduled entries. Replace with prefix matching (`substr(date, 1, 10) = ?`) or exact matches.
- **Unhandled Promises**: Check that all query calls (`runQuery`, `selectAll`) are executed with `async/await` and wrapped in `try/catch` blocks.

### 4. State Management & Zustand
- **Immutable Updates**: Check that state updates (e.g. in stores) are immutable.
- **Sync Ticks**: Ensure database changes trigger Zustand store updates (e.g. incrementing a version store counter) so that screens reactively reload in sync.

### 5. Layout & View Nesting
- **Nested ScrollViews**: Check for vertical `ScrollView` elements nested inside other vertical scroll containers or `FlatList` components without appropriate scroll disabling.
- **Hardcoded Top Margins**: Scan for hardcoded margins (e.g., `marginTop: 40`) used for notch spacing, and replace them with dynamic safe area context.

## Output Format
Upon completion, compile a list of all identified bugs into `bugs_found.md` in the workspace root. Structure each entry as:
- **Title / Brief Description**
- **Impact / Severity** (High / Medium / Low)
- **File & Line Range**
- **Root Cause & Code snippet**
- **Proposed Fix**

---

## 6. Deep Cross-File Correlation & Patience
- **Patience is Key**: Do not rush codebase sweeps. Take the time to patiently read through related files (such as database initializers, Zustand stores, layout wrappers, and screen components) one by one.
- **Cross-File Tracing**: Trace data models and state parameters from their database schema creation, through query select/insert functions, into the Zustand store hooks, and finally to the UI view rendering in individual screens.
- **Correlate & Identify**: Cross-reference state updater functions (e.g. `toggleTaskStatus` in `tasks.js`) with their respective state reloader hooks in other views (e.g. `handleToggleRoutine` in `index.js`) to find silent synchronization gaps.

