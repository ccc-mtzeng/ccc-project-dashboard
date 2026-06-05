import { useState, useMemo } from "react";
import StatCard from "./shared/StatCard";
import ProgressBar from "./shared/ProgressBar";
import { CATEGORY_COLORS } from "../data/constants";
import { formatDate, isoWeekKey } from "../data/utils";
import {
  loadTimesheet,
  saveTimesheet,
} from "../services/github";

// ═════════════════════════════════════════════════════════════════════
// Engagements — list of activities with hours + drill into detail
// ═════════════════════════════════════════════════════════════════════

const pillBtn = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 500,
};

export default function Engagements({
  activities,
  solutions,
  allEntries,
  entriesLoading,
  onRefreshEntries,
}) {
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    const activity = activities.find((a) => a.id === selectedId);
    if (!activity) {
      setSelectedId(null);
      return null;
    }
    return (
      <EngagementDetail
        activity={activity}
        activities={activities}
        solutions={solutions}
        allEntries={allEntries}
        onBack={() => setSelectedId(null)}
        onRefreshEntries={onRefreshEntries}
      />
    );
  }

  return (
    <EngagementList
      activities={activities}
      solutions={solutions}
      allEntries={allEntries}
      loading={entriesLoading}
      onSelect={setSelectedId}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════
// Engagement List
// ═════════════════════════════════════════════════════════════════════

function EngagementList({ activities, solutions, allEntries, loading, onSelect }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const enriched = useMemo(() => {
    return activities.map((act) => {
      const entries = allEntries.filter((e) => e.activity_id === act.id);
      const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 10) / 10;
      const linkedSolutions = solutions.filter((s) => s.activity_id === act.id && !s.excluded);
      const taggedCount = entries.filter((e) => e.solution_id).length;
      const untaggedCount = entries.length - taggedCount;
      return { ...act, entries, totalHours, linkedSolutions, taggedCount, untaggedCount };
    });
  }, [activities, allEntries, solutions]);

  const active = enriched.filter((a) => !a.archived);
  const archived = enriched.filter((a) => a.archived);

  const filtered = active.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.customer?.toLowerCase().includes(q) ||
      a.label?.toLowerCase().includes(q) ||
      a.code?.toLowerCase().includes(q)
    );
  });

  // Sort: most hours first
  const sorted = [...filtered].sort((a, b) => b.totalHours - a.totalHours);

  const totalHoursAll = Math.round(active.reduce((s, a) => s + a.totalHours, 0) * 10) / 10;
  const totalEntries = active.reduce((s, a) => s + a.entries.length, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="briefcase" label="Engagements" value={active.length} sub={`${archived.length} archived`} />
        <StatCard icon="clock" label="Total hours" value={`${totalHoursAll}h`} sub={`${totalEntries} entries`} />
        <StatCard
          icon="link"
          label="Solutions linked"
          value={active.reduce((s, a) => s + a.linkedSolutions.length, 0)}
        />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search engagements…"
          style={{
            fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--border-light)", background: "var(--bg-primary)",
            color: "var(--text-primary)", width: "100%", boxSizing: "border-box",
          }}
        />
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "20px 0", textAlign: "center" }}>
          Loading time entries…
        </div>
      )}

      {/* Engagement cards */}
      {sorted.map((act) => (
        <div
          key={act.id}
          onClick={() => onSelect(act.id)}
          style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 8,
            cursor: "pointer",
            transition: "border-color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-mid)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-light)"; }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {act.customer}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
              {act.label || act.code}
            </div>
            {act.linkedSolutions.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                {act.linkedSolutions.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 10, padding: "1px 7px", borderRadius: 99,
                      background: "#185FA510", color: "#185FA5", fontWeight: 500,
                    }}
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
              {act.totalHours}h
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {act.entries.length} entries
            </div>
            {act.linkedSolutions.length > 0 && act.untaggedCount > 0 && (
              <div style={{ fontSize: 10, color: "#BA7517", marginTop: 2, fontWeight: 500 }}>
                {act.untaggedCount} untagged
              </div>
            )}
          </div>
        </div>
      ))}

      {sorted.length === 0 && !loading && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "20px 0", textAlign: "center" }}>
          {search ? "No engagements match your search." : "No active engagements."}
        </div>
      )}

      {/* Archived toggle */}
      {archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{ ...pillBtn, color: "var(--text-secondary)", fontSize: 11 }}
          >
            {showArchived ? "Hide" : "Show"} {archived.length} archived
          </button>
          {showArchived && archived.map((act) => (
            <div
              key={act.id}
              onClick={() => onSelect(act.id)}
              style={{
                border: "0.5px solid var(--border-light)",
                borderRadius: 10,
                padding: "10px 16px",
                marginTop: 6,
                cursor: "pointer",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{act.customer}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{act.label}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{act.totalHours}h</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Engagement Detail — entries + solution tagging
// ═════════════════════════════════════════════════════════════════════

function EngagementDetail({ activity, activities, solutions, allEntries, onBack, onRefreshEntries }) {
  const linkedSolutions = useMemo(
    () => solutions.filter((s) => s.activity_id === activity.id && !s.excluded),
    [solutions, activity.id]
  );

  const entries = useMemo(
    () =>
      allEntries
        .filter((e) => e.activity_id === activity.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allEntries, activity.id]
  );

  // Local editable copy for tagging
  const [tagEdits, setTagEdits] = useState({}); // { entryId: solutionId | null }
  const [saving, setSaving] = useState(false);

  const isDirty = Object.keys(tagEdits).length > 0;

  function setTag(entryId, solutionId) {
    const entry = entries.find((e) => e.id === entryId);
    const original = entry?.solution_id || null;
    if (solutionId === original) {
      // Reverted to original — remove edit
      setTagEdits((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } else {
      setTagEdits((prev) => ({ ...prev, [entryId]: solutionId }));
    }
  }

  function getTag(entry) {
    if (entry.id in tagEdits) return tagEdits[entry.id];
    return entry.solution_id || null;
  }

  function discardChanges() {
    setTagEdits({});
  }

  async function saveChanges() {
    setSaving(true);
    try {
      // Group changed entries by ISO week
      const weekChanges = {};
      for (const [entryId, solutionId] of Object.entries(tagEdits)) {
        const entry = entries.find((e) => e.id === entryId);
        if (!entry) continue;
        const wk = isoWeekKey(entry.date);
        if (!weekChanges[wk]) weekChanges[wk] = {};
        weekChanges[wk][entryId] = solutionId;
      }

      // Save each affected week
      for (const [weekKey, changes] of Object.entries(weekChanges)) {
        const { data, sha } = await loadTimesheet(weekKey);
        const updatedEntries = (data?.entries || []).map((e) => {
          if (e.id in changes) {
            return { ...e, solution_id: changes[e.id] };
          }
          return e;
        });
        await saveTimesheet(weekKey, { week: weekKey, entries: updatedEntries }, sha);
      }

      setTagEdits({});
      if (onRefreshEntries) onRefreshEntries();
    } catch (err) {
      console.error("Failed to save tags:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Stats
  const totalHours = Math.round(entries.reduce((s, e) => s + e.hours, 0) * 10) / 10;
  const hoursBySolution = useMemo(() => {
    const map = { _untagged: 0 };
    for (const e of entries) {
      const sid = getTag(e);
      if (sid) {
        map[sid] = (map[sid] || 0) + e.hours;
      } else {
        map._untagged += e.hours;
      }
    }
    return map;
  }, [entries, tagEdits]);

  // Group entries by date
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
        }}
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
        Back to engagements
      </button>

      {/* Header */}
      <h2 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: "var(--text-primary)" }}>
        {activity.customer}
      </h2>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        {activity.label || activity.code} · {activity.id.toUpperCase()}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="clock" label="Total hours" value={`${totalHours}h`} sub={`${entries.length} entries`} />
        <StatCard icon="link" label="Solutions" value={linkedSolutions.length} />
        {linkedSolutions.length > 0 && (
          <StatCard
            icon="tag"
            label="Tagged"
            value={`${entries.filter((e) => getTag(e)).length}/${entries.length}`}
          />
        )}
      </div>

      {/* Hours by solution breakdown */}
      {linkedSolutions.length > 0 && (
        <div style={{
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: 14,
          marginBottom: 18,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>
            Hours by solution
          </div>
          {linkedSolutions.map((s) => {
            const hrs = Math.round((hoursBySolution[s.id] || 0) * 10) / 10;
            const pct = totalHours > 0 ? (hrs / totalHours) * 100 : 0;
            return (
              <div key={s.id} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{s.title}</span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{hrs}h</span>
                </div>
                <ProgressBar value={hrs} max={totalHours || 1} color="#185FA5" height={4} />
              </div>
            );
          })}
          {hoursBySolution._untagged > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Untagged</span>
                <span style={{ fontWeight: 500, color: "var(--text-tertiary)" }}>
                  {Math.round(hoursBySolution._untagged * 10) / 10}h
                </span>
              </div>
              <ProgressBar value={hoursBySolution._untagged} max={totalHours || 1} color="#ccc" height={4} />
            </div>
          )}
        </div>
      )}

      {/* Entries grouped by date */}
      <div style={{
        border: "0.5px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: linkedSolutions.length > 0 ? "90px 1fr 180px 60px" : "90px 1fr 60px",
          padding: "8px 14px",
          background: "var(--bg-secondary)",
          fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.03em",
        }}>
          <span>Date</span>
          <span>Notes</span>
          {linkedSolutions.length > 0 && <span>Solution</span>}
          <span style={{ textAlign: "right" }}>Hours</span>
        </div>

        {groupedByDate.map(([date, dayEntries]) => (
          dayEntries.map((entry, idx) => {
            const tagValue = getTag(entry);
            const isEdited = entry.id in tagEdits;
            return (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: linkedSolutions.length > 0 ? "90px 1fr 180px 60px" : "90px 1fr 60px",
                  padding: "8px 14px",
                  borderTop: "0.5px solid var(--border-light)",
                  alignItems: "center",
                  fontSize: 13,
                  background: isEdited ? "rgba(24,95,165,0.03)" : "transparent",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {idx === 0 ? formatDate(date) : ""}
                </span>
                <span style={{
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  paddingRight: 8,
                }}>
                  {entry.notes || (
                    <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontSize: 12 }}>
                      {entry.engagement_task || "—"}
                    </span>
                  )}
                </span>
                {linkedSolutions.length > 0 && (
                  <span>
                    <select
                      value={tagValue || ""}
                      onChange={(e) => setTag(entry.id, e.target.value || null)}
                      style={{
                        fontFamily: "inherit",
                        fontSize: 11,
                        padding: "3px 6px",
                        borderRadius: 4,
                        border: "1px solid var(--border-light)",
                        background: tagValue ? "#185FA508" : "var(--bg-primary)",
                        color: tagValue ? "#185FA5" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontWeight: tagValue ? 500 : 400,
                        maxWidth: 170,
                        width: "100%",
                      }}
                    >
                      <option value="">— Untagged —</option>
                      {linkedSolutions.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </span>
                )}
                <span style={{ textAlign: "right", fontWeight: 500, color: "var(--text-primary)" }}>
                  {entry.hours}h
                </span>
              </div>
            );
          })
        ))}

        {entries.length === 0 && (
          <div style={{ padding: "20px 14px", fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
            No time entries for this engagement.
          </div>
        )}
      </div>

      {/* Save bar */}
      {isDirty && (
        <div
          style={{
            position: "sticky",
            bottom: 16,
            marginTop: 20,
            background: "var(--bg-primary)",
            border: "1px solid var(--border-mid)",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            <i className="ti ti-tag" style={{ fontSize: 14, marginRight: 6 }} />
            {Object.keys(tagEdits).length} tag{Object.keys(tagEdits).length !== 1 ? "s" : ""} changed
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={discardChanges}
              style={{
                fontFamily: "inherit", fontSize: 13, padding: "6px 12px",
                borderRadius: 6, border: "1px solid var(--border-light)",
                background: "transparent", color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Discard
            </button>
            <button
              onClick={saveChanges}
              disabled={saving}
              style={{
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                padding: "6px 14px", borderRadius: 6, border: "none",
                background: "var(--text-primary)", color: "var(--bg-primary)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                opacity: saving ? 0.5 : 1,
              }}
            >
              <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />
              {saving ? "Saving…" : "Save tags"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
