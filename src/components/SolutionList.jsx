import { useState } from "react";
import Badge from "./shared/Badge";
import { STATUS_CONFIG } from "../data/constants";
import { TAG_TAXONOMY, getTagInfo } from "../data/taxonomy";
import { formatDate } from "../data/utils";

const pillStyle = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: "1px solid var(--border-light)",
  fontWeight: 450,
  fontFamily: "inherit",
  transition: "all 0.15s",
  background: "transparent",
};

export default function SolutionList({
  solutions,
  onSelect,
  filterTag,
  setFilterTag,
  filterStatus,
  setFilterStatus,
  activities = [],
  onBatchSave,
}) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState("");
  const [engagementEdits, setEngagementEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const allTaxonomyKeys = Object.keys(TAG_TAXONOMY);
  const activeTagInfo = filterTag ? TAG_TAXONOMY[filterTag] : null;
  const excludedCount = solutions.filter((s) => s.excluded).length;
  const isDirty = Object.keys(engagementEdits).length > 0;

  const customers = [...new Set(solutions.map((s) => s.customer).filter(Boolean))].sort();

  function getEngagement(sol) {
    if (sol.id in engagementEdits) return engagementEdits[sol.id];
    return sol.activity_id || null;
  }

  function handleEngagementChange(sol, value) {
    const newVal = value || null;
    const original = sol.activity_id || null;
    if (newVal === original) {
      const next = { ...engagementEdits };
      delete next[sol.id];
      setEngagementEdits(next);
    } else {
      setEngagementEdits({ ...engagementEdits, [sol.id]: newVal });
    }
  }

  async function saveChanges() {
    if (!onBatchSave) return;
    setSaving(true);
    try {
      const updates = Object.entries(engagementEdits).map(([solId, activityId]) => {
        const sol = solutions.find((s) => s.id === solId);
        return { ...sol, activity_id: activityId };
      }).filter(Boolean);
      await onBatchSave(updates);
      setEngagementEdits({});
    } catch (err) {
      console.error("Failed to save engagements:", err);
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setEngagementEdits({});
  }

  const filtered = solutions.filter((s) => {
    if (!showExcluded && s.excluded) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterTag && !s.tags.some((t) => t.startsWith(filterTag))) return false;
    if (filterCustomer && s.customer !== filterCustomer) return false;
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setFilterStatus("")}
          style={{
            ...pillStyle,
            background: !filterStatus
              ? "var(--text-primary)"
              : "transparent",
            color: !filterStatus
              ? "var(--bg-primary)"
              : "var(--text-secondary)",
          }}
        >
          All
        </button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(filterStatus === k ? "" : k)}
            style={{
              ...pillStyle,
              background: filterStatus === k ? v.bg : "transparent",
              color: filterStatus === k ? v.color : "var(--text-secondary)",
              border:
                filterStatus === k
                  ? `1px solid ${v.color}33`
                  : "1px solid var(--border-light)",
            }}
          >
            {v.label}
          </button>
        ))}

        {/* Customer filter */}
        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          style={{
            fontFamily: "inherit",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 99,
            border: filterCustomer ? "1px solid var(--text-primary)33" : "1px solid var(--border-light)",
            background: filterCustomer ? "var(--bg-secondary)" : "transparent",
            color: filterCustomer ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            fontWeight: filterCustomer ? 500 : 450,
            marginLeft: 4,
          }}
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Process area dropdown */}
        <div style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            style={{
              ...pillStyle,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: filterTag ? activeTagInfo.bg : "transparent",
              color: filterTag
                ? activeTagInfo.color
                : "var(--text-secondary)",
              border: filterTag
                ? `1px solid ${activeTagInfo.color}33`
                : "1px solid var(--border-light)",
            }}
          >
            <i
              className="ti ti-filter"
              style={{ fontSize: 13 }}
              aria-hidden="true"
            />
            {filterTag ? activeTagInfo.label : "Process area"}
            <i
              className={`ti ti-chevron-${tagDropdownOpen ? "up" : "down"}`}
              style={{ fontSize: 12 }}
              aria-hidden="true"
            />
          </button>

          {tagDropdownOpen && (
            <>
              <div
                onClick={() => setTagDropdownOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 9 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 10,
                  background: "var(--bg-primary)",
                  border: "0.5px solid var(--border-mid)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 0",
                  minWidth: 220,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                }}
              >
                <button
                  onClick={() => {
                    setFilterTag("");
                    setTagDropdownOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "7px 14px",
                    background: !filterTag
                      ? "var(--bg-secondary)"
                      : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text-secondary)",
                    textAlign: "left",
                  }}
                >
                  All process areas
                </button>
                {allTaxonomyKeys.map((k) => {
                  const t = TAG_TAXONOMY[k];
                  const isActive = filterTag === k;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        setFilterTag(isActive ? "" : k);
                        setTagDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "7px 14px",
                        background: isActive
                          ? "var(--bg-secondary)"
                          : "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "var(--text-primary)",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          background: t.color,
                          flexShrink: 0,
                        }}
                      />
                      {t.label}
                      {isActive && (
                        <i
                          className="ti ti-check"
                          style={{
                            fontSize: 14,
                            marginLeft: "auto",
                            color: t.color,
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {(filterTag || filterCustomer) && (
          <button
            onClick={() => { setFilterTag(""); setFilterCustomer(""); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-secondary)",
              padding: "2px 4px",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <i
              className="ti ti-x"
              style={{ fontSize: 12 }}
              aria-hidden="true"
            />{" "}
            Clear
          </button>
        )}

        {/* Show excluded toggle */}
        {excludedCount > 0 && (
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            style={{
              ...pillStyle,
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: showExcluded ? "var(--text-primary)" : "var(--text-secondary)",
              background: showExcluded ? "var(--bg-secondary)" : "transparent",
              fontSize: 11,
            }}
          >
            <i className={`ti ${showExcluded ? "ti-eye" : "ti-eye-off"}`} style={{ fontSize: 13 }} />
            {excludedCount} excluded
          </button>
        )}
      </div>

      {/* Solution cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((s) => {
          const actual = s.tasks.reduce((a, t) => a + t.actual_hours, 0);
          const sc = STATUS_CONFIG[s.status];
          const engValue = getEngagement(s);
          const isEdited = s.id in engagementEdits;
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                border: isEdited ? "1px solid #BA751766" : "0.5px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                gap: 14,
                alignItems: "center",
                opacity: s.excluded ? 0.5 : 1,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = isEdited ? "#BA7517" : "var(--border-mid)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = isEdited ? "#BA751766" : "var(--border-light)")
              }
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  {s.excluded && (
                    <i className="ti ti-eye-off" style={{ fontSize: 13, color: "var(--text-secondary)" }} />
                  )}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {s.title}
                  </span>
                  <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  {s.customer} · Go-live {formatDate(s.go_live_date)}
                  <span style={{ color: "var(--border-mid)" }}>·</span>
                  <span
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <i className="ti ti-briefcase" style={{ fontSize: 12, color: isEdited ? "#BA7517" : "var(--text-tertiary)" }} />
                    <select
                      value={engValue || ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleEngagementChange(s, e.target.value);
                      }}
                      style={{
                        fontFamily: "inherit",
                        fontSize: 11,
                        padding: "1px 4px",
                        borderRadius: 4,
                        border: isEdited ? "1px solid #BA751766" : "1px solid transparent",
                        background: isEdited ? "#BA75170A" : "transparent",
                        color: isEdited ? "#BA7517" : engValue ? "var(--text-secondary)" : "var(--text-tertiary)",
                        cursor: "pointer",
                        fontStyle: engValue ? "normal" : "italic",
                        fontWeight: isEdited ? 500 : 400,
                        maxWidth: 200,
                        transition: "all 0.15s",
                      }}
                      onMouseOver={(e) => e.target.style.borderColor = isEdited ? "#BA7517" : "var(--border-mid)"}
                      onMouseOut={(e) => e.target.style.borderColor = isEdited ? "#BA751766" : "transparent"}
                    >
                      <option value="">No engagement</option>
                      {activities.filter((a) => !a.archived).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.customer} — {a.label || a.code}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {s.tags.map((t) => {
                    const info = getTagInfo(t);
                    return <Badge key={t} {...info} />;
                  })}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {actual}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  /{s.total_hours}h
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            No solutions match filters
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
            <i className="ti ti-briefcase" style={{ fontSize: 14, marginRight: 6 }} />
            {Object.keys(engagementEdits).length} engagement{Object.keys(engagementEdits).length !== 1 ? "s" : ""} changed
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
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
