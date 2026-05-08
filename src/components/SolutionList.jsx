import { useState } from "react";
import Badge from "./shared/Badge";
import { STATUS_CONFIG } from "../data/constants";
import { TAG_TAXONOMY, getTagInfo } from "../data/taxonomy";
import { formatDate } from "../data/utils";

const pillStyle = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: "1px solid var(--border-light)",
  fontWeight: 450,
  fontFamily: "inherit",
  transition: "all 0.15s",
  background: "transparent",
};

export default function SolutionList({
  solutions,
  onSelect,
  filterTag,
  setFilterTag,
  filterStatus,
  setFilterStatus,
}) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const allTaxonomyKeys = Object.keys(TAG_TAXONOMY);
  const activeTagInfo = filterTag ? TAG_TAXONOMY[filterTag] : null;

  const filtered = solutions.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterTag && !s.tags.some((t) => t.startsWith(filterTag))) return false;
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setFilterStatus("")}
          style={{
            ...pillStyle,
            background: !filterStatus
              ? "var(--text-primary)"
              : "transparent",
            color: !filterStatus
              ? "var(--bg-primary)"
              : "var(--text-secondary)",
          }}
        >
          All
        </button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilterStatus(filterStatus === k ? "" : k)}
            style={{
              ...pillStyle,
              background: filterStatus === k ? v.bg : "transparent",
              color: filterStatus === k ? v.color : "var(--text-secondary)",
              border:
                filterStatus === k
                  ? `1px solid ${v.color}33`
                  : "1px solid var(--border-light)",
            }}
          >
            {v.label}
          </button>
        ))}

        {/* Process area dropdown */}
        <div style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            style={{
              ...pillStyle,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: filterTag ? activeTagInfo.bg : "transparent",
              color: filterTag
                ? activeTagInfo.color
                : "var(--text-secondary)",
              border: filterTag
                ? `1px solid ${activeTagInfo.color}33`
                : "1px solid var(--border-light)",
            }}
          >
            <i
              className="ti ti-filter"
              style={{ fontSize: 13 }}
              aria-hidden="true"
            />
            {filterTag ? activeTagInfo.label : "Process area"}
            <i
              className={`ti ti-chevron-${tagDropdownOpen ? "up" : "down"}`}
              style={{ fontSize: 12 }}
              aria-hidden="true"
            />
          </button>

          {tagDropdownOpen && (
            <>
              <div
                onClick={() => setTagDropdownOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 9 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 10,
                  background: "var(--bg-primary)",
                  border: "0.5px solid var(--border-mid)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 0",
                  minWidth: 220,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                }}
              >
                <button
                  onClick={() => {
                    setFilterTag("");
                    setTagDropdownOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "7px 14px",
                    background: !filterTag
                      ? "var(--bg-secondary)"
                      : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: "inherit",
                    color: "var(--text-secondary)",
                    textAlign: "left",
                  }}
                >
                  All process areas
                </button>
                {allTaxonomyKeys.map((k) => {
                  const t = TAG_TAXONOMY[k];
                  const isActive = filterTag === k;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        setFilterTag(isActive ? "" : k);
                        setTagDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "7px 14px",
                        background: isActive
                          ? "var(--bg-secondary)"
                          : "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontFamily: "inherit",
                        color: "var(--text-primary)",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 99,
                          background: t.color,
                          flexShrink: 0,
                        }}
                      />
                      {t.label}
                      {isActive && (
                        <i
                          className="ti ti-check"
                          style={{
                            fontSize: 14,
                            marginLeft: "auto",
                            color: t.color,
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {filterTag && (
          <button
            onClick={() => setFilterTag("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-secondary)",
              padding: "2px 4px",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <i
              className="ti ti-x"
              style={{ fontSize: 12 }}
              aria-hidden="true"
            />{" "}
            Clear
          </button>
        )}
      </div>

      {/* Solution cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((s) => {
          const actual = s.tasks.reduce((a, t) => a + t.actual_hours, 0);
          const sc = STATUS_CONFIG[s.status];
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                border: "0.5px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-mid)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-light)")
              }
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {s.title}
                  </span>
                  <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  {s.customer} · Go-live {formatDate(s.go_live_date)}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {s.tags.map((t) => {
                    const info = getTagInfo(t);
                    return <Badge key={t} {...info} />;
                  })}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {actual}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--text-secondary)",
                  }}
                >
                  /{s.total_hours}h
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            No solutions match filters
          </div>
        )}
      </div>
    </div>
  );
}
