// ─── Solution workflow statuses ──────────────────────────────────────
// Mirrors the CCC delivery workflow. Keys are the workflow codes;
// 1.x = design phase, 2.x = build phase, then terminal/ongoing states.
// Color semantics: gray = not started, blue = active work,
// amber = waiting on a gate, green = approved/complete, red = hold,
// purple = internal.

export const STATUS_CONFIG = {
  "1.1": { label: "1.1. Pending Design",      color: "#888780", bg: "#F1EFE8" },
  "1.2": { label: "1.2. Waiting on Customer", color: "#BA7517", bg: "#FAEEDA" },
  "1.3": { label: "1.3. Design In Progress",  color: "#185FA5", bg: "#E6F1FB" },
  "1.4": { label: "1.4. Pending Review",      color: "#BA7517", bg: "#FAEEDA" },
  "1.5": { label: "1.5. Pending Approval",    color: "#BA7517", bg: "#FAEEDA" },
  "1.6": { label: "1.6. Approved",            color: "#1D9E75", bg: "#E1F5EE" },
  "2.1": { label: "2.1. In Progress",         color: "#185FA5", bg: "#E6F1FB" },
  "2.2": { label: "2.2. CCC UAT",             color: "#BA7517", bg: "#FAEEDA" },
  "2.3": { label: "2.3. Pending QC",          color: "#BA7517", bg: "#FAEEDA" },
  "2.4": { label: "2.4. Customer UAT",        color: "#BA7517", bg: "#FAEEDA" },
  "2.5": { label: "2.5. Pending Deployment",  color: "#BA7517", bg: "#FAEEDA" },
  "3":   { label: "3. Complete",              color: "#1D9E75", bg: "#E1F5EE" },
  "4":   { label: "4. Support",               color: "#0E8A8A", bg: "#E0F4F4" },
  "5":   { label: "5. Hold",                  color: "#E24B4A", bg: "#FCEBEB" },
  "6":   { label: "6. Canceled",              color: "#888780", bg: "#ECEAE4" },
  "7":   { label: "7. Internal",              color: "#7C5CBF", bg: "#F0EBFA" },
};

// Explicit display order. JS objects iterate integer-like keys ("3",
// "4"…) before string keys ("1.1"…), so never rely on Object.entries
// ordering for STATUS_CONFIG — map over this instead.
export const STATUS_ORDER = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6",
  "2.1", "2.2", "2.3", "2.4", "2.5",
  "3", "4", "5", "6", "7",
];

// Phase groups — used for list filtering so the filter bar stays
// compact instead of showing 16 pills.
export const STATUS_PHASES = {
  design:   { label: "Design",   match: (s) => s.startsWith("1.") },
  build:    { label: "Build",    match: (s) => s.startsWith("2.") },
  complete: { label: "Complete", match: (s) => s === "3" },
  support:  { label: "Support",  match: (s) => s === "4" },
  hold:     { label: "Hold",     match: (s) => s === "5" },
  canceled: { label: "Canceled", match: (s) => s === "6" },
  internal: { label: "Internal", match: (s) => s === "7" },
};

// Map legacy status keys (pre-workflow-codes) to the new codes.
// Applied at load time so existing solution files migrate as they save.
export const LEGACY_STATUS_MAP = {
  draft: "1.1",
  in_progress: "2.1",
  testing: "2.2",
  deployed: "3",
  on_hold: "5",
};

export function normalizeStatus(status) {
  if (status in STATUS_CONFIG) return status;
  if (status in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[status];
  return "1.1";
}

// Closed statuses fall off the active dashboard (deadlines, counts).
// Support, Hold, and Internal remain visible as ongoing work.
export function isClosedStatus(status) {
  return status === "3" || status === "6";
}

export function phaseOf(status) {
  for (const [key, phase] of Object.entries(STATUS_PHASES)) {
    if (phase.match(status)) return key;
  }
  return null;
}

export const TASK_STATUS = {
  not_started: { label: "Not started", color: "#888780", bg: "#F1EFE8" },
  in_progress: { label: "In progress", color: "#185FA5", bg: "#E6F1FB" },
  complete: { label: "Complete", color: "#1D9E75", bg: "#E1F5EE" },
};

export const CATEGORY_COLORS = {
  scoping: "#7F77DD",
  development: "#378ADD",
  testing: "#BA7517",
  training: "#1D9E75",
  deployment: "#D85A30",
};

export const NAV_ITEMS = [
  { id: "dashboard", icon: "ti-layout-dashboard", label: "Dashboard" },
  { id: "solutions", icon: "ti-folder", label: "Solutions" },
  { id: "engagements", icon: "ti-briefcase", label: "Engagements" },
  { id: "timeline", icon: "ti-calendar", label: "Timeline" },
  { id: "timesheet", icon: "ti-clock", label: "Time Entries" },
  { id: "upload", icon: "ti-file-upload", label: "Import" },
];
