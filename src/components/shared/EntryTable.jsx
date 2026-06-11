import { formatDate } from "../../data/utils";

// ─── Shared time-entry table ───────────────────────────────────────
// One implementation for the Time Entries hub and EngagementDetail.
//
// Props:
//   entries            visible entries, sorted desc by date
//   activities         activity list (for engagement column)
//   allEntries         full entry list (to resolve split parents)
//   getTag(entry)      effective solution_id (incl. staged edits)
//   setTag(id, sid)    stage a tag edit
//   tagEdits           { entryId: solutionId | null }
//   linkedSolutionsFor(entry)  solutions taggable for this entry
//   onSplit(entry)     open split modal for a root entry
//   showEngagement     include the engagement column
//   totalHours         footer total
//   emptyMessage       shown when entries is empty

const selectStyle = {
  fontFamily: "inherit",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-light)",
  cursor: "pointer",
};

const iconBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-tertiary)", fontSize: 13, padding: 2,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export default function EntryTable({
  entries,
  activities,
  allEntries,
  getTag,
  setTag,
  tagEdits,
  linkedSolutionsFor,
  onSplit,
  showEngagement = false,
  totalHours = 0,
  emptyMessage = "No time entries.",
}) {
  const cols = showEngagement
    ? "82px minmax(100px, 1fr) minmax(120px, 2fr) 160px 56px 32px"
    : "90px minmax(120px, 2fr) 180px 60px 32px";

  // Group by date, newest first; date shown only on the first row of a day
  const grouped = (() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  if (entries.length === 0) {
    return (
      <div style={{ padding: "20px 14px", fontSize: 13, color: "var(--text-secondary)", textAlign: "center", border: "0.5px solid var(--border-light)", borderRadius: "var(--radius-lg)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{
      border: "0.5px solid var(--border-light)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: cols,
        padding: "8px 14px",
        background: "var(--bg-secondary)",
        fontSize: 11, fontWeight: 500, color: "var(--text-secondary)",
        textTransform: "uppercase", letterSpacing: "0.03em",
      }}>
        <span>Date</span>
        {showEngagement && <span>Engagement</span>}
        <span>Notes</span>
        <span>Solution</span>
        <span style={{ textAlign: "right" }}>Hours</span>
        <span />
      </div>

      {/* Rows */}
      {grouped.map(([date, dayEntries]) =>
        dayEntries.map((entry, idx) => {
          const tagValue = getTag(entry);
          const isEdited = entry.id in tagEdits;
          const isChild = !!entry.parent_id;
          const parentEntry = isChild ? allEntries.find((e) => e.id === entry.parent_id) : null;
          const act = activities.find((a) => a.id === entry.activity_id);
          const linked = linkedSolutionsFor(entry);

          return (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
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
              {showEngagement && (
                <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {act ? act.customer : "—"}
                </span>
              )}

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

              {/* Solution tag — or a hint when the engagement has no linked solutions */}
              <span>
                {linked.length > 0 ? (
                  <select
                    value={tagValue || ""}
                    onChange={(e) => setTag(entry.id, e.target.value || null)}
                    style={{
                      ...selectStyle,
                      background: tagValue ? "#185FA508" : "var(--bg-primary)",
                      color: tagValue ? "#185FA5" : "var(--text-secondary)",
                      fontWeight: tagValue ? 500 : 400,
                      maxWidth: 160,
                      width: "100%",
                    }}
                  >
                    <option value="">— Untagged —</option>
                    {linked.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                ) : (
                  <span
                    title="Link a solution to this engagement first (Engagements view or solution header), then it becomes taggable here."
                    style={{
                      fontSize: 10, color: "var(--text-tertiary)", fontStyle: "italic",
                      display: "inline-flex", alignItems: "center", gap: 3, cursor: "help",
                    }}
                  >
                    <i className="ti ti-link-off" style={{ fontSize: 11 }} />
                    No linked solutions
                  </span>
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
                    onClick={() => parentEntry && onSplit(parentEntry)}
                    title="Edit split"
                    style={iconBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  >
                    <i className="ti ti-edit" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSplit(entry)}
                    title="Split entry"
                    style={iconBtn}
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
        gridTemplateColumns: cols,
        padding: "10px 14px",
        borderTop: "1.5px solid var(--border-mid)",
        fontSize: 13, fontWeight: 500,
      }}>
        <span style={{ color: "var(--text-primary)" }}>Total</span>
        {showEngagement && <span />}
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
          {entries.length} entries
        </span>
        <span />
        <span style={{ textAlign: "right", color: "var(--text-primary)" }}>{totalHours}h</span>
        <span />
      </div>
    </div>
  );
}
