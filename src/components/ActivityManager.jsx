import { useState } from "react";
import SaveBar from "./shared/SaveBar";

// ─── ActivityManager — manage Kantata activity (engagement) records ──
// Lives under the Engagements view; engagements are edited where
// they're browsed.

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

export default function ActivityManager({ activities, onSave, onBack }) {
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
        Back to engagements
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 12px" }}>
        Engagement activities
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
        <SaveBar
          icon="ti-pencil"
          label="Unsaved activity changes"
          saving={saving}
          saveLabel="Save activities"
          onDiscard={() => setList(activities)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
