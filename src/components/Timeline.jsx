import { STATUS_CONFIG } from "../data/constants";
import { daysBetween, todayISO } from "../data/utils";

export default function Timeline({ solutions, onSelect }) {
  const all = [...solutions].sort(
    (a, b) => new Date(a.date_created) - new Date(b.date_created)
  );

  const dates = all.flatMap((s) => [s.date_created, s.go_live_date]);
  const minDate = new Date(Math.min(...dates.map((d) => new Date(d))));
  const maxDate = new Date(Math.max(...dates.map((d) => new Date(d))));
  const totalDays =
    daysBetween(
      minDate.toISOString().slice(0, 10),
      maxDate.toISOString().slice(0, 10)
    ) + 14;

  const todayOffset = daysBetween(
    minDate.toISOString().slice(0, 10),
    todayISO()
  );
  const todayPct = (todayOffset / totalDays) * 100;

  const months = [];
  const d = new Date(minDate);
  d.setDate(1);
  while (d <= maxDate) {
    const offset = daysBetween(
      minDate.toISOString().slice(0, 10),
      d.toISOString().slice(0, 10)
    );
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      pct: (offset / totalDays) * 100,
    });
    d.setMonth(d.getMonth() + 1);
  }

  return (
    <div>
      <div
        style={{
          position: "relative",
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "12px 16px",
          overflow: "hidden",
        }}
      >
        {/* Today marker */}
        <div
          style={{
            position: "absolute",
            left: `${todayPct}%`,
            top: 0,
            bottom: 0,
            width: 1.5,
            background: "#E24B4A",
            opacity: 0.6,
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${todayPct}%`,
            top: 4,
            transform: "translateX(-50%)",
            fontSize: 10,
            color: "#E24B4A",
            fontWeight: 500,
            zIndex: 3,
          }}
        >
          Today
        </div>

        {/* Month headers */}
        <div
          style={{
            display: "flex",
            borderBottom: "0.5px solid var(--border-light)",
            paddingBottom: 6,
            marginBottom: 8,
            position: "relative",
            height: 20,
          }}
        >
          {months.map((m, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${m.pct}%`,
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Solution bars */}
        {all.map((s) => {
          const startOffset = daysBetween(
            minDate.toISOString().slice(0, 10),
            s.date_created
          );
          const endOffset = daysBetween(
            minDate.toISOString().slice(0, 10),
            s.go_live_date
          );
          const leftPct = (startOffset / totalDays) * 100;
          const widthPct = ((endOffset - startOffset) / totalDays) * 100;
          const sc = STATUS_CONFIG[s.status];
          const actual = s.tasks.reduce((a, t) => a + t.actual_hours, 0);
          const progressPct =
            s.total_hours > 0 ? (actual / s.total_hours) * 100 : 0;

          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                position: "relative",
                height: 38,
                marginBottom: 6,
                cursor: "pointer",
              }}
            >
              {/* Customer label to the left of the bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 10,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  width: `${leftPct}%`,
                  textAlign: "right",
                  paddingRight: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.customer}
              </div>

              {/* Solution bar */}
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 3)}%`,
                  top: 4,
                  height: 28,
                  background: sc.bg,
                  borderRadius: 6,
                  border: `0.5px solid ${sc.color}44`,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 8,
                }}
              >
                {/* Progress fill */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progressPct}%`,
                    background: `${sc.color}22`,
                    borderRadius: 6,
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
                  }}
                >
                  {s.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
