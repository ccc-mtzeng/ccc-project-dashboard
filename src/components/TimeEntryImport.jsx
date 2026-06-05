import { useState, useMemo } from "react";
import StatCard from "./shared/StatCard";
import {
  isoWeekKey,
  newEntryId,
} from "../data/utils";
import {
  readFile,
  writeFile,
  loadTimesheet,
  saveTimesheet,
  loadActivities,
  saveActivities,
} from "../services/github";

// ═════════════════════════════════════════════════════════════════════
// TimeEntryImport — Kantata CSV → weekly timesheet files
// Tracks processed Kantata entry IDs in config/imported-kantata-ids.json
// so re-importing overlapping CSVs only picks up the delta.
// ═════════════════════════════════════════════════════════════════════

const TRACKING_PATH = "config/imported-kantata-ids.json";

const pillBtn = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 500,
};

export default function TimeEntryImport({ activities, onComplete, onCancel }) {
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [importResult, setImportResult] = useState(null);
  // Tracking file state (loaded once per file select, saved after import)
  const [trackingSha, setTrackingSha] = useState(null);

  // ── CSV parsing helpers ────────────────────────────────────────────

  function parseCsvLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  function parseDate(mdyyyy) {
    const parts = mdyyyy.split("/");
    if (parts.length !== 3) return null;
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  function extractActivityCode(deliveryElement) {
    const match = deliveryElement.match(/^(E\d+-\d+)/i);
    return match ? match[1].toLowerCase() : null;
  }

  function extractCustomer(timesheetName) {
    const match = timesheetName.match(/^(.+?)-E\d+/);
    return match ? match[1].trim() : timesheetName.split("-")[0].trim();
  }

  // ── File handling (async: loads tracking file first) ───────────────

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    setParseLoading(true);

    try {
      // 1. Read file content
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

      // 2. Load known Kantata IDs from data repo
      let knownIds = new Set();
      let sha = null;
      try {
        const result = await readFile(TRACKING_PATH);
        if (result?.data) {
          knownIds = new Set(Array.isArray(result.data) ? result.data : (result.data.ids || []));
          sha = result.sha;
        }
      } catch {
        // File doesn't exist yet — first import
      }
      setTrackingSha(sha);

      // 3. Process CSV with known IDs filtered out
      const result = processCSV(text, knownIds);
      setParsed(result);
      setStep("preview");
    } catch (err) {
      setParseError(err.message);
    } finally {
      setParseLoading(false);
    }
  }

  // ── CSV processing ─────────────────────────────────────────────────

  function processCSV(text, knownIds) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV appears empty.");

    const header = parseCsvLine(lines[0]);
    const colIdx = {};
    const expected = {
      delivery: "Delivery Element",
      task: "Engagement Task",
      timesheet: "Timesheet Name",
      date: "Created Date",
      kantataId: "TimeEntry Id",
      hours: "Entry Units",
    };

    for (const [key, label] of Object.entries(expected)) {
      const idx = header.findIndex((h) => h.includes(label));
      if (idx === -1 && key !== "task") throw new Error(`Missing column: "${label}"`);
      colIdx[key] = idx;
    }

    // Parse all rows, separating known from new
    const allRawEntries = [];
    let skippedCount = 0;
    let skippedHours = 0;

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      if (fields.length < 3) continue;

      const deliveryElement = fields[colIdx.delivery] || "";
      const engagementTask = colIdx.task >= 0 ? (fields[colIdx.task] || "") : "";
      const timesheetName = fields[colIdx.timesheet] || "";
      const dateStr = fields[colIdx.date] || "";
      const kantataId = fields[colIdx.kantataId] || "";
      const hours = parseFloat(fields[colIdx.hours]) || 0;

      const isoDate = parseDate(dateStr);
      const actCode = extractActivityCode(deliveryElement);
      if (!isoDate || !actCode) continue;

      // Skip entries we've already processed
      if (knownIds.has(kantataId)) {
        skippedCount++;
        skippedHours += hours;
        continue;
      }

      allRawEntries.push({
        activityCode: actCode,
        deliveryElement,
        engagementTask: engagementTask || null,
        customer: extractCustomer(timesheetName),
        date: isoDate,
        kantataId,
        hours,
      });
    }

    // Collect all new Kantata IDs (before netting, so we track corrections too)
    const newKantataIds = allRawEntries.map((e) => e.kantataId).filter(Boolean);

    // Net entries by date + activityCode
    const netKey = (e) => `${e.date}|${e.activityCode}`;
    const netted = {};
    for (const e of allRawEntries) {
      const k = netKey(e);
      if (!netted[k]) {
        netted[k] = {
          activityCode: e.activityCode,
          deliveryElement: e.deliveryElement,
          customer: e.customer,
          date: e.date,
          hours: 0,
          engagementTask: e.engagementTask,
          kantataIds: [],
        };
      }
      netted[k].hours += e.hours;
      netted[k].kantataIds.push(e.kantataId);
      if (!netted[k].engagementTask && e.engagementTask) {
        netted[k].engagementTask = e.engagementTask;
      }
    }

    // Filter: drop entries that netted to 0 or below
    const entries = Object.values(netted)
      .filter((e) => e.hours > 0)
      .map((e) => ({ ...e, hours: Math.round(e.hours * 100) / 100 }));

    const droppedCount = Object.values(netted).filter((e) => e.hours <= 0).length;

    // Match against existing activities, identify new ones
    const activityMap = {};
    for (const act of activities) {
      activityMap[act.id] = act;
      const codeMatch = act.code?.match(/^(E\d+-\d+)/i);
      if (codeMatch) activityMap[codeMatch[1].toLowerCase()] = act;
    }

    const newActivitiesMap = {};
    for (const e of entries) {
      if (!activityMap[e.activityCode]) {
        newActivitiesMap[e.activityCode] = {
          id: e.activityCode,
          label: `${e.customer} ${e.deliveryElement.replace(/^E\d+-\d+\s*/, "").slice(0, 40)}`.trim(),
          code: e.deliveryElement,
          customer: e.customer,
          default_task: "Support & Optimization",
          archived: false,
        };
      }
    }
    const newActivities = Object.values(newActivitiesMap);

    // Group entries by ISO week
    const weeklyGroups = {};
    for (const e of entries) {
      const wk = isoWeekKey(e.date);
      if (!weeklyGroups[wk]) weeklyGroups[wk] = [];
      weeklyGroups[wk].push(e);
    }

    const sortedWeeks = Object.keys(weeklyGroups).sort();

    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const dates = entries.map((e) => e.date).sort();

    return {
      entries,
      newActivities,
      weeklyGroups,
      sortedWeeks,
      newKantataIds,
      stats: {
        rawRows: allRawEntries.length + skippedCount,
        newRows: allRawEntries.length,
        skippedCount,
        skippedHours: Math.round(skippedHours * 10) / 10,
        nettedEntries: entries.length,
        droppedPairs: droppedCount,
        totalHours: Math.round(totalHours * 10) / 10,
        dateRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "—",
        weekCount: sortedWeeks.length,
        newActivityCount: newActivities.length,
        uniqueCustomers: [...new Set(entries.map((e) => e.customer))].length,
      },
    };
  }

  // ── Import execution ─────────────────────────────────────────────

  async function executeImport() {
    if (!parsed) return;
    setStep("importing");

    const { entries, newActivities, weeklyGroups, sortedWeeks, newKantataIds } = parsed;
    // +1 for tracking file save, +1 if new activities
    const totalSteps = sortedWeeks.length + (newActivities.length > 0 ? 1 : 0) + 1;
    let stepNum = 0;
    let activitiesSaved = 0;
    let entriesSaved = 0;
    let weeksWritten = 0;

    try {
      // Step 1: Save new activities
      if (newActivities.length > 0) {
        setProgress({ current: stepNum, total: totalSteps, message: `Adding ${newActivities.length} new activities…` });
        const { data: currentActs, sha } = await loadActivities();
        const existingIds = new Set((currentActs || []).map((a) => a.id));
        const toAdd = newActivities.filter((a) => !existingIds.has(a.id));
        if (toAdd.length > 0) {
          const merged = [...(currentActs || []), ...toAdd];
          await saveActivities(merged, sha);
          activitiesSaved = toAdd.length;
        }
        stepNum++;
      }

      // Step 2: Save entries per week
      for (const weekKey of sortedWeeks) {
        setProgress({
          current: stepNum,
          total: totalSteps,
          message: `Saving ${weekKey} (${weeklyGroups[weekKey].length} entries)…`,
        });

        const { data: existing, sha } = await loadTimesheet(weekKey);
        const existingEntries = existing?.entries || [];

        const newEntries = weeklyGroups[weekKey].map((e) => ({
          id: newEntryId(),
          date: e.date,
          end_date: null,
          hours: e.hours,
          notes: "",
          activity_id: e.activityCode,
          solution_id: null,
          task_category: null,
          engagement_task: e.engagementTask,
          ticket: null,
          submitted: true,
          source: "kantata_import",
          kantata_ids: e.kantataIds,
        }));

        const merged = [...existingEntries, ...newEntries];
        await saveTimesheet(weekKey, { week: weekKey, entries: merged }, sha);
        entriesSaved += newEntries.length;
        weeksWritten++;

        stepNum++;
      }

      // Step 3: Update tracking file with all processed Kantata IDs
      setProgress({ current: stepNum, total: totalSteps, message: "Saving import tracking data…" });

      let existingIds = [];
      let currentTrackingSha = trackingSha;
      try {
        const result = await readFile(TRACKING_PATH);
        if (result?.data) {
          existingIds = Array.isArray(result.data) ? result.data : (result.data.ids || []);
          currentTrackingSha = result.sha;
        }
      } catch {
        // doesn't exist yet
      }

      const mergedIds = [...new Set([...existingIds, ...newKantataIds])];
      await writeFile(TRACKING_PATH, mergedIds, currentTrackingSha, "Update imported Kantata IDs");

      setImportResult({ activitiesSaved, entriesSaved, weeksWritten });
      setStep("done");
    } catch (err) {
      console.error("Import failed:", err);
      setImportResult({ error: err.message, activitiesSaved, entriesSaved, weeksWritten });
      setStep("done");
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
            Import time entries
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            Import submitted time from a Kantata CSV export
          </div>
        </div>
        {step !== "importing" && (
          <button onClick={onCancel} style={{ ...pillBtn, color: "var(--text-secondary)" }}>
            {step === "done" ? "Close" : "Cancel"}
          </button>
        )}
      </div>

      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div
          style={{
            border: "2px dashed var(--border-light)",
            borderRadius: 12,
            padding: 40,
            textAlign: "center",
          }}
        >
          {parseLoading ? (
            <>
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                Processing CSV…
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                Loading import history and parsing entries
              </div>
            </>
          ) : (
            <>
              <i className="ti ti-file-import" style={{ fontSize: 32, color: "var(--text-secondary)", opacity: 0.4 }} />
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500, marginTop: 10 }}>
                Drop a Kantata time export CSV
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginBottom: 16 }}>
                Expected columns: Delivery Element, Created Date, Entry Units
              </div>
              <label
                style={{
                  ...pillBtn,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 18px",
                  background: "var(--text-primary)",
                  color: "var(--bg-primary)",
                  borderColor: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <i className="ti ti-upload" style={{ fontSize: 14 }} />
                Choose file
                <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
              </label>
            </>
          )}
          {parseError && (
            <div style={{ fontSize: 12, color: "#E24B4A", marginTop: 12 }}>{parseError}</div>
          )}
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === "preview" && parsed && (
        <PreviewStep
          parsed={parsed}
          fileName={fileName}
          activities={activities}
          onConfirm={executeImport}
          onBack={() => { setParsed(null); setStep("upload"); }}
        />
      )}

      {/* ── Step: Importing ── */}
      {step === "importing" && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
            Importing…
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            {progress.message}
          </div>
          <div
            style={{
              width: "100%",
              height: 6,
              background: "var(--bg-secondary)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "0%",
                height: "100%",
                background: "var(--text-primary)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
            {progress.current} / {progress.total} steps
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === "done" && importResult && (
        <div style={{ textAlign: "center", padding: 40 }}>
          {importResult.error ? (
            <>
              <i className="ti ti-alert-circle" style={{ fontSize: 32, color: "#E24B4A" }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: "#E24B4A", marginTop: 8 }}>
                Import failed
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {importResult.error}
              </div>
              {(importResult.entriesSaved > 0 || importResult.activitiesSaved > 0) && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                  Partial progress: {importResult.entriesSaved} entries and {importResult.activitiesSaved} activities were saved before the error.
                </div>
              )}
            </>
          ) : (
            <>
              <i className="ti ti-circle-check" style={{ fontSize: 32, color: "#1D9E75" }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginTop: 8 }}>
                Import complete
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                {importResult.entriesSaved} entries saved across {importResult.weeksWritten} weeks
                {importResult.activitiesSaved > 0 && <><br />{importResult.activitiesSaved} new activities added</>}
              </div>
            </>
          )}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={onComplete}
              style={{
                ...pillBtn,
                padding: "8px 18px",
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
                borderColor: "var(--text-primary)",
              }}
            >
              Back to timesheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Preview Step
// ═════════════════════════════════════════════════════════════════════

function PreviewStep({ parsed, fileName, activities, onConfirm, onBack }) {
  const { entries, newActivities, weeklyGroups, sortedWeeks, stats } = parsed;
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const customerHours = useMemo(() => {
    const map = {};
    for (const e of entries) {
      map[e.customer] = (map[e.customer] || 0) + e.hours;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([customer, hours]) => ({ customer, hours: Math.round(hours * 10) / 10 }));
  }, [entries]);

  const visibleWeeks = showAllWeeks ? sortedWeeks : sortedWeeks.slice(0, 5);

  // Nothing to import — all entries already known
  const nothingNew = entries.length === 0 && stats.skippedCount > 0;

  return (
    <div>
      {/* File info */}
      <div style={{
        fontSize: 12, color: "var(--text-secondary)", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <i className="ti ti-file-text" style={{ fontSize: 13 }} />
        {fileName} · {stats.rawRows} rows · {stats.dateRange}
      </div>

      {/* Already-imported banner */}
      {stats.skippedCount > 0 && (
        <div style={{
          background: "var(--bg-secondary)", border: "1px solid var(--border-light)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12,
          color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="ti ti-checks" style={{ fontSize: 15, color: "#1D9E75" }} />
          <span>
            <strong>{stats.skippedCount}</strong> entries already imported (skipped).
            {stats.newRows > 0 && <> <strong>{stats.newRows}</strong> new rows to process.</>}
          </span>
        </div>
      )}

      {/* Nothing new to import */}
      {nothingNew && (
        <div style={{ textAlign: "center", padding: 30 }}>
          <i className="ti ti-circle-check" style={{ fontSize: 28, color: "#1D9E75" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginTop: 8 }}>
            All entries already imported
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            All {stats.skippedCount} entries in this CSV have been previously imported. Nothing new to process.
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={onBack} style={{ ...pillBtn, color: "var(--text-secondary)" }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* Normal preview — only if there are entries to import */}
      {!nothingNew && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <StatCard icon="clock" label="New hours" value={`${stats.totalHours}h`} />
            <StatCard
              icon="list"
              label="New entries"
              value={stats.nettedEntries}
              sub={stats.droppedPairs > 0 ? `${stats.droppedPairs} correction pairs netted out` : undefined}
            />
            <StatCard icon="calendar" label="Weeks" value={stats.weekCount} />
            <StatCard icon="users" label="Customers" value={stats.uniqueCustomers} />
          </div>

          {/* New activities */}
          {newActivities.length > 0 && (
            <div style={{
              border: "0.5px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              padding: 14,
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <i className="ti ti-sparkles" style={{ fontSize: 14, color: "#BA7517" }} />
                {newActivities.length} new {newActivities.length === 1 ? "activity" : "activities"} to create
              </div>
              {newActivities.map((a) => (
                <div key={a.id} style={{
                  fontSize: 12, padding: "5px 0",
                  borderTop: "0.5px solid var(--border-light)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 450 }}>{a.customer}</span>
                    <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>{a.id.toUpperCase()}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.default_task}</span>
                </div>
              ))}
            </div>
          )}

          {/* Customer breakdown */}
          <div style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              Hours by customer
            </div>
            {customerHours.map(({ customer, hours }) => {
              const pct = stats.totalHours > 0 ? (hours / stats.totalHours) * 100 : 0;
              return (
                <div key={customer} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{customer}</span>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{hours}h</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-secondary)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#378ADD", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekly breakdown */}
          <div style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
              Entries per week
            </div>
            {visibleWeeks.map((wk) => {
              const weekEntries = weeklyGroups[wk];
              const weekHours = Math.round(weekEntries.reduce((s, e) => s + e.hours, 0) * 10) / 10;
              return (
                <div key={wk} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontSize: 12, padding: "5px 0",
                  borderTop: "0.5px solid var(--border-light)",
                }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 450 }}>{wk}</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {weekEntries.length} entries · {weekHours}h
                  </span>
                </div>
              );
            })}
            {sortedWeeks.length > 5 && !showAllWeeks && (
              <button
                onClick={() => setShowAllWeeks(true)}
                style={{
                  fontFamily: "inherit", fontSize: 11, color: "var(--text-secondary)",
                  background: "none", border: "none", cursor: "pointer", padding: "6px 0 0",
                }}
              >
                Show all {sortedWeeks.length} weeks…
              </button>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onBack} style={{ ...pillBtn, color: "var(--text-secondary)" }}>
              Back
            </button>
            <button
              onClick={onConfirm}
              style={{
                ...pillBtn,
                padding: "8px 18px",
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
                borderColor: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <i className="ti ti-database-import" style={{ fontSize: 14 }} />
              Import {stats.nettedEntries} entries
            </button>
          </div>
        </>
      )}
    </div>
  );
}
