// Mini build: writes .xlsx with a fraction of the full library's size
import * as XLSX from 'xlsx/dist/xlsx.mini.min.js';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { selectAll } from './sqlite';
import { getLocalTodayStr, formatLocalDate } from '../utils/date';

// Expense dates are local ISO strings ('YYYY-MM-DDTHH:MM...') — split without timezone conversion
const datePart = (iso) => (iso ? String(iso).slice(0, 10) : '');
const timePart = (iso) => (iso && String(iso).length >= 16 ? String(iso).slice(11, 16) : '');

// "✓ Step one | ○ Step two" using per-step ticks (or the first N steps for older targets)
// Notes store UTC timestamps (toISOString) — convert to the local calendar day
const localDay = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d) ? formatLocalDate(d) : '';
};

const parseSteps = (target) => {
  try {
    const steps = target.stepTexts ? JSON.parse(target.stepTexts) : [];
    if (!Array.isArray(steps)) return '';
    let done = target.stepsDone ? JSON.parse(target.stepsDone) : null;
    if (!Array.isArray(done)) done = steps.map((_, i) => i < target.completedCount);
    return steps
      .map((text, i) => (text ? `${done[i] ? '✓' : '○'} ${text}` : ''))
      .filter(Boolean)
      .join(' | ');
  } catch (e) {
    return '';
  }
};

/**
 * Builds a sheet from rows of plain objects (keys become the header row) with sensible column widths.
 */
const makeSheet = (rows, headers) => {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet['!cols'] = headers.map((h) => {
    const longest = rows.reduce((max, r) => Math.max(max, String(r[h] ?? '').length), h.length);
    return { wch: Math.min(Math.max(longest + 2, 10), 60) };
  });
  if (rows.length > 0) {
    sheet['!autofilter'] = { ref: sheet['!ref'] };
  }
  return sheet;
};

/**
 * Exports every table to a multi-sheet .xlsx workbook and opens the share sheet.
 */
export async function exportToExcel() {
  const [tasks, routines, routineLogs, notes, expenses, targets, metrics] = await Promise.all([
    selectAll('SELECT * FROM tasks ORDER BY dueDate DESC, startTime'),
    selectAll('SELECT * FROM routine ORDER BY time'),
    selectAll(
      `SELECT l.logDate, l.status, r.title FROM routine_logs l
       LEFT JOIN routine r ON r.id = l.routineId ORDER BY l.logDate DESC`
    ),
    selectAll('SELECT * FROM notes ORDER BY updatedAt DESC'),
    selectAll('SELECT * FROM expenses ORDER BY date DESC'),
    selectAll('SELECT * FROM targets ORDER BY dueDate'),
    selectAll('SELECT * FROM progress_logs ORDER BY logDate DESC'),
  ]);

  const wb = XLSX.utils.book_new();

  // Summary
  const todayStr = getLocalTodayStr();
  const monthPrefix = todayStr.slice(0, 7);
  const totalSpent = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const monthSpent = expenses
    .filter((e) => datePart(e.date).startsWith(monthPrefix))
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const summaryRows = [
    { Item: 'Exported on', Value: new Date().toLocaleString() },
    { Item: 'Tasks', Value: tasks.length },
    { Item: 'Tasks completed', Value: tasks.filter((t) => t.status === 'completed').length },
    { Item: 'Tasks pending', Value: tasks.filter((t) => t.status === 'pending').length },
    { Item: 'Routines', Value: routines.length },
    { Item: 'Routine check-ins', Value: routineLogs.length },
    { Item: 'Notes', Value: notes.length },
    { Item: 'Expenses', Value: expenses.length },
    { Item: 'Total spent (all time)', Value: Math.round(totalSpent * 100) / 100 },
    { Item: 'Spent this month', Value: Math.round(monthSpent * 100) / 100 },
    { Item: 'Targets', Value: targets.length },
    { Item: 'Targets completed', Value: targets.filter((t) => t.completedCount >= t.totalCount).length },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(summaryRows, ['Item', 'Value']), 'Summary');

  const taskHeaders = ['Title', 'Description', 'Priority', 'Status', 'Due Date', 'Start', 'End', 'Completed On'];
  XLSX.utils.book_append_sheet(wb, makeSheet(tasks.map((t) => ({
    Title: t.title,
    Description: t.description || '',
    Priority: t.priority,
    Status: t.status,
    'Due Date': t.dueDate || '',
    Start: t.startTime || '',
    End: t.endTime || '',
    'Completed On': t.completedDate || '',
  })), taskHeaders), 'Tasks');

  const routineHeaders = ['Title', 'Details', 'Repeats', 'Start', 'End', 'Starting Date'];
  XLSX.utils.book_append_sheet(wb, makeSheet(routines.map((r) => ({
    Title: r.title,
    Details: r.details || '',
    Repeats: r.frequency,
    Start: r.time,
    End: r.endTime || '',
    'Starting Date': r.scheduledDate || '',
  })), routineHeaders), 'Routines');

  XLSX.utils.book_append_sheet(wb, makeSheet(routineLogs.map((l) => ({
    Date: l.logDate,
    Routine: l.title || '(deleted routine)',
    Status: l.status,
  })), ['Date', 'Routine', 'Status']), 'Routine Log');

  XLSX.utils.book_append_sheet(wb, makeSheet(notes.map((n) => ({
    Title: n.title,
    Category: n.category,
    Content: n.content || '',
    Created: localDay(n.createdAt),
    Updated: localDay(n.updatedAt),
  })), ['Title', 'Category', 'Content', 'Created', 'Updated']), 'Notes');

  XLSX.utils.book_append_sheet(wb, makeSheet(expenses.map((e) => ({
    Date: datePart(e.date),
    Time: timePart(e.date),
    Title: e.title,
    Category: e.category,
    Amount: Number(e.amount) || 0,
  })), ['Date', 'Time', 'Title', 'Category', 'Amount']), 'Expenses');

  XLSX.utils.book_append_sheet(wb, makeSheet(targets.map((t) => ({
    Title: t.title,
    Category: t.category,
    'Steps Done': t.completedCount,
    'Total Steps': t.totalCount,
    'Progress %': t.totalCount > 0 ? Math.floor((t.completedCount / t.totalCount) * 100) : 0,
    'Due Date': t.dueDate,
    Steps: parseSteps(t),
  })), ['Title', 'Category', 'Steps Done', 'Total Steps', 'Progress %', 'Due Date', 'Steps']), 'Targets');

  if (metrics.length > 0) {
    XLSX.utils.book_append_sheet(wb, makeSheet(metrics.map((m) => ({
      Date: datePart(m.logDate),
      Metric: m.metricName,
      Value: m.value,
      Notes: m.notes || '',
    })), ['Date', 'Metric', 'Value', 'Notes']), 'Metric Logs');
  }

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const file = new File(Paths.cache, `StagHaus-data-${todayStr}.xlsx`);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Export to Excel',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}
