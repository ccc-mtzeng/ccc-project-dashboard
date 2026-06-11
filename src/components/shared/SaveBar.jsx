// ─── Sticky save bar ───────────────────────────────────────────────
// Shared batch-save bar used by SolutionDetail, SolutionList,
// Time Entries, EngagementDetail, and ActivityManager.

export default function SaveBar({
  icon = "ti-pencil",
  label = "Unsaved changes",
  saving = false,
  saveLabel = "Save changes",
  onDiscard,
  onSave,
}) {
  return (
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
        <i className={`ti ${icon}`} style={{ fontSize: 14, marginRight: 6 }} />
        {label}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDiscard}
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
          onClick={onSave}
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
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
