export default function StatCard({ icon, label, value, sub }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        padding: "14px 16px",
        border: "0.5px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <i className={`ti ti-${icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
