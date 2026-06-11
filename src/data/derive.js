import { round1 } from "./entries";

// ─── Planning derivations for the dashboard ─────────────────────────
//
// Forecast model: a solution's remaining hours are spread evenly across
// the weeks between now and its go-live week (inclusive). A solution
// with 20h remaining due at the end of next week contributes 10h to
// this week and 10h to next week. Overdue or due-this-week solutions
// land entirely in the current week.

/**
 * Statuses where the ball is in the customer's court — urgency is
 * theirs, not ours: Waiting on Customer, Pending Approval, Customer UAT.
 */
export const ON_CUSTOMER_STATUSES = ["1.2", "1.5", "2.4"];

/**
 * Customer authority: the linked engagement's customer (Kantata billing
 * truth) wins; the solution's own customer string is display fallback.
 * @param {import("./types").Solution} solution
 * @param {import("./types").Activity[]} activities
 */
export function customerOf(solution, activities) {
  const act = activities.find((a) => a.id === solution.activity_id);
  return act?.customer || solution.customer;
}

/** Linked engagement record for a solution, or null. */
export function engagementOf(solution, activities) {
  return activities.find((a) => a.id === solution.activity_id) || null;
}

/**
 * Estimated hours remaining, from live task progress (manually updated,
 * so it doesn't lag the way imported actuals do):
 *   Σ task.estimated_hours × (1 − percent_complete/100)
 * Falls back to total_hours scaled by average task completion when the
 * tasks carry no hour estimates.
 * @param {import("./types").Solution} solution
 */
export function remainingHours(solution) {
  const tasks = solution.tasks || [];
  const totalEst = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
  if (totalEst > 0) {
    return round1(
      tasks.reduce(
        (s, t) => s + (t.estimated_hours || 0) * (1 - (t.percent_complete || 0) / 100),
        0
      )
    );
  }
  const avgPct = tasks.length
    ? tasks.reduce((s, t) => s + (t.percent_complete || 0), 0) / tasks.length
    : 0;
  return round1((solution.total_hours || 0) * (1 - avgPct / 100));
}

/** Monday (UTC ms) of the week containing an ISO date. */
function mondayMs(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Week index of a date relative to today: 0 = this week, 1 = next week.
 * Past dates clamp to 0 (overdue work belongs to this week).
 */
export function weekIndexOf(dateStr, todayStr) {
  const diff = Math.round((mondayMs(dateStr) - mondayMs(todayStr)) / (7 * 86400000));
  return Math.max(0, diff);
}

/** Short label for a forecast week: "This week", "Next week", "Jun 22". */
export function weekLabel(index, todayStr) {
  if (index === 0) return "This week";
  if (index === 1) return "Next week";
  const mon = new Date(mondayMs(todayStr) + index * 7 * 86400000);
  return mon.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Build the weekly workload forecast.
 *
 * On-hold solutions are excluded from allocation (paused). Solutions
 * without a go-live date pool into `unscheduledHours`.
 *
 * @param {import("./types").Solution[]} solutions  open (not closed) solutions
 * @param {string} todayStr ISO date
 * @returns {{
 *   weekHours: number[],
 *   unscheduledHours: number,
 *   totalRemaining: number,
 *   perSolution: Map<string, {remaining: number, thisWeek: number, weekIndex: number|null}>
 * }}
 */
export function buildForecast(solutions, todayStr) {
  const weekHours = [];
  const perSolution = new Map();
  let unscheduledHours = 0;
  let totalRemaining = 0;

  for (const s of solutions) {
    const remaining = remainingHours(s);
    totalRemaining += remaining;

    if (s.status === "5" || remaining <= 0) {
      perSolution.set(s.id, {
        remaining,
        thisWeek: 0,
        weekIndex: s.go_live_date ? weekIndexOf(s.go_live_date, todayStr) : null,
      });
      continue;
    }

    if (!s.go_live_date) {
      unscheduledHours += remaining;
      perSolution.set(s.id, { remaining, thisWeek: 0, weekIndex: null });
      continue;
    }

    const w = weekIndexOf(s.go_live_date, todayStr);
    const perWeek = remaining / (w + 1);
    for (let i = 0; i <= w; i++) {
      weekHours[i] = (weekHours[i] || 0) + perWeek;
    }
    perSolution.set(s.id, { remaining, thisWeek: round1(perWeek), weekIndex: w });
  }

  return {
    weekHours: weekHours.map(round1),
    unscheduledHours: round1(unscheduledHours),
    totalRemaining: round1(totalRemaining),
    perSolution,
  };
}

/**
 * Urgency for a solution row, from this week's load and who owns the
 * next move. Returns { color, bg, label }.
 *
 * Tiers: on hold (gray) → on customer (blue) → overdue (red) →
 * by this-week hours: >12h red, 5–12h amber, <5h green.
 */
export function urgencyOf(solution, info, todayStr) {
  if (solution.status === "5") {
    return { color: "#888780", bg: "#F1EFE8", label: "On hold" };
  }
  if (ON_CUSTOMER_STATUSES.includes(solution.status)) {
    return { color: "#185FA5", bg: "#E6F1FB", label: "On customer" };
  }
  const overdue =
    solution.go_live_date && solution.go_live_date < todayStr && info.remaining > 0.5;
  if (overdue) {
    return { color: "#E24B4A", bg: "#FCEBEB", label: "Overdue" };
  }
  if (info.remaining <= 0.5) {
    return { color: "#1D9E75", bg: "#E1F5EE", label: "Wrapped up" };
  }
  if (info.thisWeek > 12) {
    return { color: "#E24B4A", bg: "#FCEBEB", label: `${info.thisWeek}h this week` };
  }
  if (info.thisWeek >= 5) {
    return { color: "#BA7517", bg: "#FAEEDA", label: `${info.thisWeek}h this week` };
  }
  return {
    color: "#1D9E75",
    bg: "#E1F5EE",
    label: info.thisWeek > 0 ? `${info.thisWeek}h this week` : "Unscheduled",
  };
}
