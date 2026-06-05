import { useState, useEffect, useMemo } from "react";
import Badge from "./shared/Badge";
import ProgressBar from "./shared/ProgressBar";
import StatCard from "./shared/StatCard";
import { STATUS_CONFIG, TASK_STATUS, CATEGORY_COLORS } from "../data/constants";
import { getTagInfo } from "../data/taxonomy";
import { daysUntil, newNoteId, relativeTime } from "../data/utils";

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

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

export default function SolutionDetail({ solution, onBack, onSave, username, activities = [] }) {
  const [draft, setDraft] = useState(structuredClone(solution));
  const [showExcludeForm, setShowExcludeForm] = useState(false);
  const [excludeNote, setExcludeNote] = useState(solution.excluded_note || "");
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    setDraft(structuredClone(solution));
    setShowExcludeForm(false);
    setExcludeNote(solution.excluded_note || "");
  }, [solution.id]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(solution),
    [draft, solution]
  );

  const sc = STATUS_CONFIG[draft.status] || STATUS_CONFIG.draft;

  // Weighted overall progress from percent_complete
  const overallProgress = useMemo(() => {
    const tasks = draft.tasks;
    if (!tasks.length) return 0;
    const totalEst = tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0);
    if (totalEst > 0) {
      return Math.round(
        tasks.reduce((s, t) => s + (t.percent_complete || 0) * (t.estimated_hours || 0), 0) / totalEst
      );
    }
    return Math.round(tasks.reduce((s, t) => s + (t.percent_complete || 0), 0) / tasks.length);
  }, [draft.tasks]);

  const completedCount = draft.tasks.filter((t) => t.status === "complete").length;

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

  function addNote() {
    const text = noteText.trim();
    if (!text) return;
    const note = {
      id: newNoteId(),
      author: username || "unknown",
      created_at: new Date().toISOString(),
      text,
    };
    setDraft((d) => ({
      ...d,
      notes_log: [note, ...(d.notes_log || [])],
    }));
    setNoteText("");
  }

  function deleteNote(noteId) {
    setDraft((d) => ({
      ...d,
      notes_log: (d.notes_log || []).filter((n) => n.id !== noteId),
    }));
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

  // Linked activity display
  const linkedActivity = activities.find((a) => a.id === draft.activity_id);

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
              ...labelStyle,
              marginBottom: 4, display: "block",
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

      {/* Editable dates + engagement */}
      <div
        style={{
          display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={labelStyle}>Created</span>
          <input
            type="date"
            value={draft.date_created || ""}
            onChange={(e) => updateDraft("date_created", e.target.value)}
            style={miniDateStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={labelStyle}>Go-live</span>
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

      {/* Engagement link */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span style={labelStyle}>Engagement</span>
        <select
          value={draft.activity_id || ""}
          onChange={(e) => updateDraft("activity_id", e.target.value || null)}
          style={{
            ...miniSelectStyle,
            fontSize: 12,
            padding: "4px 8px",
            maxWidth: 360,
          }}
        >
          <option value="">— None —</option>
          {activities.filter((a) => !a.archived).map((a) => (
            <option key={a.id} value={a.id}>
              {a.customer} — {a.label || a.code}
            </option>
          ))}
        </select>
        {linkedActivity && (
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {linkedActivity.id.toUpperCase()}
          </span>
        )}
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

      {/* Stats row — progress-focused */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="percentage" label="Progress" value={`${overallProgress}%`} />
        <StatCard
          icon="list-check"
          label="Tasks"
          value={`${completedCount}/${draft.tasks.length}`}
          sub={completedCount === draft.tasks.length && draft.tasks.length > 0 ? "All complete" : undefined}
        />
        <StatCard icon="clock" label="Estimated" value={`${draft.total_hours}h`} sub="from solution design" />
      </div>

      {/* Task table — % complete + status focused */}
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
            gridTemplateColumns: "1fr 80px 90px 80px 100px",
            padding: "8px 14px",
            background: "var(--bg-secondary)",
            fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.03em",
          }}
        >
          <span>Task</span>
          <span>Category</span>
          <span>Due</span>
          <span style={{ textAlign: "right" }}>% Done</span>
          <span style={{ textAlign: "right" }}>Status</span>
        </div>

        {draft.tasks.map((t, i) => {
          const ts = TASK_STATUS[t.status] || TASK_STATUS.not_started;
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          const pct = t.percent_complete || 0;
          const isOverdue = t.due_date && new Date(t.due_date + "T00:00:00") < new Date() && t.status !== "complete";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 90px 80px 100px",
                padding: "8px 14px",
                borderTop: "0.5px solid var(--border-light)",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 450, display: "flex", alignItems: "center", gap: 6 }}>
                {t.name}
                {t.estimated_hours > 0 && (
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 400 }}>
                    {t.estimated_hours}h est
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
              <span style={{ textAlign: "right" }}>
                <PercentInput
                  value={pct}
                  onChange={(val) => updateTask(i, "percent_complete", val)}
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
          );
        })}

        {/* Totals row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 90px 80px 100px",
            padding: "10px 14px",
            borderTop: "1.5px solid var(--border-mid)",
            fontSize: 13, fontWeight: 500,
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>
            Overall
          </span>
          <span />
          <span />
          <span style={{ textAlign: "right", color: "var(--text-primary)" }}>
            {overallProgress}%
          </span>
          <span style={{ textAlign: "right", fontSize: 11, color: "var(--text-secondary)" }}>
            {completedCount}/{draft.tasks.length} done
          </span>
        </div>
      </div>

      {/* Progress breakdown bars */}
      <div
        style={{
          marginTop: 18,
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, color: "var(--text-primary)" }}>
          Progress
        </div>
        {draft.tasks.map((t, i) => {
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          const pct = t.percent_complete || 0;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-secondary)" }}>{t.name}</span>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {pct}%
                </span>
              </div>
              <ProgressBar
                value={pct}
                max={100}
                color={catColor}
                height={5}
              />
            </div>
          );
        })}
      </div>

      {/* Activity / Notes log */}
      <div
        style={{
          marginTop: 18,
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--text-primary)" }}>
          Activity
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); } }}
            placeholder="Add a status note…"
            style={{
              fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--border-light)", background: "var(--bg-primary)",
              color: "var(--text-primary)", flex: 1, boxSizing: "border-box",
            }}
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim()}
            style={{
              fontFamily: "inherit", fontSize: 12, fontWeight: 500,
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: noteText.trim() ? "var(--text-primary)" : "var(--bg-secondary)",
              color: noteText.trim() ? "var(--bg-primary)" : "var(--text-secondary)",
              cursor: noteText.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 4,
              transition: "all 0.15s",
            }}
          >
            <i className="ti ti-send" style={{ fontSize: 13 }} />
            Post
          </button>
        </div>

        {(draft.notes_log || []).length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "8px 0" }}>
            No activity yet. Add a note to track progress.
          </div>
        )}
        {(draft.notes_log || []).map((note) => (
          <div
            key={note.id}
            style={{
              padding: "10px 0",
              borderTop: "0.5px solid var(--border-light)",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 26, height: 26, borderRadius: 99,
                background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
                flexShrink: 0, textTransform: "uppercase",
              }}
            >
              {(note.author || "?")[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                  {note.author}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {relativeTime(note.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {note.text}
              </div>
            </div>
            {note.author === username && (
              <button
                onClick={() => deleteNote(note.id)}
                title="Delete note"
                style={{
                  background: "none", border: "none", padding: 2, cursor: "pointer",
                  color: "var(--text-secondary)", opacity: 0.4, fontSize: 13,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#E24B4A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <i className="ti ti-trash" />
              </button>
            )}
          </div>
        ))}
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

// ─── Percent input (0–100) ─────────────────────────────────────────

function PercentInput({ value, onChange }) {
  const [text, setText] = useState(value == null || value === 0 ? "" : String(value));

  useEffect(() => {
    setText(value == null || value === 0 ? "" : String(value));
  }, [value]);

  function handleChange(e) {
    const raw = e.target.value;
    if (raw === "" || /^\d{0,3}$/.test(raw)) {
      setText(raw);
      const num = raw === "" ? 0 : Math.min(100, Number(raw) || 0);
      onChange(num);
    }
  }

  function handleBlur() {
    const num = text === "" ? 0 : Math.min(100, Number(text) || 0);
    onChange(num);
    setText(num === 0 ? "" : String(num));
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        placeholder="0"
        style={{
          fontFamily: "inherit",
          fontSize: 13,
          padding: "3px 4px",
          borderRadius: 4,
          border: "1px solid var(--border-light)",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          textAlign: "right",
          width: 38,
          boxSizing: "border-box",
          fontWeight: 500,
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>%</span>
    </div>
  );
}
