import { useMemo } from "react";
import StatCard from "./shared/StatCard";
import ProgressBar from "./shared/ProgressBar";
import { CATEGORY_COLORS } from "../data/constants";
import { daysUntil, daysBetween, todayISO, relativeTime } from "../data/utils";
import { actualHoursBySolution, round1 } from "../data/entries";

export default function Dashboard({ solutions, allEntries = [], onSelect }) {
  const totalHoursEstimated = solutions.reduce((s, d) => s + d.total_hours, 0);

  // Actual hours = tagged time entries (single source of truth),
  // summed across the solutions shown on this dashboard.
  const actualsMap = useMemo(() => actualHoursBySolution(allEntries), [allEntries]);
  const totalHoursActual = round1(
    solutions.reduce((s, d) => s + (actualsMap.get(d.id) || 0), 0)
  );
  const activeCount = solutions.filter((s) => s.status !== "deployed").length;

  // Separate solutions with and without go-live dates
  const withDate = solutions
    .filter((s) => s.status !== "deployed" && s.go_live_date)
    .sort((a, b) => new Date(a.go_live_date) - new Date(b.go_live_date));
  const noDate = solutions
    .filter((s) => s.status !== "deployed" && !s.go_live_date);
  const upcoming = [...withDate, ...noDate];

  const hoursByCategory = {};
  solutions.forEach((s) =>
    s.tasks.forEach((t) => {
      hoursByCategory[t.category] =
        (hoursByCategory[t.category] || 0) + t.estimated_hours;
    })
  );
  const maxCatHours = Math.max(...Object.values(hoursByCategory), 1);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <StatCard
          icon="folder"
          label="Active solutions"
          value={activeCount}
          sub={`${solutions.length} total`}
        />
        <StatCard
          icon="clock"
          label="Hours estimated"
          value={totalHoursEstimated}
          sub={`${totalHoursActual} actual`}
        />
        <StatCard
          icon="percentage"
          label="Hours utilization"
          value={`${
            totalHoursEstimated > 0
              ? Math.round((totalHoursActual / totalHoursEstimated) * 100)
              : 0
          }%`}
        />
        <StatCard
          icon="calendar"
          label="Next go-live"
          value={withDate[0] ? daysUntil(withDate[0].go_live_date) : "—"}
          sub={withDate[0]?.customer}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Hours by phase */}
        <div
          style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              color: "var(--text-primary)",
            }}
          >
            Hours by phase
          </div>
          {Object.entries(hoursByCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, hrs]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat}
                  </span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {hrs}h
                  </span>
                </div>
                <ProgressBar
                  value={hrs}
                  max={maxCatHours}
                  color={CATEGORY_COLORS[cat] || "#888"}
                />
              </div>
            ))}
        </div>

        {/* Upcoming deadlines */}
        <div
          style={{
            border: "0.5px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              color: "var(--text-primary)",
            }}
          >
            Upcoming deadlines
          </div>
          {upcoming.map((s) => {
            const hasDate = !!s.go_live_date;
            const du = hasDate ? daysUntil(s.go_live_date) : null;
            const isUrgent = hasDate && daysBetween(todayISO(), s.go_live_date) <= 14;
            const isOverdue = hasDate && du && du.includes("ago");
            const latestNote = (s.notes_log || [])[0];
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "0.5px solid var(--border-light)",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {s.customer}
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
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {latestNote.text}
                      </span>
                      <span style={{ flexShrink: 0, opacity: 0.6 }}>
                        · {relativeTime(latestNote.created_at)}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: !hasDate ? "var(--text-tertiary)" : (isOverdue || isUrgent) ? "#E24B4A" : "var(--text-secondary)",
                    flexShrink: 0,
                    marginTop: 1,
                    fontStyle: hasDate ? "normal" : "italic",
                  }}
                >
                  {hasDate ? du : "No date"}
                </span>
              </div>
            );
          })}
          {upcoming.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              No upcoming deadlines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
