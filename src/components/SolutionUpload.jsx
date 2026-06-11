import { useState, useRef } from "react";
import { TAG_TAXONOMY } from "../data/taxonomy";
import { STATUS_CONFIG, STATUS_ORDER, CATEGORY_COLORS, normalizeStatus } from "../data/constants";
import { slugify, todayISO } from "../data/utils";
import { saveSolution } from "../services/github";

const TASK_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ─── PDF text extraction ─────────────────────────────────────────────
// Uses pdfjs-dist loaded from CDN to avoid bundling the 2 MB library.

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // dynamically import from CDN
  const src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs";
  const mod = await import(/* @vite-ignore */ src);
  mod.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs";
  pdfjsLib = mod;
  return mod;
}

async function extractTextFromPDF(file) {
  const lib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
}

// ─── Styles ──────────────────────────────────────────────────────────

const cardStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-light)",
  borderRadius: 10,
  padding: 20,
};

const inputStyle = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
  display: "block",
};

const btnPrimary = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "var(--text-primary)",
  color: "var(--bg-primary)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnSecondary = {
  ...btnPrimary,
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-light)",
};

// ─── Component ───────────────────────────────────────────────────────

export default function SolutionUpload({ onSaved, workerUrl, solutions: existingSolutions = [] }) {
  const [stage, setStage] = useState("idle"); // idle | extracting | parsing | match | review | saving | done | error
  const [file, setFile] = useState(null);
  const [solution, setSolution] = useState(null);
  const [matchedExisting, setMatchedExisting] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ── File handling ──

  function handleFiles(files) {
    const f = files[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("PDF must be under 10 MB.");
      return;
    }
    setFile(f);
    setError("");
    processFile(f);
  }

  async function processFile(f) {
    try {
      // Step 1: Extract text client-side
      setStage("extracting");
      const text = await extractTextFromPDF(f);

      if (!text.trim()) {
        throw new Error(
          "Could not extract text from this PDF. It may be a scanned image — try a text-based PDF."
        );
      }

      // Step 2: Send text to worker for AI parsing
      setStage("parsing");
      const res = await fetch(`${workerUrl}/parse-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: f.name }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      // Generate ID from customer + title
      const sol = data.solution;
      sol.id = sol.id || slugify(`${sol.customer}-${sol.title}`);
      sol.date_created = sol.date_created || todayISO();
      sol.status = normalizeStatus(sol.status || "1.1");

      // Check for existing solution with same slug
      const existing = existingSolutions.find((s) => s.id === sol.id);
      if (existing) {
        setMatchedExisting(existing);
        setSolution(sol);
        setStage("match");
      } else {
        setSolution(sol);
        setStage("review");
      }
    } catch (err) {
      setError(err.message || "Failed to parse PDF");
      setStage("error");
    }
  }

  // ── Save to GitHub ──

  async function handleSave() {
    setStage("saving");
    setError("");

    try {
      // Recalculate total_hours from tasks
      const total = solution.tasks.reduce(
        (sum, t) => sum + (Number(t.estimated_hours) || 0),
        0
      );
      const final = { ...solution, total_hours: total };

      await saveSolution(final);
      setSolution(final);
      setStage("done");
      if (onSaved) onSaved(final);
    } catch (err) {
      setError(err.message || "Failed to save");
      setStage("review"); // back to review so they can retry
    }
  }

  // ── Reset ──

  function reset() {
    setStage("idle");
    setFile(null);
    setSolution(null);
    setMatchedExisting(null);
    setError("");
  }

  // ── Duplicate match handlers ──

  function handleUpdateExisting() {
    // Merge: keep existing actual_hours and task statuses, use new estimates/structure
    const existing = matchedExisting;
    const newVersion = String(
      (parseFloat(existing.version || "1.0") + 0.1).toFixed(1)
    );
    const merged = {
      ...solution,
      id: existing.id,
      version: newVersion,
      date_created: existing.date_created,
      // Carry over actual_hours and status from matching tasks
      tasks: solution.tasks.map((newTask) => {
        const oldTask = existing.tasks.find(
          (t) => t.name === newTask.name && t.category === newTask.category
        );
        if (oldTask) {
          return {
            ...newTask,
            actual_hours: oldTask.actual_hours,
            status: oldTask.status,
          };
        }
        return newTask;
      }),
    };
    setSolution(merged);
    setMatchedExisting(null);
    setStage("review");
  }

  function handleCreateNew() {
    // Append a suffix to make the ID unique
    const sol = { ...solution, id: solution.id + "-v2" };
    setSolution(sol);
    setMatchedExisting(null);
    setStage("review");
  }

  // ── Render ──

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i
            className="ti ti-file-upload"
            style={{ fontSize: 18 }}
            aria-hidden="true"
          />
          Import solution design
        </h2>
        {stage !== "idle" && stage !== "extracting" && stage !== "parsing" && (
          <button onClick={reset} style={btnSecondary}>
            <i className="ti ti-refresh" style={{ fontSize: 14 }} />
            Start over
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            background: "#FCEBEB",
            borderColor: "#E24B4A",
            color: "#7A1D1D",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
          }}
        >
          <i className="ti ti-alert-circle" style={{ fontSize: 16 }} />
          {error}
        </div>
      )}

      {stage === "idle" && (
        <UploadZone {...{ dragOver, setDragOver, handleFiles, fileRef }} />
      )}
      {stage === "extracting" && (
        <LoadingState
          icon="ti-file-text"
          title="Extracting text from PDF…"
          subtitle={file?.name}
        />
      )}
      {stage === "parsing" && (
        <LoadingState
          icon="ti-brain"
          title="Analyzing solution design…"
          subtitle="Extracting tasks, tags, and hours via GitHub Models"
        />
      )}
      {stage === "match" && matchedExisting && (
        <MatchPrompt
          parsed={solution}
          existing={matchedExisting}
          onUpdate={handleUpdateExisting}
          onCreate={handleCreateNew}
          onCancel={reset}
        />
      )}
      {stage === "review" && solution && (
        <ReviewForm
          solution={solution}
          setSolution={setSolution}
          onSave={handleSave}
          onCancel={reset}
          filename={file?.name}
        />
      )}
      {stage === "saving" && (
        <LoadingState
          icon="ti-brand-github"
          title="Saving to GitHub…"
          subtitle=""
        />
      )}
      {stage === "done" && (
        <DoneState solution={solution} onAnother={reset} />
      )}
      {stage === "error" && (
        <div style={{ marginTop: 12 }}>
          <UploadZone {...{ dragOver, setDragOver, handleFiles, fileRef }} />
        </div>
      )}
    </div>
  );
}

// ─── Duplicate match prompt ──────────────────────────────────────────

function MatchPrompt({ parsed, existing, onUpdate, onCreate, onCancel }) {
  const actual = existing.tasks.reduce((a, t) => a + t.actual_hours, 0);
  return (
    <div style={{ ...cardStyle, padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          fontSize: 14,
          fontWeight: 600,
          color: "#BA7517",
        }}
      >
        <i className="ti ti-alert-triangle" style={{ fontSize: 18 }} />
        Existing solution detected
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text-primary)" }}>{parsed.customer} — {parsed.title}</strong> matches
        an existing solution (v{existing.version}, {(STATUS_CONFIG[normalizeStatus(existing.status)] || {}).label || existing.status}, {actual}/{existing.total_hours}h logged).
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onUpdate}
          style={{
            ...btnPrimary,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <i className="ti ti-refresh" style={{ fontSize: 15 }} />
          Update existing (bump to v{(parseFloat(existing.version || "1.0") + 0.1).toFixed(1)})
        </button>
        <button
          onClick={onCreate}
          style={{
            ...btnSecondary,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 15 }} />
          Create as new solution
        </button>
      </div>
      <button
        onClick={onCancel}
        style={{
          fontFamily: "inherit", fontSize: 12,
          color: "var(--text-secondary)", background: "none",
          border: "none", cursor: "pointer", marginTop: 10,
          padding: 0,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Upload drop zone ────────────────────────────────────────────────

function UploadZone({ dragOver, setDragOver, handleFiles, fileRef }) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => fileRef.current?.click()}
      style={{
        ...cardStyle,
        border: dragOver
          ? "2px dashed var(--text-primary)"
          : "2px dashed var(--border-light)",
        background: dragOver ? "var(--bg-secondary)" : "transparent",
        textAlign: "center",
        padding: "48px 20px",
        cursor: "pointer",
        transition: "all 0.15s",
        borderRadius: 12,
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <i
        className="ti ti-file-type-pdf"
        style={{
          fontSize: 36,
          color: "var(--text-secondary)",
          display: "block",
          marginBottom: 12,
        }}
      />
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        Drop a solution design PDF here
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        or click to browse — max 10 MB
      </div>
    </div>
  );
}

// ─── Generic loading state ───────────────────────────────────────────

function LoadingState({ icon, title, subtitle }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: "48px 20px" }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border-light)",
          borderTopColor: "var(--text-primary)",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─── Done state ──────────────────────────────────────────────────────

function DoneState({ solution, onAnother }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: "36px 20px" }}>
      <i
        className="ti ti-circle-check"
        style={{
          fontSize: 36,
          color: "#1D9E75",
          display: "block",
          marginBottom: 12,
        }}
      />
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 4,
        }}
      >
        {solution.title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 20,
        }}
      >
        Saved to {solution.customer} — {solution.total_hours}h estimated
      </div>
      <button onClick={onAnother} style={btnSecondary}>
        <i className="ti ti-plus" style={{ fontSize: 14 }} />
        Import another
      </button>
    </div>
  );
}

// ─── Review / edit form ──────────────────────────────────────────────

function ReviewForm({ solution, setSolution, onSave, onCancel, filename }) {
  function update(field, value) {
    setSolution((s) => ({ ...s, [field]: value }));
  }

  function updateTask(idx, field, value) {
    setSolution((s) => {
      const tasks = [...s.tasks];
      tasks[idx] = { ...tasks[idx], [field]: value };
      return { ...s, tasks };
    });
  }

  function removeTask(idx) {
    setSolution((s) => ({
      ...s,
      tasks: s.tasks.filter((_, i) => i !== idx),
    }));
  }

  function addTask() {
    setSolution((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          name: "",
          category: "development",
          estimated_hours: 0,
          actual_hours: 0,
          status: "not_started",
        },
      ],
    }));
  }

  const totalHours = solution.tasks.reduce(
    (sum, t) => sum + (Number(t.estimated_hours) || 0),
    0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Source file note */}
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <i className="ti ti-file-type-pdf" style={{ fontSize: 14 }} />
        Parsed from <strong>{filename}</strong> — review and edit before saving.
      </div>

      {/* ── Basic info ── */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-info-circle" style={{ fontSize: 15 }} />
          Solution details
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px 16px",
          }}
        >
          <Field label="Title" span={2}>
            <input
              style={inputStyle}
              value={solution.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Field>
          <Field label="Customer">
            <input
              style={inputStyle}
              value={solution.customer}
              onChange={(e) => update("customer", e.target.value)}
            />
          </Field>
          <Field label="ID (slug)">
            <input
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                fontSize: 12,
              }}
              value={solution.id}
              onChange={(e) => update("id", e.target.value)}
            />
          </Field>
          <Field label="Author">
            <input
              style={inputStyle}
              value={solution.author}
              onChange={(e) => update("author", e.target.value)}
            />
          </Field>
          <Field label="Developer">
            <input
              style={inputStyle}
              value={solution.developer}
              onChange={(e) => update("developer", e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select
              style={inputStyle}
              value={solution.status}
              onChange={(e) => update("status", e.target.value)}
            >
              {STATUS_ORDER.map((k) => (
                <option key={k} value={k}>
                  {STATUS_CONFIG[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Environment">
            <select
              style={inputStyle}
              value={solution.environment}
              onChange={(e) => update("environment", e.target.value)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </Field>
          <Field label="Date created">
            <input
              type="date"
              style={inputStyle}
              value={solution.date_created}
              onChange={(e) => update("date_created", e.target.value)}
            />
          </Field>
          <Field label="Go-live date">
            <input
              type="date"
              style={inputStyle}
              value={solution.go_live_date || ""}
              onChange={(e) =>
                update("go_live_date", e.target.value || null)
              }
            />
          </Field>
          <Field label="Notes" span={2}>
            <textarea
              style={{ ...inputStyle, minHeight: 48, resize: "vertical" }}
              value={solution.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
          <Field label="Design document link" span={2}>
            <input
              style={inputStyle}
              placeholder="https://… (SharePoint, OneDrive, Google Drive, etc.)"
              value={solution.design_url || ""}
              onChange={(e) => update("design_url", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* ── Tags ── */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-tags" style={{ fontSize: 15 }} />
          Process area tags
        </div>
        <TagPicker
          selected={solution.tags}
          onChange={(tags) => update("tags", tags)}
        />
      </div>

      {/* ── Tasks ── */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-list-check" style={{ fontSize: 15 }} />
            Tasks
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--text-secondary)",
              }}
            >
              — {totalHours}h total
            </span>
          </span>
          <button
            onClick={addTask}
            style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12 }}
          >
            <i className="ti ti-plus" style={{ fontSize: 12 }} />
            Add task
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {solution.tasks.map((task, idx) => (
            <TaskRow
              key={idx}
              task={task}
              onChange={(field, val) => updateTask(idx, field, val)}
              onRemove={() => removeTask(idx)}
            />
          ))}
          {solution.tasks.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                textAlign: "center",
                padding: 16,
              }}
            >
              No tasks extracted — add them manually.
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          paddingTop: 4,
        }}
      >
        <button onClick={onCancel} style={btnSecondary}>
          Cancel
        </button>
        <button
          onClick={onSave}
          style={{
            ...btnPrimary,
            opacity: !solution.title || !solution.customer ? 0.4 : 1,
            pointerEvents:
              !solution.title || !solution.customer ? "none" : "auto",
          }}
        >
          <i className="ti ti-device-floppy" style={{ fontSize: 15 }} />
          Save to GitHub
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Field({ label, span, children }) {
  return (
    <div style={span === 2 ? { gridColumn: "1 / -1" } : {}}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TaskRow({ task, onChange, onRemove }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 70px 32px",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input
        style={inputStyle}
        placeholder="Task name"
        value={task.name}
        onChange={(e) => onChange("name", e.target.value)}
      />
      <select
        style={{ ...inputStyle, fontSize: 12 }}
        value={task.category}
        onChange={(e) => onChange("category", e.target.value)}
      >
        {TASK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <input
        type="number"
        style={{ ...inputStyle, textAlign: "right" }}
        min={0}
        step={0.5}
        value={task.estimated_hours}
        onChange={(e) =>
          onChange("estimated_hours", Number(e.target.value) || 0)
        }
        title="Estimated hours"
      />
      <button
        onClick={onRemove}
        title="Remove task"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: 15,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className="ti ti-x" />
      </button>
    </div>
  );
}

function TagPicker({ selected, onChange }) {
  const [open, setOpen] = useState(false);

  function toggle(tag) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div>
      {/* Selected tags */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: selected.length > 0 ? 10 : 0,
        }}
      >
        {selected.map((tag) => {
          const [cat] = tag.split(":");
          const taxonomy = TAG_TAXONOMY[cat];
          const c = taxonomy?.color || "#888";
          const b = taxonomy?.bg || "#f1f1f1";
          return (
            <span
              key={tag}
              style={{
                background: b,
                color: c,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {tag.replace(/_/g, " ").replace(":", " · ")}
              <i
                className="ti ti-x"
                style={{ fontSize: 11, cursor: "pointer", opacity: 0.7 }}
                onClick={() => toggle(tag)}
              />
            </span>
          );
        })}
      </div>

      <button
        onClick={() => setOpen(!open)}
        style={{ ...btnSecondary, padding: "4px 10px", fontSize: 12 }}
      >
        <i
          className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"}`}
          style={{ fontSize: 12 }}
        />
        {open ? "Close" : "Add tags"}
      </button>

      {open && (
        <div
          style={{
            marginTop: 10,
            maxHeight: 260,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {Object.entries(TAG_TAXONOMY).map(([catKey, cat]) => (
            <div key={catKey}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: cat.color,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {cat.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                <TagChip
                  label={cat.label}
                  color={cat.color}
                  bg={cat.bg}
                  active={selected.includes(catKey)}
                  onClick={() => toggle(catKey)}
                />
                {cat.subtags.map((sub) => {
                  const fullTag = `${catKey}:${sub}`;
                  return (
                    <TagChip
                      key={fullTag}
                      label={sub.replace(/_/g, " ")}
                      color={cat.color}
                      bg={cat.bg}
                      active={selected.includes(fullTag)}
                      onClick={() => toggle(fullTag)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagChip({ label, color, bg, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit",
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 99,
        border: active
          ? `1.5px solid ${color}`
          : "1px solid var(--border-light)",
        background: active ? bg : "transparent",
        color: active ? color : "var(--text-secondary)",
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
        transition: "all 0.1s",
      }}
    >
      {label}
    </button>
  );
}
