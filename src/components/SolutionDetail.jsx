import Badge from "./shared/Badge";
import ProgressBar from "./shared/ProgressBar";
import StatCard from "./shared/StatCard";
import { STATUS_CONFIG, TASK_STATUS, CATEGORY_COLORS } from "../data/constants";
import { getTagInfo } from "../data/taxonomy";
import { formatDate, daysUntil } from "../data/utils";

export default function SolutionDetail({ solution, onBack }) {
  const s = solution;
  const sc = STATUS_CONFIG[s.status];
  const actual = s.tasks.reduce((a, t) => a + t.actual_hours, 0);

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: 13,
          padding: 0,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "inherit",
        }}
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} aria-hidden="true" />
        Back to solutions
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
          {s.title}
        </h2>
        <Badge label={sc.label} color={sc.color} bg={sc.bg} />
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        {s.customer} · v{s.version} · {s.author} · Go-live {formatDate(s.go_live_date)} (
        {daysUntil(s.go_live_date)})
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 18 }}>
        {s.tags.map((t) => {
          const info = getTagInfo(t);
          return <Badge key={t} {...info} />;
        })}
      </div>

      {s.notes && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginBottom: 18,
            padding: "10px 14px",
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-md)",
            lineHeight: 1.6,
          }}
        >
          {s.notes}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon="clock" label="Estimated" value={`${s.total_hours}h`} />
        <StatCard icon="player-play" label="Actual" value={`${actual}h`} />
        <StatCard
          icon="percentage"
          label="Progress"
          value={`${Math.round((actual / s.total_hours) * 100)}%`}
        />
        <StatCard
          icon="plus-minus"
          label="Variance"
          value={`${actual - s.total_hours > 0 ? "+" : ""}${actual - s.total_hours}h`}
        />
      </div>

      {/* Task table */}
      <div
        style={{
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 70px 70px 100px",
            padding: "8px 14px",
            background: "var(--bg-secondary)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          <span>Task</span>
          <span>Category</span>
          <span style={{ textAlign: "right" }}>Est.</span>
          <span style={{ textAlign: "right" }}>Actual</span>
          <span style={{ textAlign: "right" }}>Status</span>
        </div>

        {s.tasks.map((t, i) => {
          const ts = TASK_STATUS[t.status];
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 70px 70px 100px",
                padding: "10px 14px",
                borderTop: "0.5px solid var(--border-light)",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 450 }}>
                {t.name}
              </span>
              <span
                style={{ fontSize: 11, color: catColor, textTransform: "capitalize" }}
              >
                {t.category}
              </span>
              <span style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                {t.estimated_hours}h
              </span>
              <span
                style={{
                  textAlign: "right",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {t.actual_hours}h
              </span>
              <span style={{ textAlign: "right" }}>
                <Badge label={ts.label} color={ts.color} bg={ts.bg} />
              </span>
            </div>
          );
        })}

        {/* Totals row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 70px 70px 100px",
            padding: "10px 14px",
            borderTop: "1.5px solid var(--border-mid)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>Total</span>
          <span />
          <span style={{ textAlign: "right", color: "var(--text-secondary)" }}>
            {s.total_hours}h
          </span>
          <span style={{ textAlign: "right", color: "var(--text-primary)" }}>
            {actual}h
          </span>
          <span />
        </div>
      </div>

      {/* Hours breakdown bars */}
      <div
        style={{
          marginTop: 18,
          border: "0.5px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 10,
            color: "var(--text-primary)",
          }}
        >
          Hours breakdown
        </div>
        {s.tasks.map((t, i) => {
          const catColor = CATEGORY_COLORS[t.category] || "#888";
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 3,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{t.name}</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {t.actual_hours}/{t.estimated_hours}h
                </span>
              </div>
              <ProgressBar
                value={t.actual_hours}
                max={t.estimated_hours}
                color={catColor}
                height={5}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
