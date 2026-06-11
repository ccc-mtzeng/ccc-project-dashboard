import { createContext, useContext } from "react";

/**
 * Central data context. App owns all fetching and persistence; views
 * consume this instead of threading the same props through every level.
 *
 * Shape (provided by App):
 * @typedef {Object} AppData
 * @property {string} username                GitHub login of the signed-in user
 * @property {import("../data/types").Solution[]} solutions       all solutions (incl. excluded)
 * @property {import("../data/types").Solution[]} activeSolutions solutions with excluded !== true
 * @property {import("../data/types").Activity[]} activities      engagement records
 * @property {import("../data/types").Entry[]} allEntries         flat time entries across all weeks
 * @property {boolean} entriesLoading
 * @property {Map<string, number>} actualsMap  solution_id -> actual hours
 *   (single shared memo — derive actuals from this, never recompute)
 * @property {() => Promise<void>} refreshEntries
 * @property {() => Promise<void>} refreshSolutions
 * @property {() => Promise<void>} refreshActivities
 * @property {(sol: Object) => Promise<void>} saveSolution        save one + refetch
 * @property {(sols: Object[]) => Promise<void>} batchSaveSolutions
 * @property {(activities: Object[]) => Promise<void>} saveActivities
 */

const AppDataContext = createContext(null);

export function AppDataProvider({ value, children }) {
  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

/**
 * @returns {AppData}
 */
export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within <AppDataProvider>");
  }
  return ctx;
}
