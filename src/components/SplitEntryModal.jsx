import { useState, useMemo } from "react";
import { newEntryId } from "../data/utils";

/**
 * Modal to split a combined time entry into multiple sub-entries.
 *
 * Props:
 *   entry          — the parent entry to split
 *   existingChildren — any existing child entries (for editing a previous split)
 *   solutions      — linked solutions for optional tagging
 *   onSave(children[]) — called with the full set of child entries to persist
 *   onUnsplit()     — called to remove all children and restore the parent
 *   onClose()       — close modal
 */

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

export default function SplitEntryModal({ entry, existingChildren, solutions = [], onSave, onUnsplit, onClose }) {
  const [rows, setRows] = useState(() => {
    if (existingChildren.length > 0) {
      return existingChildren.map((c) => ({
        id: c.id,
        notes: c.notes || "",
        hours: c.hours,
        solution_id: c.solution_id || null,
        task_category: c.task_category || "",
      }));
    }
    // Pre-populate from semicolon-delimited notes
    const parts = (entry.notes || "")
      .split(/;\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const perPart = Math.round((entry.hours / parts.length) * 100) / 100;
      return parts.map((text) => ({
        id: newEntryId(),
        notes: text,
        hours: perPart,
        solution_id: null,
        task_category: "",
      }));
    }
    return [
      { id: newEntryId(), notes: "", hours: entry.hours, solution_id: null, task_category: "" },
      { id: newEntryId(), notes: "", hours: 0, solution_id: null, task_category: "" },
    ];
  });

  const [saving, setSaving] = useState(false);

  const totalChildHours = useMemo(
    () => Math.round(rows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0) * 100) / 100,
    [rows]
  );

  const remainder = Math.round((entry.hours - totalChildHours) * 100) / 100;
  const isBalanced = Math.abs(remainder) < 0.01;

  function updateRow(idx, field, value) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: newEntryId(),
        notes: "",
        hours: Math.max(0, remainder),
        solution_id: null,
        task_category: "",
      },
    ]);
  }

  function removeRow(idx) {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!isBalanced) return;
    const validRows = rows.filter((r) => (parseFloat(r.hours) || 0) > 0);
    if (validRows.length < 2) return;

    setSaving(true);
    const children = validRows.map((r) => ({
      id: r.id,
      parent_id: entry.id,
      activity_id: entry.activity_id,
      date: entry.date,
      end_date: entry.end_date || entry.date,
      hours: parseFloat(r.hours) || 0,
      notes: r.notes,
      solution_id: r.solution_id,
      task_category: r.task_category || entry.task_category || "",
      engagement_task: entry.engagement_task,
      source: entry.source || "kantata",
      submitted: entry.submitted,
    }));
    onSave(children);
  }

  const hasExisting = existingChildren.length > 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          width: 560,
          maxWidth: "95vw",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
              {hasExisting ? "Edit split" : "Split entry"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Partition {entry.hours}h into separate entries
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", fontSize: 18, padding: 2,
              display: "flex", alignItems: "center",
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Parent entry info */}
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              {entry.date} · {entry.engagement_task || "No task"}
            </span>
            <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{entry.hours}h</span>
          </div>
          <div style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {entry.notes || "—"}
          </div>
        </div>

        {/* Split rows */}
        <div style={{ marginBottom: 14 }}>
          {rows.map((row, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "8px 0",
                borderTop: idx > 0 ? "0.5px solid var(--border-light)" : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={row.notes}
                  onChange={(e) => updateRow(idx, "notes", e.target.value)}
                  placeholder="Description…"
                  style={{ ...inputStyle, width: "100%", marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  {solutions.length > 0 && (
                    <select
                      value={row.solution_id || ""}
                      onChange={(e) => updateRow(idx, "solution_id", e.target.value || null)}
                      style={{
                        ...inputStyle,
                        fontSize: 11,
                        padding: "4px 6px",
                        flex: 1,
                        color: row.solution_id ? "#185FA5" : "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">— Solution —</option>
                      {solutions.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  )}
                  <input
                    value={row.task_category}
                    onChange={(e) => updateRow(idx, "task_category", e.target.value)}
                    placeholder="Category"
                    style={{ ...inputStyle, fontSize: 11, padding: "4px 6px", width: 100 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={row.hours}
                  onChange={(e) => updateRow(idx, "hours", e.target.value)}
                  style={{ ...inputStyle, width: 70, textAlign: "right", fontWeight: 500 }}
                />
                {rows.length > 2 && (
                  <button
                    onClick={() => removeRow(idx)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-secondary)", fontSize: 13, padding: "2px 4px",
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#E24B4A"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >
                    <i className="ti ti-trash" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add row + balance indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            onClick={addRow}
            style={{
              fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              padding: "5px 12px", borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Add row
          </button>

          <div style={{
            fontSize: 13, fontWeight: 500,
            color: isBalanced ? "#1D9E75" : "#E24B4A",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {isBalanced ? (
              <>
                <i className="ti ti-check" style={{ fontSize: 14 }} />
                {totalChildHours}h balanced
              </>
            ) : (
              <>
                <i className="ti ti-alert-triangle" style={{ fontSize: 14 }} />
                {totalChildHours}h / {entry.hours}h
                <span style={{ fontSize: 11, fontWeight: 400 }}>
                  ({remainder > 0 ? `${remainder}h remaining` : `${Math.abs(remainder)}h over`})
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div>
            {hasExisting && onUnsplit && (
              <button
                onClick={onUnsplit}
                style={{
                  fontFamily: "inherit", fontSize: 12,
                  padding: "7px 12px", borderRadius: 6,
                  border: "1px solid var(--border-light)", background: "transparent",
                  color: "#E24B4A", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <i className="ti ti-arrow-merge-both" style={{ fontSize: 14 }} />
                Unsplit
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                fontFamily: "inherit", fontSize: 13, padding: "7px 14px",
                borderRadius: 6, border: "1px solid var(--border-light)",
                background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isBalanced || saving}
              style={{
                fontFamily: "inherit", fontSize: 13, fontWeight: 500,
                padding: "7px 16px", borderRadius: 6, border: "none",
                background: isBalanced ? "var(--text-primary)" : "var(--bg-secondary)",
                color: isBalanced ? "var(--bg-primary)" : "var(--text-secondary)",
                cursor: isBalanced ? "pointer" : "default",
                display: "flex", alignItems: "center", gap: 4,
                opacity: saving ? 0.5 : 1,
              }}
            >
              <i className="ti ti-scissors" style={{ fontSize: 14 }} />
              {saving ? "Saving…" : hasExisting ? "Update split" : "Split entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
