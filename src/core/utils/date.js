/**
 * Date utility helpers for local timezone-resilient date operations.
 * Bypasses UTC timezone shifting bugs caused by .toISOString() conversions.
 */

/**
 * Safely parses a local 'YYYY-MM-DD' date string into a local Date object.
 * Avoids UTC midnight timezone offsets.
 * @param {string} dateStr - The 'YYYY-MM-DD' formatted string
 * @returns {Date} - A local Date object representing midnight local time on that day
 */
export const getLocalDateObject = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Formats a Date object into a local 'YYYY-MM-DD' string.
 * @param {Date} dateObj - The Date object to format
 * @returns {string} - The 'YYYY-MM-DD' formatted string
 */
export const formatLocalDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets the current date in local 'YYYY-MM-DD' format.
 * @returns {string} - The current date 'YYYY-MM-DD'
 */
export const getLocalTodayStr = () => {
  return formatLocalDate(new Date());
};

/**
 * Gets the local YYYY-MM-DD string for the day before the specified date.
 * @param {string} dateStr - The 'YYYY-MM-DD' starting date
 * @returns {string} - The 'YYYY-MM-DD' day before
 */
export const getYesterdayStr = (dateStr) => {
  const d = getLocalDateObject(dateStr);
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
};

/**
 * Gets the local YYYY-MM-DD string for the day after the specified date.
 * @param {string} dateStr - The 'YYYY-MM-DD' starting date
 * @returns {string} - The 'YYYY-MM-DD' day after
 */
export const getNextDayStr = (dateStr) => {
  const d = getLocalDateObject(dateStr);
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
};

/**
 * Gets a local ISO-8601 string containing local date, time, and timezone offset.
 * Prevents string date splits from reading the wrong day in offset timezones.
 * @param {Date} dateObj - The Date object to format (defaults to now)
 * @returns {string} - The local ISO-8601 string
 */
export const getLocalISOString = (dateObj = new Date()) => {
  const tzOffset = -dateObj.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  const pad = (num) => String(num).padStart(2, '0');
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());
  const ms = String(dateObj.getMilliseconds()).padStart(3, '0');
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMins = pad(Math.abs(tzOffset) % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${diff}${tzHours}:${tzMins}`;
};

