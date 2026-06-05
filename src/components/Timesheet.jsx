import { useState, useEffect, useMemo } from "react";
import StatCard from "./shared/StatCard";
import { CATEGORY_COLORS } from "../data/constants";
import {
  todayISO,
  isoWeekKey,
  weekDates,
  offsetWeek,
  businessDaysBetween,
  newEntryId,
  formatDate,
} from "../data/utils";

// ── Styles ──────────────────────────────────────────────────────────

const cardBorder = {
  border: "0.5px solid var(--border-light)",
  borderRadius: "var(--radius-lg)",
};

const sectionTitle = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text-primary)",
  marginBottom: 12,
};

const pillBtn = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: "1px solid var(--border-light)",
  fontWeight: 450,
  fontFamily: "inherit",
  transition: "all 0.15s",
  background: "transparent",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const inputStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  width: "100%",
  boxSizing: "border-box",
};

const ACTIVITY_PALETTE = [
  "#7F77DD", "#378ADD", "#1D9E75", "#BA7517", "#D85A30",
  "#E24B4A", "#888780", "#5B8C5A", "#9B59B6", "#2980B9",
];

function activityColor(activities, actId) {
  const idx = activities.findIndex((a) => a.id === actId);
  return idx >= 0 ? ACTIVITY_PALETTE[idx % ACTIVITY_PALETTE.length] : "#888";
}

// ── Day formatting helpers ──────────────────────────────────────────

function fmtDay(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function fmtShortDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ═════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════

export default function Timesheet({
  activities,
  timesheet,
  timesheetSha,
  solutions,
  onSave,
  onSaveActivities,
  onWeekChange,
  currentWeek,
  loading,
}) {
  const [entries, setEntries] = useState(timesheet?.entries || []);
  const [addingTo, setAddingTo] = useState(null); // date string or "burn"
  const [copiedId, setCopiedId] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [subView, setSubView] = useState("week"); // "week" | "activities"
  const [saving, setSaving] = useState(false);

  // Reset entries when timesheet prop changes (week navigation)
  useEffect(() => {
    setEntries(timesheet?.entries || []);
    setAddingTo(null);
  }, [timesheet]);

  const today = todayISO();
  const dates = weekDates(currentWeek);
  const isThisWeek = isoWeekKey(today) === currentWeek;

  // Dirty detection
  const isDirty = useMemo(
    () => JSON.stringify(entries) !== JSON.stringify(timesheet?.entries || []),
    [entries, timesheet]
  );

  // ── Entry helpers ─────────────────────────────────────────────────

  const burns = entries.filter((e) => e.end_date);
  const points = entries.filter((e) => !e.end_date);
  const entriesForDay = (date) => points.filter((e) => e.date === date);
  const burnSpansDate = (burn, date) => date >= burn.date && date <= burn.end_date;

  function burnVisibleDays(burn) {
    return dates.filter((d) => burnSpansDate(burn, d)).length;
  }

  function burnTotalDays(burn) {
    return businessDaysBetween(burn.date, burn.end_date);
  }

  function burnDailyHours(burn) {
    const days = Math.max(1, burnTotalDays(burn));
    return burn.hours / days;
  }

  function dayTotal(date) {
    let h = 0;
    entriesForDay(date).forEach((e) => (h += e.hours));
    burns.forEach((b) => {
      if (burnSpansDate(b, date)) h += burnDailyHours(b);
    });
    return h;
  }

  // Stats
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const submittedHours = entries
    .filter((e) => e.submitted)
    .reduce((s, e) => s + e.hours, 0);
  const pendingHours = totalHours - submittedHours;
  const pendingCount = entries.filter((e) => !e.submitted).length;
  const customers = [
    ...new Set(
      entries
        .map((e) => activities.find((a) => a.id === e.activity_id)?.customer)
        .filter(Boolean)
    ),
  ];

  // ── Mutations ─────────────────────────────────────────────────────

  function addEntry(entry) {
    setEntries((prev) => [...prev, entry]);
    setAddingTo(null);
  }

  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleSubmitted(id) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, submitted: !e.submitted } : e))
    );
  }

  function updateEntry(id, updates) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }

  function copyEntry(entry) {
    const act = activities.find((a) => a.id === entry.activity_id);
    const parts = [act?.code || act?.label || "", entry.hours + "h", entry.notes];
    navigator.clipboard?.writeText(parts.filter(Boolean).join(" | "));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function copyDayEntries(date) {
    const dayEnts = entriesForDay(date).filter((e) => !e.submitted);
    // Also include burn allocations for this day
    const burnEnts = burns
      .filter((b) => burnSpansDate(b, date) && !b.submitted)
      .map((b) => ({
        ...b,
        hours: +burnDailyHours(b).toFixed(2),
        _isBurn: true,
      }));
    const all = [...burnEnts, ...dayEnts];
    const lines = all.map((e) => {
      const act = activities.find((a) => a.id === e.activity_id);
      return [act?.code || act?.label || "", e.hours, e.notes, act?.default_task || ""].join("\t");
    });
    navigator.clipboard?.writeText("Activity\tHours\tNotes\tTask\n" + lines.join("\n"));
    setCopiedId("day_" + date);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(currentWeek, { week: currentWeek, entries }, timesheetSha);
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setEntries(timesheet?.entries || []);
  }

  // ── Activity sub-view ─────────────────────────────────────────────

  if (subView === "activities") {
    return (
      <ActivityManager
        activities={activities}
        onSave={onSaveActivities}
        onBack={() => setSubView("week")}
      />
    );
  }

  // ── Main weekly view ──────────────────────────────────────────────

  return (
    <div>
      {/* Week header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => onWeekChange(offsetWeek(currentWeek, -1))}
            style={{
              ...pillBtn,
              padding: "4px 8px",
              color: "var(--text-secondary)",
            }}
          >
            <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
          </button>
          <div>
            <span style={{ fontSize: 18, fontWeight: 500 }}>
              {fmtShortDate(dates[0])} — {fmtShortDate(dates[4])}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                marginLeft: 8,
              }}
            >
              {currentWeek}
            </span>
          </div>
          <button
            onClick={() => onWeekChange(offsetWeek(currentWeek, 1))}
            style={{
              ...pillBtn,
              padding: "4px 8px",
              color: "var(--text-secondary)",
            }}
          >
            <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
          </button>
          {!isThisWeek && (
            <button
              onClick={() => onWeekChange(isoWeekKey(today))}
              style={{
                ...pillBtn,
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              This week
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setPendingOnly(!pendingOnly)}
            style={{
              ...pillBtn,
              background: pendingOnly ? "#E24B4A" : "transparent",
              color: pendingOnly ? "#fff" : "var(--text-secondary)",
              borderColor: pendingOnly ? "#E24B4A" : undefined,
            }}
          >
            <i className="ti ti-filter" style={{ fontSize: 13 }} />
            {pendingOnly ? "Pending only" : "All entries"}
          </button>
          <button
            onClick={() => setSubView("activities")}
            style={{ ...pillBtn, color: "var(--text-secondary)" }}
          >
            <i className="ti ti-settings" style={{ fontSize: 13 }} />
            Activities
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              border: "2px solid var(--border-light)",
              borderTopColor: "var(--text-primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              verticalAlign: -3,
              marginRight: 8,
            }}
          />
          Loading timesheet…
        </div>
      )}

      {/* Stat cards */}
      {!loading && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatCard
              icon="clock"
              label="Total hours"
              value={totalHours.toFixed(1)}
              sub={`${entries.length} entries`}
            />
            <StatCard
              icon="circle-check"
              label="Submitted"
              value={submittedHours.toFixed(1)}
              valueColor="#1D9E75"
              sub={`${entries.filter((e) => e.submitted).length} entries`}
            />
            <StatCard
              icon="alert-circle"
              label="Pending"
              value={pendingHours.toFixed(1)}
              valueColor={pendingHours > 0 ? "#E24B4A" : undefined}
              sub={`${pendingCount} to enter`}
            />
            <StatCard
              icon="users"
              label="Customers"
              value={customers.length}
              sub={customers.join(", ") || "—"}
            />
          </div>

          {/* ── Burn blocks ── */}
          {burns.length > 0 && (
            <div style={{ ...cardBorder, padding: 16, marginBottom: 14 }}>
              <div
                style={{
                  ...sectionTitle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <i
                    className="ti ti-flame"
                    style={{ fontSize: 14, marginRight: 6, verticalAlign: -1 }}
                  />
                  Controlled Burns
                </span>
                <button
                  onClick={() =>
                    setAddingTo(addingTo === "burn" ? null : "burn")
                  }
                  style={{
                    ...pillBtn,
                    fontSize: 11,
                    padding: "3px 8px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 12 }} />
                  Add burn
                </button>
              </div>

              {burns
                .filter((b) => !pendingOnly || !b.submitted)
                .map((burn) => {
                  const act = activities.find(
                    (a) => a.id === burn.activity_id
                  );
                  const color = activityColor(activities, burn.activity_id);
                  const startIdx = Math.max(
                    0,
                    dates.indexOf(
                      dates.find((d) => d >= burn.date) || dates[0]
                    )
                  );
                  const endIdx = Math.min(
                    4,
                    dates.indexOf(
                      [...dates].reverse().find((d) => d <= burn.end_date) ||
                        dates[4]
                    )
                  );
                  const span = endIdx - startIdx + 1;

                  return (
                    <div key={burn.id} style={{ marginBottom: 14 }}>
                      {/* Burn bar */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(5, 1fr)",
                          gap: 4,
                        }}
                      >
                        {startIdx > 0 && (
                          <div
                            style={{
                              gridColumn: `1 / ${startIdx + 1}`,
                            }}
                          />
                        )}
                        <div
                          style={{
                            gridColumn: `${startIdx + 1} / ${startIdx + span + 1}`,
                            background: color + "14",
                            border: `1px solid ${color}35`,
                            borderRadius: 8,
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                              }}
                            >
                              {act?.label || burn.activity_id}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-secondary)",
                                marginTop: 1,
                              }}
                            >
                              {burn.notes}
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              flexShrink: 0,
                              marginLeft: 12,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 500,
                                color,
                              }}
                            >
                              {burn.hours}h
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--text-tertiary)",
                              }}
                            >
                              {burnDailyHours(burn).toFixed(1)}h/day
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Per-day allocation */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(5, 1fr)",
                          gap: 4,
                          marginTop: 3,
                        }}
                      >
                        {dates.map((d) => (
                          <div
                            key={d}
                            style={{
                              fontSize: 10,
                              color: burnSpansDate(burn, d)
                                ? color
                                : "transparent",
                              textAlign: "center",
                              fontWeight: 500,
                            }}
                          >
                            {burnSpansDate(burn, d)
                              ? burnDailyHours(burn).toFixed(1) + "h"
                              : "·"}
                          </div>
                        ))}
                      </div>

                      {/* Status row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 6,
                        }}
                      >
                        <button
                          onClick={() => toggleSubmitted(burn.id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            color: burn.submitted
                              ? "#1D9E75"
                              : "var(--text-tertiary)",
                            fontSize: 16,
                          }}
                        >
                          <i
                            className={
                              burn.submitted
                                ? "ti ti-circle-check-filled"
                                : "ti ti-circle"
                            }
                          />
                        </button>
                        <span
                          style={{
                            fontSize: 11,
                            color: burn.submitted
                              ? "#1D9E75"
                              : "var(--text-tertiary)",
                          }}
                        >
                          {burn.submitted
                            ? "Submitted to Kantata"
                            : "Not submitted"}
                        </span>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          {!burn.submitted && (
                            <button
                              onClick={() => copyEntry(burn)}
                              style={{
                                ...pillBtn,
                                fontSize: 11,
                                padding: "2px 8px",
                                color:
                                  copiedId === burn.id
                                    ? "#1D9E75"
                                    : "var(--text-tertiary)",
                                borderColor:
                                  copiedId === burn.id
                                    ? "#1D9E75"
                                    : undefined,
                              }}
                            >
                              <i
                                className={
                                  copiedId === burn.id
                                    ? "ti ti-check"
                                    : "ti ti-copy"
                                }
                                style={{ fontSize: 12 }}
                              />
                              {copiedId === burn.id ? "Copied" : "Copy"}
                            </button>
                          )}
                          <button
                            onClick={() => removeEntry(burn.id)}
                            style={{
                              ...pillBtn,
                              fontSize: 11,
                              padding: "2px 8px",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            <i
                              className="ti ti-trash"
                              style={{ fontSize: 12 }}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Add burn form */}
              {addingTo === "burn" && (
                <EntryForm
                  activities={activities}
                  solutions={solutions}
                  isBurn
                  defaultDate={dates[0]}
                  defaultEndDate={dates[4]}
                  onAdd={addEntry}
                  onCancel={() => setAddingTo(null)}
                />
              )}

              {burns.length === 0 && addingTo !== "burn" && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                  }}
                >
                  No controlled burns this week
                </div>
              )}
            </div>
          )}

          {/* Add burn button when no burns yet */}
          {burns.length === 0 && (
            <div style={{ marginBottom: 14 }}>
              {addingTo === "burn" ? (
                <div style={{ ...cardBorder, padding: 16 }}>
                  <div style={sectionTitle}>
                    <i
                      className="ti ti-flame"
                      style={{
                        fontSize: 14,
                        marginRight: 6,
                        verticalAlign: -1,
                      }}
                    />
                    New Controlled Burn
                  </div>
                  <EntryForm
                    activities={activities}
                    solutions={solutions}
                    isBurn
                    defaultDate={dates[0]}
                    defaultEndDate={dates[4]}
                    onAdd={addEntry}
                    onCancel={() => setAddingTo(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo("burn")}
                  style={{
                    ...pillBtn,
                    color: "var(--text-secondary)",
                    width: "100%",
                    justifyContent: "center",
                    padding: "10px 0",
                    borderStyle: "dashed",
                  }}
                >
                  <i className="ti ti-flame" style={{ fontSize: 14 }} />
                  Add controlled burn
                </button>
              )}
            </div>
          )}

          {/* ── Day-by-day entries ── */}
          <div style={{ ...cardBorder, padding: 16 }}>
            <div style={sectionTitle}>
              <i
                className="ti ti-list"
                style={{ fontSize: 14, marginRight: 6, verticalAlign: -1 }}
              />
              Entries
            </div>

            {dates.map((date) => {
              const dayEnts = entriesForDay(date).filter(
                (e) => !pendingOnly || !e.submitted
              );
              const dt = dayTotal(date);
              const isToday = date === today;
              if (pendingOnly && dayEnts.length === 0) return null;

              return (
                <div key={date} style={{ marginBottom: 16 }}>
                  {/* Day header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "0.5px solid var(--border-light)",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isToday
                            ? "#378ADD"
                            : "var(--text-primary)",
                        }}
                      >
                        {fmtDay(date)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {fmtShortDate(date)}
                      </span>
                      {isToday && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 99,
                            background: "#378ADD18",
                            color: "#378ADD",
                            fontWeight: 500,
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color:
                            dt >= 8
                              ? "#1D9E75"
                              : "var(--text-primary)",
                        }}
                      >
                        {dt.toFixed(1)}h
                      </span>
                      {dayEnts.filter((e) => !e.submitted).length > 0 && (
                        <button
                          onClick={() => copyDayEntries(date)}
                          style={{
                            ...pillBtn,
                            fontSize: 11,
                            padding: "2px 8px",
                            color:
                              copiedId === "day_" + date
                                ? "#1D9E75"
                                : "var(--text-tertiary)",
                          }}
                        >
                          <i
                            className={
                              copiedId === "day_" + date
                                ? "ti ti-check"
                                : "ti ti-copy"
                            }
                            style={{ fontSize: 12 }}
                          />
                          Day
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setAddingTo(addingTo === date ? null : date)
                        }
                        style={{
                          ...pillBtn,
                          padding: "2px 6px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <i className="ti ti-plus" style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>

                  {/* Entries for this day */}
                  {dayEnts.length === 0 && addingTo !== date && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                        padding: "4px 0",
                        fontStyle: "italic",
                      }}
                    >
                      No entries
                    </div>
                  )}

                  {dayEnts.map((entry) => {
                    const act = activities.find(
                      (a) => a.id === entry.activity_id
                    );
                    const color = activityColor(
                      activities,
                      entry.activity_id
                    );

                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "8px 8px 8px 12px",
                          marginBottom: 4,
                          borderRadius: 8,
                          background: "var(--bg-secondary)",
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        {/* Submitted toggle */}
                        <button
                          onClick={() => toggleSubmitted(entry.id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            color: entry.submitted
                              ? "#1D9E75"
                              : "var(--border-mid)",
                            fontSize: 17,
                            marginTop: 1,
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className={
                              entry.submitted
                                ? "ti ti-circle-check-filled"
                                : "ti ti-circle"
                            }
                          />
                        </button>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 2,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                              }}
                            >
                              {act?.label || entry.activity_id}
                            </span>
                            {entry.solution_id && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 99,
                                  background: color + "18",
                                  color,
                                  fontWeight: 500,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <i
                                  className="ti ti-link"
                                  style={{ fontSize: 10 }}
                                />
                                Solution
                              </span>
                            )}
                            {entry.task_category && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 99,
                                  background: "var(--bg-tertiary)",
                                  color: "var(--text-secondary)",
                                  fontWeight: 500,
                                }}
                              >
                                {entry.task_category}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-secondary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {entry.notes}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-tertiary)",
                              marginTop: 3,
                            }}
                          >
                            {act?.code}
                          </div>
                        </div>

                        {/* Hours + actions */}
                        <div
                          style={{
                            textAlign: "right",
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 500,
                              color: "var(--text-primary)",
                            }}
                          >
                            {entry.hours}h
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                            }}
                          >
                            {!entry.submitted && (
                              <button
                                onClick={() => copyEntry(entry)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  color:
                                    copiedId === entry.id
                                      ? "#1D9E75"
                                      : "var(--text-tertiary)",
                                  fontSize: 12,
                                  fontFamily: "inherit",
                                }}
                              >
                                <i
                                  className={
                                    copiedId === entry.id
                                      ? "ti ti-check"
                                      : "ti ti-copy"
                                  }
                                  style={{ fontSize: 13 }}
                                />
                              </button>
                            )}
                            <button
                              onClick={() => removeEntry(entry.id)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                color: "var(--text-tertiary)",
                                fontSize: 12,
                              }}
                            >
                              <i
                                className="ti ti-trash"
                                style={{ fontSize: 13 }}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline add form */}
                  {addingTo === date && (
                    <EntryForm
                      activities={activities}
                      solutions={solutions}
                      defaultDate={date}
                      onAdd={addEntry}
                      onCancel={() => setAddingTo(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Kantata export table ── */}
          {pendingCount > 0 && (
            <div style={{ ...cardBorder, padding: 16, marginTop: 14 }}>
              <div style={sectionTitle}>
                <i
                  className="ti ti-upload"
                  style={{ fontSize: 14, marginRight: 6, verticalAlign: -1 }}
                />
                Kantata Export Preview
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                }}
              >
                {pendingCount} pending{" "}
                {pendingCount === 1 ? "entry" : "entries"} ·{" "}
                {pendingHours.toFixed(1)}h to submit
              </div>
              <div
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "0.5px solid var(--border-light)",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      {["Day", "Activity", "Hours", "Notes", "Task", ""].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              fontWeight: 500,
                              color: "var(--text-secondary)",
                              borderBottom: "0.5px solid var(--border-light)",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .filter((e) => !e.submitted)
                      .flatMap((e) => {
                        if (e.end_date) {
                          return dates
                            .filter(
                              (d) => d >= e.date && d <= e.end_date
                            )
                            .map((d) => ({
                              ...e,
                              date: d,
                              hours: +burnDailyHours(e).toFixed(2),
                              _row: true,
                            }));
                        }
                        return [e];
                      })
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((row, i) => {
                        const act = activities.find(
                          (a) => a.id === row.activity_id
                        );
                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom:
                                "0.5px solid var(--border-light)",
                            }}
                          >
                            <td
                              style={{
                                padding: "7px 10px",
                                color: "var(--text-secondary)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtDay(row.date)}{" "}
                              {new Date(row.date + "T12:00:00").getDate()}
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                fontWeight: 500,
                              }}
                            >
                              {act?.label || row.activity_id}
                            </td>
                            <td style={{ padding: "7px 10px" }}>
                              {row.hours}
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                color: "var(--text-secondary)",
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.notes}
                            </td>
                            <td
                              style={{
                                padding: "7px 10px",
                                color: "var(--text-tertiary)",
                              }}
                            >
                              {row.engagement_task ||
                                act?.default_task ||
                                "—"}
                            </td>
                            <td style={{ padding: "7px 10px" }}>
                              <button
                                onClick={() => copyEntry(row)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color:
                                    copiedId === row.id
                                      ? "#1D9E75"
                                      : "var(--text-tertiary)",
                                  fontSize: 13,
                                }}
                              >
                                <i
                                  className={
                                    copiedId === row.id
                                      ? "ti ti-check"
                                      : "ti ti-copy"
                                  }
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sticky save bar ── */}
      {isDirty && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "var(--bg-primary)",
            borderTop: "1px solid var(--border-mid)",
            padding: "10px 20px",
            display: "flex",
            justifyContent: "center",
            gap: 8,
            zIndex: 100,
          }}
        >
          <button
            onClick={discardChanges}
            style={{
              ...pillBtn,
              padding: "6px 16px",
              color: "var(--text-secondary)",
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...pillBtn,
              padding: "6px 16px",
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              borderColor: "var(--text-primary)",
              fontWeight: 500,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save timesheet"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Entry form (used for both point entries and burns)
// ═════════════════════════════════════════════════════════════════════

function EntryForm({
  activities,
  solutions,
  isBurn,
  defaultDate,
  defaultEndDate,
  onAdd,
  onCancel,
}) {
  const [actId, setActId] = useState(activities[0]?.id || "");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [endDate, setEndDate] = useState(defaultEndDate || "");
  const [solutionId, setSolutionId] = useState("");
  const [taskCategory, setTaskCategory] = useState("");
  const [engagementTask, setEngagementTask] = useState("");
  const [ticket, setTicket] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedAct = activities.find((a) => a.id === actId);

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: "var(--bg-secondary)",
        marginTop: 6,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <select
          value={actId}
          onChange={(e) => setActId(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {activities
            .filter((a) => !a.archived)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          {activities.filter((a) => !a.archived).length === 0 && (
            <option value="">No activities — add one first</option>
          )}
        </select>
        <input
          type="number"
          step="0.25"
          min="0"
          placeholder="Hrs"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          style={{ ...inputStyle, textAlign: "right" }}
        />
      </div>

      <input
        type="text"
        placeholder="Notes (e.g. Call with Marisol)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...inputStyle, marginBottom: 8 }}
      />

      {isBurn && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          <label
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            Through:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          />
          {hours && endDate && defaultDate && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
              }}
            >
              {(
                parseFloat(hours) /
                Math.max(1, businessDaysBetween(defaultDate, endDate))
              ).toFixed(1)}
              h/day
            </span>
          )}
        </div>
      )}

      {/* Advanced fields toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontFamily: "inherit",
          marginBottom: showAdvanced ? 8 : 0,
        }}
      >
        <i
          className={showAdvanced ? "ti ti-chevron-up" : "ti ti-chevron-down"}
          style={{ fontSize: 12, verticalAlign: -1, marginRight: 3 }}
        />
        {showAdvanced ? "Less options" : "Solution link, task, ticket…"}
      </button>

      {showAdvanced && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <select
            value={solutionId}
            onChange={(e) => setSolutionId(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">No solution link</option>
            {solutions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.customer} — {s.title}
              </option>
            ))}
          </select>
          <select
            value={taskCategory}
            onChange={(e) => setTaskCategory(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">No category</option>
            {["scoping", "development", "testing", "training", "deployment"].map(
              (c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              )
            )}
          </select>
          <input
            type="text"
            placeholder={
              selectedAct?.default_task
                ? `Task (default: ${selectedAct.default_task})`
                : "Engagement task"
            }
            value={engagementTask}
            onChange={(e) => setEngagementTask(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="InvGate ticket #"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
          marginTop: 8,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            ...pillBtn,
            padding: "5px 12px",
            color: "var(--text-secondary)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (!hours || !actId) return;
            onAdd({
              id: newEntryId(),
              date: defaultDate,
              end_date: isBurn && endDate ? endDate : null,
              hours: parseFloat(hours),
              notes,
              activity_id: actId,
              solution_id: solutionId || null,
              task_category: taskCategory || null,
              engagement_task: engagementTask || null,
              ticket: ticket || null,
              submitted: false,
            });
          }}
          style={{
            ...pillBtn,
            padding: "5px 14px",
            background: "var(--text-primary)",
            color: "var(--bg-primary)",
            borderColor: "var(--text-primary)",
            fontWeight: 500,
          }}
        >
          {isBurn ? "Add burn" : "Add entry"}
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Activity Manager
// ═════════════════════════════════════════════════════════════════════

function ActivityManager({ activities, onSave, onBack }) {
  const [list, setList] = useState(activities);
  const [editing, setEditing] = useState(null); // id or "new"
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const isDirty =
    JSON.stringify(list) !== JSON.stringify(activities);

  const blank = {
    id: "",
    label: "",
    code: "",
    customer: "",
    default_task: "",
    archived: false,
  };

  const [form, setForm] = useState(blank);

  function startEdit(act) {
    setForm({ ...act });
    setEditing(act.id);
  }

  function startNew() {
    setForm({ ...blank });
    setEditing("new");
  }

  function saveForm() {
    if (!form.label) return;
    const id =
      editing === "new"
        ? form.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
        : form.id;

    const updated = { ...form, id };

    if (editing === "new") {
      setList((prev) => [...prev, updated]);
    } else {
      setList((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
    setEditing(null);
  }

  // ── CSV import ──────────────────────────────────────────────────
  function handleCsvImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset for re-import

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split("\n");
      if (lines.length < 2) {
        setImportMsg("CSV appears empty.");
        return;
      }

      // Simple CSV parser that handles quoted fields with commas/quotes
      function parseCsvLine(line) {
        const fields = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
              current += '"';
              i++;
            } else if (ch === '"') {
              inQuotes = false;
            } else {
              current += ch;
            }
          } else {
            if (ch === '"') {
              inQuotes = true;
            } else if (ch === ",") {
              fields.push(current.trim());
              current = "";
            } else {
              current += ch;
            }
          }
        }
        fields.push(current.trim());
        return fields;
      }

      const header = parseCsvLine(lines[0]);
      const actIdx = header.findIndex(
        (h) => h.toLowerCase() === "activity"
      );
      const acctIdx = header.findIndex(
        (h) => h.toLowerCase() === "account"
      );

      if (actIdx === -1) {
        setImportMsg("CSV missing 'Activity' column.");
        return;
      }

      // Collect unique activities
      const seen = {};
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const fields = parseCsvLine(line);
        const activity = fields[actIdx]?.trim();
        const account = acctIdx >= 0 ? fields[acctIdx]?.trim() : "";
        if (!activity || seen[activity]) continue;

        // Extract E-code
        const ecodeMatch = activity.match(/^(E\d+-\d+)/);
        const ecode = ecodeMatch ? ecodeMatch[1] : null;
        const slug = ecode
          ? ecode.toLowerCase()
          : activity
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 30);

        // Infer label: customer short name + type
        const custShort = account
          .split("(")[0]
          .replace(/,\s*$/, "")
          .trim()
          .slice(0, 25);
        const actLower = activity.toLowerCase();
        let atype = "Delivery";
        let defaultTask = null;
        if (
          actLower.includes("support") ||
          actLower.includes("optimization")
        ) {
          atype = "Support";
          defaultTask = "Support & Optimization";
        } else if (
          actLower.includes("implementation") ||
          actLower.includes("deployment")
        ) {
          atype = "Implementation";
        } else if (actLower.includes("admin")) {
          atype = "Admin";
        } else if (actLower.includes("managed service")) {
          atype = "MSP";
          defaultTask = "Support & Optimization";
        }

        seen[activity] = {
          id: slug,
          label: custShort ? `${custShort} ${atype}` : activity.slice(0, 40),
          code: activity,
          customer: account,
          default_task: defaultTask,
          archived: false,
        };
      }

      // Merge: only add activities whose code doesn't already exist
      const existingCodes = new Set(list.map((a) => a.code));
      const newOnes = Object.values(seen).filter(
        (a) => !existingCodes.has(a.code)
      );

      if (newOnes.length === 0) {
        setImportMsg(
          `Parsed ${Object.keys(seen).length} activities — all already exist.`
        );
      } else {
        setList((prev) => [...prev, ...newOnes]);
        setImportMsg(
          `Imported ${newOnes.length} new activities (${Object.keys(seen).length} total in CSV, ${Object.keys(seen).length - newOnes.length} already existed).`
        );
      }
      setTimeout(() => setImportMsg(""), 8000);
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(list);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={onBack}
          style={{
            ...pillBtn,
            padding: "4px 8px",
            color: "var(--text-secondary)",
          }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
        </button>
        <span style={{ fontSize: 18, fontWeight: 500 }}>
          Kantata Activities
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginLeft: 4,
          }}
        >
          {list.filter((a) => !a.archived).length} active
        </span>
        <button
          onClick={startNew}
          style={{
            ...pillBtn,
            marginLeft: "auto",
            color: "var(--text-secondary)",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 13 }} />
          Add activity
        </button>
        <label
          style={{
            ...pillBtn,
            color: "var(--text-secondary)",
            marginLeft: 0,
          }}
        >
          <i className="ti ti-file-import" style={{ fontSize: 13 }} />
          Import CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Import message */}
      {importMsg && (
        <div
          style={{
            fontSize: 12,
            color: "#1D9E75",
            background: "#E1F5EE",
            padding: "8px 12px",
            borderRadius: 8,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-check" style={{ fontSize: 14 }} />
          {importMsg}
        </div>
      )}

      {list
        .filter((a) => !a.archived)
        .map((act) => (
          <div
            key={act.id}
            style={{
              ...cardBorder,
              padding: "12px 16px",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 4,
                height: 32,
                borderRadius: 2,
                background: activityColor(list, act.id),
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {act.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 1,
                }}
              >
                {act.code}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  marginTop: 2,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span>Customer: {act.customer || "—"}</span>
                <span>
                  Default task: {act.default_task || "—"}
                </span>
              </div>
            </div>
            <button
              onClick={() => startEdit(act)}
              style={{
                ...pillBtn,
                padding: "3px 8px",
                fontSize: 11,
                color: "var(--text-tertiary)",
              }}
            >
              <i className="ti ti-pencil" style={{ fontSize: 12 }} />
            </button>
            <button
              onClick={() =>
                setList((prev) =>
                  prev.map((a) =>
                    a.id === act.id ? { ...a, archived: true } : a
                  )
                )
              }
              style={{
                ...pillBtn,
                padding: "3px 8px",
                fontSize: 11,
                color: "var(--text-tertiary)",
              }}
            >
              <i className="ti ti-archive" style={{ fontSize: 12 }} />
            </button>
          </div>
        ))}

      {/* Archived */}
      {list.filter((a) => a.archived).length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            Archived
          </div>
          {list
            .filter((a) => a.archived)
            .map((act) => (
              <div
                key={act.id}
                style={{
                  ...cardBorder,
                  padding: "10px 16px",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: 0.5,
                }}
              >
                <div style={{ flex: 1, fontSize: 13 }}>{act.label}</div>
                <button
                  onClick={() =>
                    setList((prev) =>
                      prev.map((a) =>
                        a.id === act.id ? { ...a, archived: false } : a
                      )
                    )
                  }
                  style={{
                    ...pillBtn,
                    padding: "3px 8px",
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
        </>
      )}

      {/* Edit/New modal-ish form */}
      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div
            style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              width: 420,
              maxWidth: "90vw",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                marginBottom: 16,
              }}
            >
              {editing === "new" ? "New Activity" : "Edit Activity"}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Label (short name)
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="e.g. USAV Support"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Kantata activity code
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="e.g. E022626-0001 NS-PPS-Support & Optimization-TM"
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  Customer
                  <input
                    type="text"
                    value={form.customer}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customer: e.target.value }))
                    }
                    placeholder="e.g. USAV"
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </label>
                <label
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  Default engagement task
                  <input
                    type="text"
                    value={form.default_task}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        default_task: e.target.value,
                      }))
                    }
                    placeholder="e.g. Support & Optimization"
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </label>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setEditing(null)}
                style={{
                  ...pillBtn,
                  padding: "6px 14px",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveForm}
                style={{
                  ...pillBtn,
                  padding: "6px 14px",
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                  borderColor: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {editing === "new" ? "Add" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky save bar */}
      {isDirty && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "var(--bg-primary)",
            borderTop: "1px solid var(--border-mid)",
            padding: "10px 20px",
            display: "flex",
            justifyContent: "center",
            gap: 8,
            zIndex: 100,
          }}
        >
          <button
            onClick={() => setList(activities)}
            style={{
              ...pillBtn,
              padding: "6px 16px",
              color: "var(--text-secondary)",
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...pillBtn,
              padding: "6px 16px",
              background: "var(--text-primary)",
              color: "var(--bg-primary)",
              borderColor: "var(--text-primary)",
              fontWeight: 500,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save activities"}
          </button>
        </div>
      )}
    </div>
  );
}
