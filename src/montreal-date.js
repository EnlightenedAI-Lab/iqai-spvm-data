/**
 * Montréal calendar dates in America/Toronto (no exact-hour filtering).
 */

/**
 * @param {Date} [now]
 */
export function montrealTodayYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/**
 * @param {string} ymd YYYY-MM-DD
 * @param {number} deltaDays
 */
export function addCalendarDaysYmd(ymd, deltaDays) {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

/**
 * Rolling 90-day window inclusive: today through today - 89 days.
 * @param {string} todayYmd
 */
export function rollingWindowBounds(todayYmd) {
  const windowEnd = todayYmd;
  const windowStart = addCalendarDaysYmd(todayYmd, -89);
  return {
    windowStart,
    windowEnd,
    windowDays: 90
  };
}

/**
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export function calendarDaysBetween(fromYmd, toYmd) {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

/**
 * @param {string} ymd
 */
export function isValidYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
