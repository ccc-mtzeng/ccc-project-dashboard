export default function ProgressBar({ value, max, color, height = 6 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      style={{
        background: "var(--border-light)",
        borderRadius: 99,
        height,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: color,
          height: "100%",
          width: `${pct}%`,
          borderRadius: 99,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}
