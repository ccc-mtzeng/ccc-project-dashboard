import { useState, useMemo, useRef } from "react";
import { STATUS_CONFIG, isClosedStatus } from "../data/constants";
import { daysBetween, todayISO } from "../data/utils";

// ── Preset view configs ────────────────────────────────────────────

const PRESETS = [
  { key: "focus", label: "Focus", desc: "−2 wk → +5 wk", back: 14, forward: 35 },
  { key: "month", label: "This month", desc: "Calendar month", back: 0, forward: 0, calendar: "month" },
  { key: "quarter", label: "Quarter", desc: "−1 mo → +3 mo", back: 30, forward: 90 },
  { key: "half", label: "6 months", desc: "−1 mo → +6 mo", back: 30, forward: 180 },
  { key: "all", label: "All", desc: "Full range", back: 0, forward: 0, allRange: true },
];

const pillBtn = {
  fontFamily: "inherit",
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: "1px solid var(--border-light)",
  fontWeight: 450,
  background: "transparent",
  transition: "all 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(dateStr) {
  return dateStr.slice(0, 7) + "-01";
}

function endOfMonth(dateStr) {
  const d = new Date(dateStr.slice(0, 7) + "-01T12:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function fmtMonthDay(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function fmtMonthYear(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", year: "numeric",
  });
}

// ═══════════════════════════════════════════════════════════════════

export default function Timeline({ solutions, onSelect }) {
  const [preset, setPreset] = useState("focus");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const scrollRef = useRef(null);

  const today = todayISO();

  // Compute the visible date window
  const { windowStart, windowEnd } = useMemo(() => {
    if (customFrom && customTo) {
      return { windowStart: customFrom, windowEnd: customTo };
    }

    const cfg = PRESETS.find((p) => p.key === preset) || PRESETS[0];

    if (cfg.allRange) {
      const dates = solutions.flatMap((s) => [s.date_created, s.go_live_date].filter(Boolean));
      if (dates.length === 0) return { windowStart: addDays(today, -14), windowEnd: addDays(today, 35) };
      const min = dates.reduce((a, b) => (a < b ? a : b));
      const max = dates.reduce((a, b) => (a > b ? a : b));
      return {
        windowStart: addDays(min < today ? min : today, -7),
        windowEnd: addDays(max > today ? max : today, 14),
      };
    }

    if (cfg.calendar === "month") {
      return { windowStart: startOfMonth(today), windowEnd: endOfMonth(today) };
    }

    return {
      windowStart: addDays(today, -cfg.back),
      windowEnd: addDays(today, cfg.forward),
    };
  }, [preset, customFrom, customTo, solutions, today]);

  const totalDays = Math.max(1, daysBetween(windowStart, windowEnd));

  // Filter solutions that overlap with the window
  const visible = useMemo(() => {
    return solutions
      .filter((s) => !s.excluded)
      .filter((s) => {
        const start = s.date_created || s.go_live_date;
        const end = s.go_live_date || s.date_created;
        if (!start || !end) return false;
        return end >= windowStart && start <= windowEnd;
      })
      .sort((a, b) => (a.go_live_date || "").localeCompare(b.go_live_date || ""));
  }, [solutions, windowStart, windowEnd]);

  // Generate tick marks
  const ticks = useMemo(() => {
    const result = [];
    const d = new Date(windowStart + "T12:00:00");
    const end = new Date(windowEnd + "T12:00:00");

    if (totalDays <= 45) {
      // Weekly ticks
      // Advance to next Monday
      const day = d.getDay();
      const toMon = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
      d.setDate(d.getDate() + toMon);
      while (d <= end) {
        const iso = d.toISOString().slice(0, 10);
        const offset = daysBetween(windowStart, iso);
        const pct = (offset / totalDays) * 100;
        result.push({ pct, label: fmtMonthDay(iso), minor: false });
        d.setDate(d.getDate() + 7);
      }
    } else if (totalDays <= 180) {
      // Bi-weekly ticks
      const day = d.getDay();
      const toMon = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
      d.setDate(d.getDate() + toMon);
      let count = 0;
      while (d <= end) {
        const iso = d.toISOString().slice(0, 10);
        const offset = daysBetween(windowStart, iso);
        const pct = (offset / totalDays) * 100;
        if (count % 2 === 0) {
          result.push({ pct, label: fmtMonthDay(iso), minor: false });
        } else {
          result.push({ pct, label: "", minor: true });
        }
        d.setDate(d.getDate() + 7);
        count++;
      }
    } else {
      // Monthly ticks
      d.setDate(1);
      if (d < new Date(windowStart + "T12:00:00")) d.setMonth(d.getMonth() + 1);
      while (d <= end) {
        const iso = d.toISOString().slice(0, 10);
        const offset = daysBetween(windowStart, iso);
        const pct = (offset / totalDays) * 100;
        result.push({ pct, label: fmtMonthYear(iso), minor: false });
        d.setMonth(d.getMonth() + 1);
      }
    }

    return result;
  }, [windowStart, windowEnd, totalDays]);

  // Today position
  const todayPct = useMemo(() => {
    const offset = daysBetween(windowStart, today);
    return (offset / totalDays) * 100;
  }, [windowStart, today, totalDays]);

  const todayVisible = todayPct >= 0 && todayPct <= 100;

  function applyPreset(key) {
    setPreset(key);
    setCustomFrom("");
    setCustomTo("");
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            title={p.desc}
            style={{
              ...pillBtn,
              background: preset === p.key && !customFrom ? "var(--text-primary)" : "transparent",
              color: preset === p.key && !customFrom ? "var(--bg-primary)" : "var(--text-secondary)",
              borderColor: preset === p.key && !customFrom ? "var(--text-primary)" : undefined,
            }}
          >
            {p.label}
          </button>
        ))}

        <span style={{ width: 1, height: 18, background: "var(--border-light)", margin: "0 4px" }} />

        <input
          type="date"
          value={customFrom || windowStart}
          onChange={(e) => { setCustomFrom(e.target.value); if (!customTo) setCustomTo(windowEnd); }}
          style={{
            fontFamily: "inherit", fontSize: 11, padding: "3px 6px",
            borderRadius: 6, border: "1px solid var(--border-light)",
            background: "var(--bg-primary)", color: "var(--text-primary)",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>→</span>
        <input
          type="date"
          value={customTo || windowEnd}
          onChange={(e) => { setCustomTo(e.target.value); if (!customFrom) setCustomFrom(windowStart); }}
          style={{
            fontFamily: "inherit", fontSize: 11, padding: "3px 6px",
            borderRadius: 6, border: "1px solid var(--border-light)",
            background: "var(--bg-primary)", color: "var(--text-primary)",
          }}
        />
        {customFrom && (
          <button
            onClick={() => { setCustomFrom(""); setCustomTo(""); }}
            style={{ ...pillBtn, fontSize: 10, padding: "3px 8px", color: "#E24B4A", borderColor: "rgba(226,75,74,0.3)" }}
          >
            <i className="ti ti-x" style={{ fontSize: 11 }} /> Reset
          </button>
        )}

        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {visible.length} solution{visible.length !== 1 ? "s" : ""} · {totalDays} days
        </span>
      </div>

      {/* Timeline chart */}
      <div
        ref={scrollRef}
        style={{
          position: "relative",
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "0 0 8px",
          overflow: "hidden",
          minHeight: 120,
        }}
      >
        {/* Tick marks + header */}
        <div
          style={{
            position: "relative",
            height: 28,
            borderBottom: "0.5px solid var(--border-light)",
            marginBottom: 4,
          }}
        >
          {ticks.map((t, i) => (
            <div key={i}>
              {/* Tick line */}
              <div
                style={{
                  position: "absolute",
                  left: `${t.pct}%`,
                  top: 0,
                  bottom: -1000,
                  width: 0.5,
                  background: t.minor ? "var(--border-light)" : "var(--border-light)",
                  opacity: t.minor ? 0.4 : 0.7,
                  zIndex: 0,
                }}
              />
              {/* Label */}
              {t.label && (
                <div
                  style={{
                    position: "absolute",
                    left: `${t.pct}%`,
                    top: 7,
                    transform: "translateX(4px)",
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Today marker */}
        {todayVisible && (
          <>
            <div
              style={{
                position: "absolute",
                left: `${todayPct}%`,
                top: 0,
                bottom: 0,
                width: 1.5,
                background: "#E24B4A",
                opacity: 0.5,
                zIndex: 5,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${todayPct}%`,
                top: 2,
                transform: "translateX(-50%)",
                fontSize: 9,
                fontWeight: 600,
                color: "#E24B4A",
                zIndex: 6,
                background: "var(--bg-primary)",
                padding: "0 4px",
                borderRadius: 3,
              }}
            >
              Today
            </div>
          </>
        )}

        {/* Solution rows */}
        <div style={{ padding: "0 12px" }}>
          {visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", fontSize: 12, color: "var(--text-secondary)" }}>
              No solutions in this date range.
            </div>
          )}

          {visible.map((s) => {
            const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG["1.1"];
            const barStart = s.date_created || s.go_live_date;
            const barEnd = s.go_live_date || s.date_created;

            const startOffset = daysBetween(windowStart, barStart);
            const endOffset = daysBetween(windowStart, barEnd);

            // Clamp to visible range
            const clampedStart = Math.max(0, startOffset);
            const clampedEnd = Math.min(totalDays, endOffset);

            const leftPct = (clampedStart / totalDays) * 100;
            const widthPct = Math.max(2, ((clampedEnd - clampedStart) / totalDays) * 100);

            // Progress from tasks
            const pct = s.tasks.length > 0
              ? Math.round(
                  s.tasks.reduce((sum, t) => {
                    const est = t.estimated_hours || 0;
                    const pc = t.percent_complete || 0;
                    return sum + pc * (est || 1);
                  }, 0) / s.tasks.reduce((sum, t) => sum + (t.estimated_hours || 1), 0)
                )
              : 0;

            // Is the bar clipped on left or right?
            const clippedLeft = startOffset < 0;
            const clippedRight = endOffset > totalDays;

            // Days until go-live
            const daysToGoLive = daysBetween(today, barEnd);
            const isOverdue = daysToGoLive < 0 && !isClosedStatus(s.status);

            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  position: "relative",
                  height: 36,
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                {/* Customer label */}
                {leftPct > 12 && (
                  <div
                    style={{
                      position: "absolute",
                      right: `${100 - leftPct + 0.5}%`,
                      top: 8,
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      textAlign: "right",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: `${leftPct - 1}%`,
                    }}
                  >
                    {s.customer}
                  </div>
                )}

                {/* Bar */}
                <div
                  style={{
                    position: "absolute",
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: 3,
                    height: 28,
                    background: sc.bg,
                    borderRadius: clippedLeft && clippedRight ? 0 : clippedLeft ? "0 6px 6px 0" : clippedRight ? "6px 0 0 6px" : 6,
                    border: `0.5px solid ${sc.color}44`,
                    borderLeft: clippedLeft ? "2px solid " + sc.color : undefined,
                    borderRight: clippedRight ? "2px solid " + sc.color : undefined,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                    paddingRight: 6,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.85; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = 1; }}
                >
                  {/* Progress fill */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pct}%`,
                      background: `${sc.color}22`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: sc.color,
                      position: "relative",
                      zIndex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {s.title}
                  </span>
                  {/* Go-live indicator */}
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      color: isOverdue ? "#E24B4A" : sc.color,
                      position: "relative",
                      zIndex: 1,
                      opacity: 0.7,
                      flexShrink: 0,
                      marginLeft: 4,
                    }}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Customer label after bar if not enough space before */}
                {leftPct <= 12 && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${leftPct + widthPct + 0.5}%`,
                      top: 8,
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: `${Math.max(0, 100 - leftPct - widthPct - 1)}%`,
                    }}
                  >
                    {s.customer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
