export const STATUS_CONFIG = {
  draft: { label: "Draft", color: "#888780", bg: "#F1EFE8" },
  in_progress: { label: "In progress", color: "#185FA5", bg: "#E6F1FB" },
  testing: { label: "Testing", color: "#BA7517", bg: "#FAEEDA" },
  deployed: { label: "Deployed", color: "#1D9E75", bg: "#E1F5EE" },
  on_hold: { label: "On hold", color: "#E24B4A", bg: "#FCEBEB" },
};

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
  { id: "timeline", icon: "ti-calendar", label: "Timeline" },
  { id: "timesheet", icon: "ti-clock", label: "Timesheet" },
  { id: "upload", icon: "ti-file-upload", label: "Import" },
];
