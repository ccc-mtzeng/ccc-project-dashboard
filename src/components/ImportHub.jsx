import { useState } from "react";
import SolutionUpload from "./SolutionUpload";
import TimeEntryImport from "./TimeEntryImport";

// ─── Import hub ─────────────────────────────────────────────────────
// Single landing page for everything that brings data into the
// tracker: solution design documents and Kantata time CSVs.

const cardStyle = {
  flex: 1,
  minWidth: 240,
  border: "0.5px solid var(--border-light)",
  borderRadius: "var(--radius-lg)",
  padding: "20px 18px",
  cursor: "pointer",
  background: "transparent",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "border-color 0.15s",
};

export default function ImportHub({
  workerUrl,
  solutions,
  activities,
  onSolutionSaved,
  onEntriesImported,
  initialMode = null,
}) {
  const [mode, setMode] = useState(initialMode); // null | "design" | "csv"

  if (mode === "design") {
    return (
      <div>
        <BackToHub onClick={() => setMode(null)} />
        <SolutionUpload
          workerUrl={workerUrl}
          onSaved={onSolutionSaved}
          solutions={solutions}
        />
      </div>
    );
  }

  if (mode === "csv") {
    return (
      <TimeEntryImport
        activities={activities}
        onComplete={() => {
          setMode(null);
          if (onEntriesImported) onEntriesImported();
        }}
        onCancel={() => setMode(null)}
      />
    );
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
        Import
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18 }}>
        Bring data into the tracker.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setMode("design")}
          style={cardStyle}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--border-mid)")}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
        >
          <i className="ti ti-file-upload" style={{ fontSize: 22, color: "var(--text-secondary)", display: "block", marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Solution design
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Parse a solution design PDF or JSON into a tracked solution
            with tasks and estimates.
          </div>
        </button>

        <button
          onClick={() => setMode("csv")}
          style={cardStyle}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--border-mid)")}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
        >
          <i className="ti ti-table-import" style={{ fontSize: 22, color: "var(--text-secondary)", display: "block", marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            Kantata time CSV
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Import weekly time entries with correction netting, backfill,
            and de-duplication.
          </div>
        </button>
      </div>
    </div>
  );
}

function BackToHub({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", color: "var(--text-secondary)",
        cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
      }}
    >
      <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
      Back to import
    </button>
  );
}
