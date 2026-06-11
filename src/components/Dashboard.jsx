import StatCard from "./shared/StatCard";
import ProgressBar from "./shared/ProgressBar";
import Badge from "./shared/Badge";
import { STATUS_CONFIG, isClosedStatus } from "../data/constants";
import { daysUntil, todayISO, relativeTime, formatDate } from "../data/utils";
import {
  buildForecast,
  urgencyOf,
  customerOf,
  engagementOf,
  weekLabel,
} from "../data/derive";
import { useAppData } from "../context/AppDataContext";

// ─── Dashboard ──────────────────────────────────────────────────────
// Planning view: what's open, what's due, who owns the next move, and
// how the remaining hours spread across the coming weeks. Remaining
// hours come from live task progress (see derive.js), not lagging
// imported actuals.

export default function Dashboard({ onSelect }) {
  const { activeSolutions, activities } = useAppData();

  const today = todayISO();

  // Open = not excluded (already filtered) and not Complete/Canceled.
  const open = activeSolutions.filter((s) => !isClosedStatus(s.status));

  const forecast = buildForecast(open, today);
  const { weekHours, unscheduledHours, totalRemaining, perSolution } = forecast;

  // Sort: overdue first, then by go-live ascending, no-date last;
  // within a group, heavier this-week load first.
  const sorted = [...open].sort((a, b) => {
    const ai = perSolution.get(a.id), bi = perSolution.get(b.id);
    const aOver = a.go_live_date && a.go_live_date < today ? 0 : 1;
    const bOver = b.go_live_date && b.go_live_date < today ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const aDate = a.go_live_date || "9999-12-31";
    const bDate = b.go_live_date || "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (bi?.thisWeek || 0) - (ai?.thisWeek || 0);
  });

  const forecastWeeks = weekHours.slice(0, 6);
  const maxWeekHours = Math.max(...forecastWeeks, unscheduledHours, 1);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatCard
          icon="folder"
          label="Open solutions"
          value={open.length}
          sub={`${activeSolutions.length - open.length} closed`}
        />
        <StatCard
          icon="calendar-bolt"
          label="This week"
          value={`${weekHours[0] || 0}h`}
          sub="forecast load"
        />
        <StatCard
          icon="calendar-due"
          label="Next week"
          value={`${weekHours[1] || 0}h`}
          sub="forecast load"
        />
        <StatCard
          icon="hourglass"
          label="Remaining"
          value={`${totalRemaining}h`}
          sub={unscheduledHours > 0 ? `${unscheduledHours}h unscheduled` : "all scheduled"}
        />
      </div>

      {/* Weekly forecast */}
      {(forecastWeeks.some((h) => h > 0) || unscheduledHours > 0) && (
        <div
          style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--text-primary)" }}>
            Forecast — remaining hours by week
          </div>
          {forecastWeeks.map((hrs, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: i === 0 ? 500 : 400 }}>
                  {weekLabel(i, today)}
                </span>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{hrs}h</span>
              </div>
              <ProgressBar
                value={hrs}
                max={maxWeekHours}
                color={hrs > 12 ? "#E24B4A" : hrs >= 5 ? "#BA7517" : "#1D9E75"}
                height={5}
              />
            </div>
          ))}
          {unscheduledHours > 0 && (
            <div style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  Unscheduled (no go-live date)
                </span>
                <span style={{ fontWeight: 500, color: "var(--text-tertiary)" }}>{unscheduledHours}h</span>
              </div>
              <ProgressBar value={unscheduledHours} max={maxWeekHours} color="#ccc" height={5} />
            </div>
          )}
        </div>
      )}

      {/* Solutions by deadline */}
      <div
        style={{
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "6px 0",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, padding: "10px 16px 6px", color: "var(--text-primary)" }}>
          Solutions by deadline
        </div>

        {sorted.map((s) => {
          const info = perSolution.get(s.id) || { remaining: 0, thisWeek: 0, weekIndex: null };
          const urgency = urgencyOf(s, info, today);
          const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG["1.1"];
          const eng = engagementOf(s, activities);
          const hasDate = !!s.go_live_date;
          const du = hasDate ? daysUntil(s.go_live_date) : null;
          const isOverdue = hasDate && du.includes("ago");
          const latestNote = (s.notes_log || [])[0];

          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 16px 10px 13px",
                borderTop: "0.5px solid var(--border-light)",
                borderLeft: `3px solid ${urgency.color}`,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>
                    {s.title}
                  </span>
                  <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                  <span
                    style={{
                      fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 99,
                      color: urgency.color, background: urgency.bg,
                    }}
                  >
                    {urgency.label}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                  {customerOf(s, activities)}
                  {eng && (
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {" "}· {eng.label || eng.code}
                    </span>
                  )}
                </div>
                {latestNote && (
                  <div
                    style={{
                      fontSize: 11, color: "var(--text-secondary)", marginTop: 3,
                      display: "flex", alignItems: "center", gap: 4,
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}
                  >
                    <i className="ti ti-note" style={{ fontSize: 12, flexShrink: 0, opacity: 0.6 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{latestNote.text}</span>
                    <span style={{ flexShrink: 0, opacity: 0.6 }}>· {relativeTime(latestNote.created_at)}</span>
                  </div>
                )}
              </div>

              {/* Timeline + load */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 12.5, fontWeight: 500,
                    color: !hasDate
                      ? "var(--text-tertiary)"
                      : isOverdue
                        ? "#E24B4A"
                        : "var(--text-primary)",
                    fontStyle: hasDate ? "normal" : "italic",
                  }}
                >
                  {hasDate ? `${formatDate(s.go_live_date)} · ${du}` : "No go-live date"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {info.remaining}h left
                  {info.thisWeek > 0 && (
                    <span> · <span style={{ color: urgency.color, fontWeight: 500 }}>{info.thisWeek}h this wk</span></span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div style={{ padding: "24px 16px", fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
            Nothing open — import a solution design to get started.
          </div>
        )}
      </div>
    </div>
  );
}
