import { useState, useMemo } from "react";
import StatCard from "./shared/StatCard";
import EntryTable from "./shared/EntryTable";
import SaveBar from "./shared/SaveBar";
import SplitEntryModal from "./SplitEntryModal";
import { getSplitParentIds, round1 } from "../data/entries";
import { saveEntryTags, saveSplitChildren } from "../services/github";
import { useAppData } from "../context/AppDataContext";

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
// Time Entries hub — flat filterable list with tagging and splitting
// ═══════════════════════════════════════════════════════════════════

export default function Timesheet({ onOpenImport }) {
  const {
    activities,
    solutions,
    allEntries,
    entriesLoading,
    refreshEntries: onRefreshEntries,
  } = useAppData();
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

  const splitParentIds = useMemo(() => getSplitParentIds(allEntries), [allEntries]);

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

  // Stats
  const totalFilteredHours = round1(filtered.reduce((s, e) => s + (e.hours || 0), 0));
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
      await saveEntryTags(tagEdits, visibleEntries);
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
      const parentEntry = allEntries.find((e) => e.id === splitEntry.id) || splitEntry;
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

  function clearFilters() {
    setFilterEngagement("");
    setFilterSolution("");
    setFilterSearch("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterSplitOnly(false);
    setFilterUntaggedOnly(false);
  }

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
          {onOpenImport && (
            <button
              onClick={onOpenImport}
              style={{ ...pillBtn, color: "var(--text-secondary)" }}
            >
              <i className="ti ti-table-import" style={{ fontSize: 13 }} />
              Import CSV
            </button>
          )}
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
      {!entriesLoading && filtered.length === 0 ? (
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
      ) : filtered.length > 0 && (
        <EntryTable
          entries={filtered}
          activities={activities}
          allEntries={allEntries}
          getTag={getTag}
          setTag={setTag}
          tagEdits={tagEdits}
          linkedSolutionsFor={linkedSolutions}
          onSplit={setSplitEntry}
          showEngagement
          totalHours={totalFilteredHours}
        />
      )}

      {/* Save bar */}
      {isDirty && (
        <SaveBar
          icon="ti-tag"
          label={`${Object.keys(tagEdits).length} tag${Object.keys(tagEdits).length !== 1 ? "s" : ""} changed`}
          saving={saving}
          saveLabel="Save tags"
          onDiscard={discardChanges}
          onSave={saveChanges}
        />
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
