import { useState } from "react";
import Dashboard from "./components/Dashboard";
import SolutionList from "./components/SolutionList";
import SolutionDetail from "./components/SolutionDetail";
import Timeline from "./components/Timeline";
import { SEED_SOLUTIONS } from "./data/solutions";
import { NAV_ITEMS } from "./data/constants";

const pillStyle = {
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: "1px solid var(--border-light)",
  fontWeight: 450,
  fontFamily: "inherit",
  transition: "all 0.15s",
};

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [filterTag, setFilterTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // TODO: Replace with GitHub API loading once wired up
  const solutions = SEED_SOLUTIONS;
  const selected = solutions.find((s) => s.id === selectedId);

  function handleSelect(id) {
    setSelectedId(id);
    setView("detail");
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "24px 20px 60px",
      }}
    >
      {/* Navigation header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "0.5px solid var(--border-light)",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--text-primary)",
            marginRight: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i
            className="ti ti-chart-bar"
            style={{ fontSize: 18 }}
            aria-hidden="true"
          />
          Solution tracker
        </div>

        {NAV_ITEMS.map((n) => {
          const isActive =
            view === n.id || (view === "detail" && n.id === "solutions");
          return (
            <button
              key={n.id}
              onClick={() => {
                setView(n.id);
                setSelectedId(null);
              }}
              style={{
                ...pillStyle,
                background: isActive
                  ? "var(--text-primary)"
                  : "transparent",
                color: isActive
                  ? "var(--bg-primary)"
                  : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className={`ti ${n.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
              {n.label}
            </button>
          );
        })}
      </div>

      {/* View router */}
      {view === "dashboard" && (
        <Dashboard solutions={solutions} onSelect={handleSelect} />
      )}
      {view === "solutions" && (
        <SolutionList
          solutions={solutions}
          onSelect={handleSelect}
          filterTag={filterTag}
          setFilterTag={setFilterTag}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
        />
      )}
      {view === "timeline" && (
        <Timeline solutions={solutions} onSelect={handleSelect} />
      )}
      {view === "detail" && selected && (
        <SolutionDetail solution={selected} onBack={() => setView("solutions")} />
      )}
    </div>
  );
}
