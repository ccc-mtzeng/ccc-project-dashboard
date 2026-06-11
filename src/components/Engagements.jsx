import { useState, useMemo } from "react";
import StatCard from "./shared/StatCard";
import ProgressBar from "./shared/ProgressBar";
import EntryTable from "./shared/EntryTable";
import SaveBar from "./shared/SaveBar";
import SplitEntryModal from "./SplitEntryModal";
import ActivityManager from "./ActivityManager";
import { getSplitParentIds, round1 } from "../data/entries";
import { saveEntryTags, saveSplitChildren } from "../services/github";

// ═════════════════════════════════════════════════════════════════════
// Engagements — the connection hub.
// From one engagement you can: attach/detach its solutions, tag its
// time entries to those solutions, and split entries. Engagement
// (activity) records themselves are managed here too.
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
  onBatchSave,
  onSaveActivities,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [showManager, setShowManager] = useState(false);

  if (showManager) {
    return (
      <ActivityManager
        activities={activities}
        onSave={onSaveActivities}
        onBack={() => setShowManager(false)}
      />
    );
  }

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
        onBatchSave={onBatchSave}
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
      onManage={() => setShowManager(true)}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════
// Engagement List
// ═════════════════════════════════════════════════════════════════════

function EngagementList({ activities, solutions, allEntries, loading, onSelect, onManage }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const enriched = useMemo(() => {
    const splitIds = getSplitParentIds(allEntries);
    return activities.map((act) => {
      const visible = allEntries.filter((e) => e.activity_id === act.id && !splitIds.has(e.id));
      const totalHours = round1(visible.reduce((s, e) => s + e.hours, 0));
      const linkedSolutions = solutions.filter((s) => s.activity_id === act.id && !s.excluded);
      const taggedCount = visible.filter((e) => e.solution_id).length;
      const untaggedCount = visible.length - taggedCount;
      const untaggedHours = round1(visible.filter((e) => !e.solution_id).reduce((s, e) => s + e.hours, 0));
      return { ...act, entries: visible, totalHours, linkedSolutions, taggedCount, untaggedCount, untaggedHours };
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

  const totalHoursAll = round1(active.reduce((s, a) => s + a.totalHours, 0));
  const totalEntries = active.reduce((s, a) => s + a.entries.length, 0);
  const untaggedHoursAll = round1(active.reduce((s, a) => s + a.untaggedHours, 0));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>
          Engagements
        </div>
        <button onClick={onManage} style={{ ...pillBtn, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-settings" style={{ fontSize: 13 }} />
          Manage activities
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="briefcase" label="Engagements" value={active.length} sub={`${archived.length} archived`} />
        <StatCard icon="clock" label="Total hours" value={`${totalHoursAll}h`} sub={`${totalEntries} entries`} />
        {untaggedHoursAll > 0 && (
          <StatCard icon="tag-off" label="Untagged" value={`${untaggedHoursAll}h`} sub="not tied to a solution" />
        )}
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
// Engagement Detail — attach solutions + tag entries from one screen
// ═════════════════════════════════════════════════════════════════════

function EngagementDetail({ activity, activities, solutions, allEntries, onBack, onRefreshEntries, onBatchSave }) {
  // ── Staged edits ──
  const [tagEdits, setTagEdits] = useState({});       // { entryId: solutionId | null }
  const [solutionEdits, setSolutionEdits] = useState({}); // { solutionId: activityId | null }
  const [saving, setSaving] = useState(false);
  const [splitEntry, setSplitEntry] = useState(null);

  const isDirty = Object.keys(tagEdits).length > 0 || Object.keys(solutionEdits).length > 0;
  const changeCount = Object.keys(tagEdits).length + Object.keys(solutionEdits).length;

  // ── Solution linking (with staged edits applied) ──

  function effectiveActivityId(sol) {
    if (sol.id in solutionEdits) return solutionEdits[sol.id];
    return sol.activity_id || null;
  }

  const linkedSolutions = useMemo(
    () => solutions.filter((s) => effectiveActivityId(s) === activity.id && !s.excluded),
    [solutions, activity.id, solutionEdits]
  );

  const attachableSolutions = useMemo(
    () =>
      solutions
        .filter((s) => !s.excluded && effectiveActivityId(s) !== activity.id)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [solutions, activity.id, solutionEdits]
  );

  function stageSolutionLink(solutionId, newActivityId) {
    const sol = solutions.find((s) => s.id === solutionId);
    if (!sol) return;
    const original = sol.activity_id || null;
    if (newActivityId === original) {
      setSolutionEdits((prev) => { const next = { ...prev }; delete next[solutionId]; return next; });
    } else {
      setSolutionEdits((prev) => ({ ...prev, [solutionId]: newActivityId }));
    }
  }

  // ── Entries ──

  const rawEntries = useMemo(
    () =>
      allEntries
        .filter((e) => e.activity_id === activity.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allEntries, activity.id]
  );

  const splitParentIds = useMemo(() => getSplitParentIds(allEntries), [allEntries]);

  const entries = useMemo(
    () => rawEntries.filter((e) => !splitParentIds.has(e.id)),
    [rawEntries, splitParentIds]
  );

  // ── Tagging ──

  function setTag(entryId, solutionId) {
    const entry = entries.find((e) => e.id === entryId);
    const original = entry?.solution_id || null;
    if (solutionId === original) {
      setTagEdits((prev) => { const next = { ...prev }; delete next[entryId]; return next; });
    } else {
      setTagEdits((prev) => ({ ...prev, [entryId]: solutionId }));
    }
  }

  function getTag(entry) {
    if (entry.id in tagEdits) return tagEdits[entry.id];
    return entry.solution_id || null;
  }

  // Taggable options: solutions linked to this engagement, plus any
  // solution an entry is already tagged to (so existing tags always
  // render even if the link was changed elsewhere).
  function linkedSolutionsFor(entry) {
    const current = getTag(entry);
    const extra = current && !linkedSolutions.some((s) => s.id === current)
      ? solutions.filter((s) => s.id === current)
      : [];
    return [...linkedSolutions, ...extra];
  }

  function discardChanges() {
    setTagEdits({});
    setSolutionEdits({});
  }

  async function saveChanges() {
    setSaving(true);
    try {
      // 1. Solution link changes (batch write to solutions + index)
      const solutionUpdates = Object.entries(solutionEdits).map(([solId, activityId]) => {
        const sol = solutions.find((s) => s.id === solId);
        return { ...sol, activity_id: activityId };
      }).filter((s) => s.id);
      if (solutionUpdates.length > 0 && onBatchSave) {
        await onBatchSave(solutionUpdates);
      }

      // 2. Entry tag changes (sequential write per affected week)
      if (Object.keys(tagEdits).length > 0) {
        await saveEntryTags(tagEdits, entries);
        if (onRefreshEntries) onRefreshEntries();
      }

      setTagEdits({});
      setSolutionEdits({});
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Split handlers ──

  function getChildrenOf(parentId) {
    return allEntries.filter((e) => e.parent_id === parentId);
  }

  async function handleSplitSave(children) {
    setSaving(true);
    try {
      const parentEntry = rawEntries.find((e) => e.id === splitEntry.id) || splitEntry;
      await saveSplitChildren(parentEntry, children);
      setSplitEntry(null);
      if (onRefreshEntries) onRefreshEntries();
    } catch (err) {
      console.error("Failed to save split:", err);
      alert("Failed to save split: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnsplit() {
    setSaving(true);
    try {
      const parentEntry = rawEntries.find((e) => e.id === splitEntry.id) || splitEntry;
      await saveSplitChildren(parentEntry, []);
      setSplitEntry(null);
      if (onRefreshEntries) onRefreshEntries();
    } catch (err) {
      console.error("Failed to unsplit:", err);
      alert("Failed to unsplit: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Stats ──

  const totalHours = round1(entries.reduce((s, e) => s + e.hours, 0));
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

      {/* Solutions on this engagement — attach / detach */}
      <div style={{
        border: "0.5px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        marginBottom: 18,
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>
          Solutions on this engagement
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {linkedSolutions.map((s) => {
            const isStaged = s.id in solutionEdits;
            return (
              <span
                key={s.id}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 11, fontWeight: 500, padding: "3px 6px 3px 10px",
                  borderRadius: 99,
                  background: isStaged ? "#BA75170A" : "#185FA510",
                  color: isStaged ? "#BA7517" : "#185FA5",
                  border: isStaged ? "1px solid #BA751766" : "1px solid transparent",
                }}
              >
                {s.title}
                <button
                  onClick={() => stageSolutionLink(s.id, null)}
                  title="Detach from this engagement"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "inherit", padding: 0, display: "flex", alignItems: "center",
                    opacity: 0.7,
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: 12 }} />
                </button>
              </span>
            );
          })}

          {linkedSolutions.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              No solutions linked yet — attach one to start tagging time below.
            </span>
          )}

          {/* Attach dropdown */}
          {attachableSolutions.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) stageSolutionLink(e.target.value, activity.id); }}
              style={{
                fontFamily: "inherit", fontSize: 11, padding: "3px 6px",
                borderRadius: 99, border: "1px dashed var(--border-mid)",
                background: "transparent", color: "var(--text-secondary)",
                cursor: "pointer", maxWidth: 220,
              }}
            >
              <option value="">+ Attach solution…</option>
              {attachableSolutions.map((s) => {
                const act = activities.find((a) => a.id === effectiveActivityId(s));
                return (
                  <option key={s.id} value={s.id}>
                    {s.title}{act ? ` (currently ${act.customer})` : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>
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
            const hrs = round1(hoursBySolution[s.id] || 0);
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
                  {round1(hoursBySolution._untagged)}h
                </span>
              </div>
              <ProgressBar value={hoursBySolution._untagged} max={totalHours || 1} color="#ccc" height={4} />
            </div>
          )}
        </div>
      )}

      {/* Entries */}
      <EntryTable
        entries={entries}
        activities={activities}
        allEntries={allEntries}
        getTag={getTag}
        setTag={setTag}
        tagEdits={tagEdits}
        linkedSolutionsFor={linkedSolutionsFor}
        onSplit={setSplitEntry}
        totalHours={totalHours}
        emptyMessage="No time entries for this engagement."
      />

      {/* Save bar */}
      {isDirty && (
        <SaveBar
          icon="ti-tag"
          label={`${changeCount} change${changeCount !== 1 ? "s" : ""}`}
          saving={saving}
          saveLabel="Save changes"
          onDiscard={discardChanges}
          onSave={saveChanges}
        />
      )}

      {/* Split modal */}
      {splitEntry && (
        <SplitEntryModal
          entry={splitEntry}
          existingChildren={getChildrenOf(splitEntry.id)}
          solutions={linkedSolutions}
          onSave={handleSplitSave}
          onUnsplit={getChildrenOf(splitEntry.id).length > 0 ? handleUnsplit : null}
          onClose={() => setSplitEntry(null)}
        />
      )}
    </div>
  );
}
