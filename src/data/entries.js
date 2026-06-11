// ─── Time entry helpers ─────────────────────────────────────────────
//
// Single source of truth for entry visibility and actual hours.
// "Actual hours" for a solution = sum of visible (non-split-parent)
// time entries tagged to it. The legacy task.actual_hours field from
// solution design imports is deprecated for display purposes.

export function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * IDs of entries that have been split (i.e. have children).
 * Split parents are hidden everywhere; their children represent them.
 * @param {import("./types").Entry[]} allEntries
 * @returns {Set<string>}
 */
export function getSplitParentIds(allEntries) {
  const ids = new Set();
  for (const e of allEntries) {
    if (e.parent_id) ids.add(e.parent_id);
  }
  return ids;
}

/**
 * Entries that should be displayed and summed: everything except
 * split parents.
 * @param {import("./types").Entry[]} allEntries
 * @returns {import("./types").Entry[]}
 */
export function getVisibleEntries(allEntries) {
  const splitIds = getSplitParentIds(allEntries);
  return allEntries.filter((e) => !splitIds.has(e.id));
}

/**
 * Map of solution_id -> actual hours, from visible tagged entries.
 * @param {import("./types").Entry[]} allEntries
 * @returns {Map<string, number>}
 */
export function actualHoursBySolution(allEntries) {
  const map = new Map();
  for (const e of getVisibleEntries(allEntries)) {
    if (!e.solution_id) continue;
    map.set(e.solution_id, (map.get(e.solution_id) || 0) + (e.hours || 0));
  }
  for (const [k, v] of map) map.set(k, round1(v));
  return map;
}

/**
 * Actual hours for one solution.
 */
export function actualHoursForSolution(allEntries, solutionId) {
  return actualHoursBySolution(allEntries).get(solutionId) || 0;
}
