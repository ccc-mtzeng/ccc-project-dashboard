export default function Badge({ label, color, bg }) {
  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 99,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
