export default function ProgressBar({ value, max, color, height = 6 }) {
  const over = value > max && max > 0;
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = over ? "#E24B4A" : color;

  return (
    <div
      style={{
        background: "var(--border-light)",
        borderRadius: 99,
        height,
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: barColor,
          height: "100%",
          width: `${pct}%`,
          borderRadius: 99,
          transition: "width 0.4s ease, background 0.3s ease",
        }}
      />
    </div>
  );
}
