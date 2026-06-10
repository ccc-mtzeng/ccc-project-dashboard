import { useState, useMemo } from "react";
import StatCard from "./shared/StatCard";
import ProgressBar from "./shared/ProgressBar";
import SplitEntryModal from "./SplitEntryModal";
import TimeEntryImport from "./TimeEntryImport";
import { CATEGORY_COLORS } from "../data/constants";
import { formatDate, isoWeekKey } from "../data/utils";
import {
  loadTimesheet,
  saveTimesheet,
  saveActivities,
} from "../services/github";

// ── Shared styles ─────────────────────────────────────────────────

const pillBtn = {
  fontSize: 12,
  padding: "5px 12px",
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
  boxSizing: "border-box",
};

const selectStyle = {
  fontFamily: "inherit",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-light)",
  cursor: "pointer",
};

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════

export default function Timesheet({
  activities,
  solutions,
  allEntries,
  entriesLoading,
  onRefreshEntries,
  onSaveActivities,
  onRefresh,
}) {
  const [subView, setSubView] = useState("entries"); // "entries" | "activities" | "import"

  // ── Filters ──
  const [filterEngagement, setFilterEngagement] = useState("");
  const [filterSolution, setFilterSolution] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSplitOnly, setFilterSplitOnly] = useState(false);
  const [filterUntaggedOnly, setFilterUntaggedOnly] = useState(false);

  // ── Tag editing ──
  const [tagEdits, setTagEdits] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Split ──
  const [splitEntry, setSplitEntry] = useState(null);

  const isDirty = Object.keys(tagEdits).length > 0;

  // ── Derived data ──

  const splitParentIds = useMemo(() => {
    const ids = new Set();
    for (const e of allEntries) {
      if (e.parent_id) ids.add(e.parent_id);
    }
    return ids;
  }, [allEntries]);

  // All visible entries (split parents hidden)
  const visibleEntries = useMemo(
    () => allEntries.filter((e) => !splitParentIds.has(e.id)),
    [allEntries, splitParentIds]
  );

  // Filtered entries
  const filtered = useMemo(() => {
    let result = visibleEntries;

    if (filterEngagement) {
      result = result.filter((e) => e.activity_id === filterEngagement);
    }
    if (filterSolution) {
      const sid = filterSolution;
      result = result.filter((e) => getTag(e) === sid);
    }
    if (filterUntaggedOnly) {
      result = result.filter((e) => !getTag(e));
    }
    if (filterSplitOnly) {
      result = result.filter((e) => !!e.parent_id);
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      result = result.filter((e) =>
        (e.notes || "").toLowerCase().includes(q) ||
        (e.engagement_task || "").toLowerCase().includes(q) ||
        (e.task_category || "").toLowerCase().includes(q)
      );
    }
    if (filterDateFrom) {
      result = result.filter((e) => e.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((e) => e.date <= filterDateTo);
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [visibleEntries, filterEngagement, filterSolution, filterUntaggedOnly, filterSplitOnly, filterSearch, filterDateFrom, filterDateTo, tagEdits]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const map = {};
    for (const e of filtered) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Stats
  const totalFilteredHours = Math.round(filtered.reduce((s, e) => s + (e.hours || 0), 0) * 10) / 10;
  const taggedCount = filtered.filter((e) => getTag(e)).length;
  const splitChildCount = filtered.filter((e) => !!e.parent_id).length;

  // Engagement options for filter
  const engagementOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    for (const e of visibleEntries) {
      if (!e.activity_id || seen.has(e.activity_id)) continue;
      seen.add(e.activity_id);
      const act = activities.find((a) => a.id === e.activity_id);
      if (act) options.push({ id: act.id, label: `${act.customer} — ${act.label || act.code}` });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleEntries, activities]);

  // Solution options for filter
  const solutionOptions = useMemo(() => {
    return solutions.filter((s) => !s.excluded).sort((a, b) => a.title.localeCompare(b.title));
  }, [solutions]);

  // Active filter count (for "clear all" button)
  const activeFilterCount = [
    filterEngagement, filterSolution, filterSearch,
    filterDateFrom, filterDateTo, filterSplitOnly, filterUntaggedOnly,
  ].filter(Boolean).length;

  // ── Tag helpers ──

  function setTag(entryId, solutionId) {
    const entry = visibleEntries.find((e) => e.id === entryId);
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

  function discardChanges() {
    setTagEdits({});
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const weekChanges = {};
      for (const [entryId, solutionId] of Object.entries(tagEdits)) {
        const entry = visibleEntries.find((e) => e.id === entryId);
        if (!entry) continue;
        const wk = isoWeekKey(entry.date);
        if (!weekChanges[wk]) weekChanges[wk] = {};
        weekChanges[wk][entryId] = solutionId;
      }
      for (const [weekKey, changes] of Object.entries(weekChanges)) {
        const { data, sha } = await loadTimesheet(weekKey);
        const updatedEntries = (data?.entries || []).map((e) => {
          if (e.id in changes) return { ...e, solution_id: changes[e.id] };
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

  // ── Split helpers ──

  function getChildrenOf(parentId) {
    return allEntries.filter((e) => e.parent_id === parentId);
  }

  async function handleSplitSave(children) {
    setSaving(true);
    try {
      const parentEntry = allEntries.find((e) => e.id === splitEntry.id) || splitEntry;
      const wk = isoWeekKey(parentEntry.date);
      const { data, sha } = await loadTimesheet(wk);
      const existing = data?.entries || [];
      const cleaned = existing.filter((e) => e.parent_id !== parentEntry.id);
      const updated = [...cleaned, ...children];
      await saveTimesheet(wk, { week: wk, entries: updated }, sha);
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
      const parentEntry = allEntries.find((e) => e.id === splitEntry.id) || splitEntry;
      const wk = isoWeekKey(parentEntry.date);
      const { data, sha } = await loadTimesheet(wk);
      const existing = data?.entries || [];
      const cleaned = existing.filter((e) => e.parent_id !== parentEntry.id);
      await saveTimesheet(wk, { week: wk, entries: cleaned }, sha);
      setSplitEntry(null);
      if (onRefreshEntries) onRefreshEntries();
    } catch (err) {
      console.error("Failed to unsplit:", err);
      alert("Failed to unsplit: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setFilterEngagement("");
    setFilterSolution("");
    setFilterSearch("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSplitOnly(false);
    setFilterUntaggedOnly(false);
  }

  // ── Sub-views ──

  if (subView === "activities") {
    return (
      <ActivityManager
        activities={activities}
        onSave={onSaveActivities}
        onBack={() => setSubView("entries")}
      />
    );
  }

  if (subView === "import") {
    return (
      <TimeEntryImport
        activities={activities}
        onComplete={() => {
          setSubView("entries");
          if (onRefreshEntries) onRefreshEntries();
          if (onRefresh) onRefresh();
        }}
        onCancel={() => setSubView("entries")}
      />
    );
  }

  // ── Main entries view ──

  // Solutions linked to a given entry's engagement
  function linkedSolutions(entry) {
    return solutionOptions.filter((s) => s.activity_id === entry.activity_id);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)" }}>
          Time Entries
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setSubView("activities")}
            style={{ ...pillBtn, color: "var(--text-secondary)" }}
          >
            <i className="ti ti-settings" style={{ fontSize: 13 }} />
            Activities
          </button>
          <button
            onClick={() => setSubView("import")}
            style={{ ...pillBtn, color: "var(--text-secondary)" }}
          >
            <i className="ti ti-file-import" style={{ fontSize: 13 }} />
            Import
          </button>
          {onRefreshEntries && (
            <button
              onClick={onRefreshEntries}
              disabled={entriesLoading}
              style={{ ...pillBtn, color: "var(--text-secondary)", opacity: entriesLoading ? 0.5 : 1 }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard icon="clock" label="Hours" value={`${totalFilteredHours}h`} sub={`${filtered.length} entries`} />
        <StatCard
          icon="tag"
          label="Tagged"
          value={`${taggedCount}/${filtered.length}`}
          sub={filtered.length - taggedCount > 0 ? `${filtered.length - taggedCount} untagged` : "All tagged"}
        />
        {splitChildCount > 0 && (
          <StatCard icon="scissors" label="Split" value={splitChildCount} sub="child entries" />
        )}
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center",
        }}
      >
        <select
          value={filterEngagement}
          onChange={(e) => setFilterEngagement(e.target.value)}
          style={{
            ...selectStyle,
            fontSize: 12,
            padding: "5px 8px",
            color: filterEngagement ? "var(--text-primary)" : "var(--text-secondary)",
            minWidth: 180,
          }}
        >
          <option value="">All engagements</option>
          {engagementOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>

        <select
          value={filterSolution}
          onChange={(e) => { setFilterSolution(e.target.value); if (e.target.value) setFilterUntaggedOnly(false); }}
          style={{
            ...selectStyle,
            fontSize: 12,
            padding: "5px 8px",
            color: filterSolution ? "#185FA5" : "var(--text-secondary)",
            minWidth: 160,
          }}
        >
          <option value="">All solutions</option>
          {solutionOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <input
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Search notes…"
          style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 160 }}
        />

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          style={{ ...inputStyle, fontSize: 11, padding: "4px 6px", width: 120 }}
          title="From date"
        />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>→</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          style={{ ...inputStyle, fontSize: 11, padding: "4px 6px", width: 120 }}
          title="To date"
        />

        <button
          onClick={() => { setFilterUntaggedOnly(!filterUntaggedOnly); if (!filterUntaggedOnly) setFilterSolution(""); }}
          style={{
            ...pillBtn,
            fontSize: 11,
            padding: "4px 10px",
            background: filterUntaggedOnly ? "#BA7517" : "transparent",
            color: filterUntaggedOnly ? "#fff" : "var(--text-secondary)",
            borderColor: filterUntaggedOnly ? "#BA7517" : undefined,
          }}
        >
          Untagged
        </button>

        <button
          onClick={() => setFilterSplitOnly(!filterSplitOnly)}
          style={{
            ...pillBtn,
            fontSize: 11,
            padding: "4px 10px",
            background: filterSplitOnly ? "var(--text-primary)" : "transparent",
            color: filterSplitOnly ? "var(--bg-primary)" : "var(--text-secondary)",
            borderColor: filterSplitOnly ? "var(--text-primary)" : undefined,
          }}
        >
          <i className="ti ti-scissors" style={{ fontSize: 12 }} />
          Splits
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            style={{ ...pillBtn, fontSize: 11, padding: "4px 10px", color: "#E24B4A", borderColor: "rgba(226,75,74,0.3)" }}
          >
            <i className="ti ti-x" style={{ fontSize: 12 }} />
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Loading */}
      {entriesLoading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)", fontSize: 13 }}>
          Loading time entries…
        </div>
      )}

      {/* Entry table */}
      {filtered.length > 0 && (
        <div style={{
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "82px minmax(100px, 1fr) minmax(120px, 2fr) 160px 56px 32px",
            padding: "8px 14px",
            background: "var(--bg-secondary)",
            fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.03em",
          }}>
            <span>Date</span>
            <span>Engagement</span>
            <span>Notes</span>
            <span>Solution</span>
            <span style={{ textAlign: "right" }}>Hours</span>
            <span />
          </div>

          {/* Entry rows */}
          {groupedByDate.map(([date, dayEntries]) =>
            dayEntries.map((entry, idx) => {
              const tagValue = getTag(entry);
              const isEdited = entry.id in tagEdits;
              const isChild = !!entry.parent_id;
              const parentEntry = isChild ? allEntries.find((e) => e.id === entry.parent_id) : null;
              const act = activities.find((a) => a.id === entry.activity_id);
              const entryLinkedSolutions = linkedSolutions(entry);

              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "82px minmax(100px, 1fr) minmax(120px, 2fr) 160px 56px 32px",
                    padding: "7px 14px",
                    borderTop: "0.5px solid var(--border-light)",
                    alignItems: "center",
                    fontSize: 13,
                    background: isEdited ? "rgba(24,95,165,0.03)" : isChild ? "rgba(0,0,0,0.015)" : "transparent",
                  }}
                >
                  {/* Date */}
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {idx === 0 ? formatDate(date) : ""}
                  </span>

                  {/* Engagement */}
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {act ? act.customer : "—"}
                  </span>

                  {/* Notes */}
                  <span style={{
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    paddingRight: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}>
                    {isChild && (
                      <i className="ti ti-corner-down-right" style={{ fontSize: 12, color: "var(--text-tertiary)", flexShrink: 0 }} />
                    )}
                    {entry.notes || (
                      <span style={{ color: "var(--text-tertiary)", fontStyle: "italic", fontSize: 12 }}>
                        {entry.engagement_task || "—"}
                      </span>
                    )}
                  </span>

                  {/* Solution tag */}
                  <span>
                    {entryLinkedSolutions.length > 0 ? (
                      <select
                        value={tagValue || ""}
                        onChange={(e) => setTag(entry.id, e.target.value || null)}
                        style={{
                          ...selectStyle,
                          background: tagValue ? "#185FA508" : "var(--bg-primary)",
                          color: tagValue ? "#185FA5" : "var(--text-secondary)",
                          fontWeight: tagValue ? 500 : 400,
                          maxWidth: 150,
                          width: "100%",
                        }}
                      >
                        <option value="">— Untagged —</option>
                        {entryLinkedSolutions.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </span>

                  {/* Hours */}
                  <span style={{ textAlign: "right", fontWeight: 500, color: "var(--text-primary)" }}>
                    {entry.hours}h
                  </span>

                  {/* Split action */}
                  <span style={{ textAlign: "center" }}>
                    {isChild ? (
                      <button
                        onClick={() => parentEntry && setSplitEntry(parentEntry)}
                        title="Edit split"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-tertiary)", fontSize: 13, padding: 2,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                      >
                        <i className="ti ti-edit" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setSplitEntry(entry)}
                        title="Split entry"
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-tertiary)", fontSize: 13, padding: 2,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                      >
                        <i className="ti ti-scissors" />
                      </button>
                    )}
                  </span>
                </div>
              );
            })
          )}

          {/* Totals */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "82px minmax(100px, 1fr) minmax(120px, 2fr) 160px 56px 32px",
            padding: "10px 14px",
            borderTop: "1.5px solid var(--border-mid)",
            fontSize: 13, fontWeight: 500,
          }}>
            <span style={{ color: "var(--text-primary)" }}>Total</span>
            <span />
            <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
              {filtered.length} entries
            </span>
            <span />
            <span style={{ textAlign: "right", color: "var(--text-primary)" }}>{totalFilteredHours}h</span>
            <span />
          </div>
        </div>
      )}

      {/* Empty */}
      {!entriesLoading && filtered.length === 0 && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          border: "0.5px solid var(--border-light)", borderRadius: "var(--radius-lg)",
        }}>
          <i className="ti ti-clock-off" style={{ fontSize: 28, color: "var(--text-secondary)", display: "block", marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {activeFilterCount > 0
              ? "No entries match your filters."
              : "No time entries loaded yet. Import a Kantata CSV to get started."}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ ...pillBtn, marginTop: 12, color: "var(--text-secondary)" }}>
              Clear filters
            </button>
          )}
        </div>
      )}

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

      {/* Split modal */}
      {splitEntry && (
        <SplitEntryModal
          entry={splitEntry}
          existingChildren={getChildrenOf(splitEntry.id)}
          solutions={linkedSolutions(splitEntry)}
          onSave={handleSplitSave}
          onUnsplit={getChildrenOf(splitEntry.id).length > 0 ? handleUnsplit : null}
          onClose={() => setSplitEntry(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ActivityManager — manage Kantata activity mappings
// ═══════════════════════════════════════════════════════════════════

function ActivityManager({ activities, onSave, onBack }) {
  const [list, setList] = useState(activities);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const isDirty = JSON.stringify(list) !== JSON.stringify(activities);

  const filtered = list.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.customer?.toLowerCase().includes(q) ||
      a.label?.toLowerCase().includes(q) ||
      a.code?.toLowerCase().includes(q) ||
      a.id?.toLowerCase().includes(q)
    );
  });

  const active = filtered.filter((a) => !a.archived);
  const archived = filtered.filter((a) => a.archived);

  function startEdit(act) {
    setEditing(act.id);
    setForm({ ...act });
  }

  function startNew() {
    setEditing("new");
    setForm({
      id: "",
      code: "",
      customer: "",
      label: "",
      default_task: "",
      archived: false,
    });
  }

  function saveForm() {
    if (editing === "new") {
      const id = form.id.trim().toLowerCase().replace(/\s+/g, "-");
      if (!id) return;
      setList((prev) => [...prev, { ...form, id }]);
    } else {
      setList((prev) =>
        prev.map((a) => (a.id === editing ? { ...a, ...form } : a))
      );
    }
    setEditing(null);
  }

  function toggleArchived(id) {
    setList((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, archived: !a.archived } : a
      )
    );
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
      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
        }}
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
        Back to time entries
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 12px" }}>
        Activities
      </h2>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search activities…"
        style={{ ...inputStyle, marginBottom: 14, width: "100%" }}
      />

      <button onClick={startNew} style={{ ...pillBtn, color: "var(--text-secondary)", marginBottom: 14 }}>
        <i className="ti ti-plus" style={{ fontSize: 13 }} />
        Add activity
      </button>

      {/* Active */}
      {active.map((act) => (
        <div
          key={act.id}
          style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {act.customer}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {act.label || act.code} · {act.id}
            </div>
          </div>
          <button
            onClick={() => startEdit(act)}
            style={{ ...pillBtn, fontSize: 11, padding: "3px 8px", color: "var(--text-secondary)" }}
          >
            Edit
          </button>
          <button
            onClick={() => toggleArchived(act.id)}
            style={{ ...pillBtn, fontSize: 11, padding: "3px 8px", color: "var(--text-tertiary)" }}
          >
            Archive
          </button>
        </div>
      ))}

      {/* Archived */}
      {archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Archived ({archived.length})
          </div>
          {archived.map((act) => (
            <div
              key={act.id}
              style={{
                border: "0.5px solid var(--border-light)",
                borderRadius: 8,
                padding: "8px 14px",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: 0.6,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{act.customer}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{act.label}</div>
              </div>
              <button
                onClick={() => toggleArchived(act.id)}
                style={{ ...pillBtn, fontSize: 11, padding: "3px 8px", color: "var(--text-secondary)" }}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={() => setEditing(null)} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
          }} />
          <div style={{
            position: "relative",
            background: "var(--bg-primary)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
            width: 400,
            maxWidth: "90vw",
            boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
              {editing === "new" ? "New activity" : "Edit activity"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {editing === "new" && (
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  ID (lowercase, no spaces)
                  <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="e.g. usav-ns-ps" style={{ ...inputStyle, marginTop: 4 }} />
                </label>
              )}
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Customer
                <input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
                  style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Label
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Kantata code
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Default engagement task
                <input value={form.default_task} onChange={(e) => setForm((f) => ({ ...f, default_task: e.target.value }))}
                  placeholder="e.g. Support & Optimization" style={{ ...inputStyle, marginTop: 4 }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setEditing(null)} style={{ ...pillBtn, padding: "6px 14px", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button onClick={saveForm} style={{
                ...pillBtn, padding: "6px 14px",
                background: "var(--text-primary)", color: "var(--bg-primary)", borderColor: "var(--text-primary)", fontWeight: 500,
              }}>
                {editing === "new" ? "Add" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save bar */}
      {isDirty && (
        <div style={{
          position: "sticky", bottom: 16, marginTop: 20,
          background: "var(--bg-primary)", border: "1px solid var(--border-mid)",
          borderRadius: 10, padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Unsaved activity changes</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setList(activities)} style={{
              fontFamily: "inherit", fontSize: 13, padding: "6px 12px", borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            }}>Discard</button>
            <button onClick={handleSave} disabled={saving} style={{
              fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              padding: "6px 14px", borderRadius: 6, border: "none",
              background: "var(--text-primary)", color: "var(--bg-primary)",
              cursor: "pointer", opacity: saving ? 0.5 : 1,
            }}>{saving ? "Saving…" : "Save activities"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
