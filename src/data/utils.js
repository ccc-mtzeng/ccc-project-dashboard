export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(d) {
  if (!d) return "No date";
  const today = new Date().toISOString().slice(0, 10);
  const diff = daysBetween(today, d);
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return "Today";
  return `${diff}d`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Week helpers for Timesheet ───────────────────────────────────

/**
 * Get the ISO week key (e.g. "2026-W19") for a given date.
 */
export function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Get the 5 weekday ISO date strings (Mon–Fri) for a given ISO week key.
 */
export function weekDates(weekKey) {
  const [year, wStr] = weekKey.split("-W");
  const week = parseInt(wStr, 10);
  // Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(parseInt(year, 10), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/**
 * Offset a week key by N weeks. Negative = past, positive = future.
 */
export function offsetWeek(weekKey, n) {
  const dates = weekDates(weekKey);
  const mon = new Date(dates[0] + "T12:00:00");
  mon.setDate(mon.getDate() + n * 7);
  return isoWeekKey(mon.toISOString().split("T")[0]);
}

/**
 * Count business days between two ISO dates (inclusive).
 */
export function businessDaysBetween(start, end) {
  let count = 0;
  const d = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Generate a unique time entry ID.
 */
export function newEntryId() {
  return "te_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/**
 * Generate a unique note ID.
 */
export function newNoteId() {
  return "n_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/**
 * Human-readable relative time from an ISO datetime string.
 */
export function relativeTime(isoStr) {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.round(diffDay / 30);
  return `${diffMo}mo ago`;
}
