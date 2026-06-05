import { useState, useEffect, useMemo } from "react";
import Badge from "./shared/Badge";
import ProgressBar from "./shared/ProgressBar";
import StatCard from "./shared/StatCard";
import { STATUS_CONFIG, TASK_STATUS, CATEGORY_COLORS } from "../data/constants";
import { getTagInfo } from "../data/taxonomy";
import { daysUntil } from "../data/utils";

const miniInputStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  textAlign: "right",
  width: 52,
  boxSizing: "border-box",
  fontWeight: 500,
};

const miniSelectStyle = {
  fontFamily: "inherit",
  fontSize: 11,
  padding: "3px 4px",
  borderRadius: 4,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  cursor: "pointer",
  fontWeight: 500,
};

const miniDateStyle = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
  fontWeight: 500,
  cursor: "pointer",
};

export default function SolutionDetail({ solution, onBack, onSave }) {
  // Editable draft — resets when solution prop changes
  const [draft, setDraft] = useState(structuredClone(solution));
  const [showExcludeForm, setShowExcludeForm] = useState(false);
  const [excludeNote, setExcludeNote] = useState(solution.excluded_note || "");
  const [saving, setSaving] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  useEffect(() => {
    setDraft(structuredClone(solution));
    setShowExcludeForm(false);
    setExcludeNote(solution.excluded_note || "");
    setExpandedTasks(new Set());
  }, [solution.id]);

  // Dirty detection
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(solution),
    [draft, solution]
  );

  const sc = STATUS_CONFIG[draft.status] || STATUS_CONFIG.draft;
  const actual = draft.tasks.reduce((a, t) => a + (Number(t.actual_hours) || 0), 0);

  // ── Edit helpers ──

  function updateDraft(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function updateTask(idx, field, value) {
    setDraft((d) => {
      const tasks = [...d.tasks];
      tasks[idx] = { ...tasks[idx], [field]: value };
      return { ...d, tasks };
    });
  }

  function discardChanges() {
    setDraft(structuredClone(solution));
  }

  function toggleTask(idx) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function handleSaveChanges() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  // ── Exclude / restore ──

  async function handleExclude() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ ...draft, excluded: true, excluded_note: excludeNote.trim() });
      setShowExcludeForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ ...draft, excluded: false, excluded_note: "" });
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
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" />
        Back to solutions
      </button>

      {/* Excluded banner */}
      {draft.excluded && (
        <div
          style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13,
            color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <i className="ti ti-eye-off" style={{ fontSize: 15 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 500 }}>Excluded from dashboard</span>
            {draft.excluded_note && <span> — {draft.excluded_note}</span>}
          </div>
          <button
            onClick={handleRestore} disabled={saving}
            style={{
              fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent",
              color: "var(--text-primary)", cursor: "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            Restore
          </button>
        </div>
      )}

      {/* Title + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2
          style={{
            fontSize: 20, fontWeight: 500, margin: 0,
            color: draft.excluded ? "var(--text-secondary)" : "var(--text-primary)",
          }}
        >
          {draft.title}
        </h2>
        {/* Editable status */}
        <select
          value={draft.status}
          onChange={(e) => updateDraft("status", e.target.value)}
          style={{
            ...miniSelectStyle,
            color: sc.color,
            background: sc.bg,
            borderColor: sc.bg,
            fontSize: 12,
            padding: "3px 8px",
            borderRadius: 99,
          }}
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {draft.version && draft.version !== "1.0" && (
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
            v{draft.version}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 13, color: "var(--text-secondary)", marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <span>
          {draft.customer} · v{draft.version} · {draft.author}
        </span>
        {!draft.excluded && onSave && (
          <button
            onClick={() => setShowExcludeForm(!showExcludeForm)}
            style={{
              fontFamily: "inherit", fontSize: 12, padding: "3px 8px", borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <i className="ti ti-eye-off" style={{ fontSize: 13 }} />
            Exclude
          </button>
        )}
      </div>

      {/* Editable dates */}
      <div
        style={{
          display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Created
          </span>
          <input
            type="date"
            value={draft.date_created || ""}
            onChange={(e) => updateDraft("date_created", e.target.value)}
            style={miniDateStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Go-live
          </span>
          <input
            type="date"
            value={draft.go_live_date || ""}
            onChange={(e) => updateDraft("go_live_date", e.target.value)}
            style={{
              ...miniDateStyle,
              borderColor: draft.go_live_date && daysUntil(draft.go_live_date).includes("ago")
                ? "rgba(226,75,74,0.5)" : "var(--border-light)",
            }}
          />
          {draft.go_live_date && (
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: daysUntil(draft.go_live_date).includes("ago") ? "#E24B4A" : "var(--text-secondary)",
            }}>
              {daysUntil(draft.go_live_date)}
            </span>
          )}
        </div>
      </div>

      {/* Exclude form */}
      {showExcludeForm && (
        <div
          style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
            borderRadius: 8, padding: 14, marginBottom: 16,
            display: "flex", gap: 8, alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "block",
            }}>Reason (optional)</label>
            <input
              style={{
                fontFamily: "inherit", fontSize: 13, padding: "7px 10px", borderRadius: 6,
                border: "1px solid var(--border-light)", background: "var(--bg-primary)",
                color: "var(--text-primary)", width: "100%", boxSizing: "border-box",
              }}
              placeholder="e.g. Superseded by v2, cancelled, duplicate…"
              value={excludeNote}
              onChange={(e) => setExcludeNote(e.target.value)}
            />
          </div>
          <button onClick={handleExclude} disabled={saving} style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            padding: "8px 14px", borderRadius: 6, border: "none",
            background: "var(--text-primary)", color: "var(--bg-primary)",
            cursor: "pointer", whiteSpace: "nowrap", opacity: saving ? 0.5 : 1,
          }}>Confirm exclude</button>
          <button onClick={() => setShowExcludeForm(false)} style={{
            fontFamily: "inherit", fontSize: 13, padding: "8px 10px", borderRadius: 6,
            border: "1px solid var(--border-light)", background: "transparent",
            color: "var(--text-secondary)", cursor: "pointer",
          }}>Cancel</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 18 }}>
        {draft.tags.map((t) => {
          const info = getTagInfo(t);
          return <Badge key={t} {...info} />;
        })}
      </div>

      {/* Design document link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <i className="ti ti-file-text" style={{ fontSize: 15, color: "var(--text-secondary)", flexShrink: 0 }} />
        <input
          value={draft.design_url || ""}
          onChange={(e) => updateDraft("design_url", e.target.value)}
          placeholder="Paste link to solution design document…"
          style={{
            fontFamily: "inherit", fontSize: 12, padding: "5px 8px", borderRadius: 6,
            border: "1px solid var(--border-light)", background: "var(--bg-primary)",
            color: "var(--text-primary)", flex: 1, boxSizing: "border-box",
          }}
        />
        {draft.design_url && (
          <a
            href={draft.design_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: "inherit", fontSize: 12, padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border-light)", background: "transparent",
              color: "var(--text-primary)", textDecoration: "none", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <i className="ti ti-external-link" style={{ fontSize: 13 }} />
            Open
          </a>
        )}
      </div>

      {/* Editable notes */}
      <textarea
        value={draft.notes || ""}
        onChange={(e) => updateDraft("notes", e.target.value)}
        placeholder="Notes…"
        style={{
          fontFamily: "inherit", fontSize: 13, color: "var(--text-secondary)",
          marginBottom: 18, padding: "10px 14px", background: "var(--bg-secondary)",
          borderRadius: "var(--radius-md)", lineHeight: 1.6, width: "100%",
          boxSizing: "border-box", border: "1px solid var(--border-light)",
          resize: "vertical", minHeight: 40,
        }}
      />

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="clock" label="Estimated" value={`${draft.total_hours}h`} />
        <StatCard
          icon="player-play" label="Actual"
          value={`${actual}h`}
          valueColor={actual > draft.total_hours && draft.total_hours > 0 ? "#E24B4A" : undefined}
        />
        <StatCard
          icon="percentage"
          label="Progress"
          value={`${draft.total_hours ? Math.round((actual / draft.total_hours) * 100) : 0}%`}
          valueColor={actual > draft.total_hours && draft.total_hours > 0 ? "#E24B4A" : undefined}
        />
        <StatCard
          icon="plus-minus"
          label="Variance"
          value={`${actual - draft.total_hours > 0 ? "+" : ""}${(actual - draft.total_hours).toFixed(1)}h`}
          valueColor={actual > draft.total_hours ? "#E24B4A" : actual < draft.total_hours ? "#1D9E75" : undefined}
        />
      </div>

      {/* Task table — editable actual_hours and status */}
      <div
        style={{
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 80px 90px 60px 70px 100px",
            padding: "8px 14px",
            background: "var(--bg-secondary)",
            fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.03em",
          }}
        >
          <span />
          <span>Task</span>
          <span>Category</span>
          <span>Due</span>
          <span style={{ textAlign: "right" }}>Est.</span>
          <span style={{ textAlign: "right" }}>Actual</span>
          <span style={{ textAlign: "right" }}>Status</span>
        </div>

        {draft.tasks.map((t, i) => {
          const ts = TASK_STATUS[t.status] || TASK_STATUS.not_started;
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          const over = (Number(t.actual_hours) || 0) > t.estimated_hours && t.estimated_hours > 0;
          const variance = (Number(t.actual_hours) || 0) - t.estimated_hours;
          const isExpanded = expandedTasks.has(i);
          const hasNote = !!t.note;
          const isOverdue = t.due_date && new Date(t.due_date + "T00:00:00") < new Date() && t.status !== "complete";
          return (
            <div key={i} style={{ borderTop: "0.5px solid var(--border-light)" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 80px 90px 60px 70px 100px",
                  padding: "8px 14px",
                  alignItems: "center",
                  fontSize: 13,
                  background: over ? "rgba(226,75,74,0.04)" : "transparent",
                }}
              >
                <button
                  onClick={() => toggleTask(i)}
                  title={isExpanded ? "Collapse note" : "Add/view note"}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: hasNote ? "var(--text-primary)" : "var(--text-secondary)",
                    opacity: hasNote ? 1 : 0.4,
                    fontSize: 14, display: "flex", alignItems: "center",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = hasNote ? 1 : 0.4; }}
                >
                  <i className={isExpanded ? "ti ti-chevron-down" : hasNote ? "ti ti-note" : "ti ti-chevron-right"} />
                </button>
                <span style={{ color: "var(--text-primary)", fontWeight: 450, display: "flex", alignItems: "center", gap: 6 }}>
                  {t.name}
                  {over && (
                    <span style={{ fontSize: 11, color: "#E24B4A", fontWeight: 500 }}>
                      +{variance.toFixed(1)}h
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: catColor, textTransform: "capitalize" }}>
                  {t.category}
                </span>
                <span>
                  <input
                    type="date"
                    value={t.due_date || ""}
                    onChange={(e) => updateTask(i, "due_date", e.target.value)}
                    style={{
                      ...miniDateStyle,
                      fontSize: 11,
                      padding: "2px 4px",
                      width: 82,
                      color: isOverdue ? "#E24B4A" : "var(--text-primary)",
                      borderColor: isOverdue ? "rgba(226,75,74,0.5)" : "var(--border-light)",
                    }}
                  />
                </span>
                <span style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                  {t.estimated_hours}h
                </span>
                <span style={{ textAlign: "right" }}>
                  <HourInput
                    value={t.actual_hours}
                    onChange={(val) => updateTask(i, "actual_hours", val)}
                    style={{
                      ...miniInputStyle,
                      color: over ? "#E24B4A" : "var(--text-primary)",
                      borderColor: over ? "rgba(226,75,74,0.4)" : "var(--border-light)",
                    }}
                  />
                </span>
                <span style={{ textAlign: "right" }}>
                  <select
                    value={t.status}
                    onChange={(e) => updateTask(i, "status", e.target.value)}
                    style={{
                      ...miniSelectStyle,
                      color: ts.color,
                    }}
                  >
                    {Object.entries(TASK_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </span>
              </div>
              {/* Expandable note */}
              {isExpanded && (
                <div style={{ padding: "0 14px 10px 38px" }}>
                  <textarea
                    value={t.note || ""}
                    onChange={(e) => updateTask(i, "note", e.target.value)}
                    placeholder="Status note… (e.g. waiting on client UAT, blocked by sandbox refresh)"
                    style={{
                      fontFamily: "inherit", fontSize: 12, color: "var(--text-secondary)",
                      padding: "7px 10px", background: "var(--bg-secondary)",
                      borderRadius: 6, lineHeight: 1.5, width: "100%",
                      boxSizing: "border-box", border: "1px solid var(--border-light)",
                      resize: "vertical", minHeight: 32,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Totals row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 80px 90px 60px 70px 100px",
            padding: "10px 14px",
            borderTop: "1.5px solid var(--border-mid)",
            fontSize: 13, fontWeight: 500,
          }}
        >
          <span />
          <span style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
            Total
            {actual > draft.total_hours && draft.total_hours > 0 && (
              <span style={{ fontSize: 11, color: "#E24B4A", fontWeight: 500 }}>
                +{(actual - draft.total_hours).toFixed(1)}h over
              </span>
            )}
          </span>
          <span />
          <span />
          <span style={{ textAlign: "right", color: "var(--text-secondary)" }}>
            {draft.total_hours}h
          </span>
          <span style={{ textAlign: "right", color: actual > draft.total_hours ? "#E24B4A" : "var(--text-primary)" }}>
            {actual}h
          </span>
          <span />
        </div>
      </div>

      {/* Hours breakdown bars */}
      <div
        style={{
          marginTop: 18,
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: "var(--text-primary)" }}>
          Hours breakdown
        </div>
        {draft.tasks.map((t, i) => {
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          const taskActual = Number(t.actual_hours) || 0;
          const over = taskActual > t.estimated_hours && t.estimated_hours > 0;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-secondary)" }}>{t.name}</span>
                <span style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: over ? "#E24B4A" : "var(--text-primary)" }}>
                    {taskActual}/{t.estimated_hours}h
                  </span>
                  {over && (
                    <span style={{ fontSize: 10, color: "#E24B4A" }}>
                      +{(taskActual - t.estimated_hours).toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
              <ProgressBar
                value={taskActual}
                max={t.estimated_hours}
                color={catColor}
                height={5}
              />
            </div>
          );
        })}
      </div>

      {/* Save bar — appears when changes are made */}
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
            <i className="ti ti-pencil" style={{ fontSize: 14, marginRight: 6 }} />
            Unsaved changes
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
              onClick={handleSaveChanges}
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
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hour input with proper zero/empty handling ──────────────────────

function HourInput({ value, onChange, style }) {
  const [text, setText] = useState(value == null || value === 0 ? "" : String(value));

  // Sync from parent when the solution resets (e.g. navigating to a different one)
  useEffect(() => {
    setText(value == null || value === 0 ? "" : String(value));
  }, [value]);

  function handleChange(e) {
    const raw = e.target.value;
    // Allow empty, digits, and one decimal point
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setText(raw);
      // Update parent live so stats reflect as you type
      onChange(raw === "" ? 0 : Number(raw) || 0);
    }
  }

  function handleBlur() {
    // Normalize: empty → show empty (value is 0), otherwise clean number
    const num = text === "" ? 0 : Number(text) || 0;
    onChange(num);
    setText(num === 0 ? "" : String(num));
  }

  function handleFocus(e) {
    // Select all on focus for easy replacement
    e.target.select();
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder="0"
      style={style}
    />
  );
}