import { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import SolutionList from "./components/SolutionList";
import SolutionDetail from "./components/SolutionDetail";
import Timeline from "./components/Timeline";
import SolutionUpload from "./components/SolutionUpload";
import { SEED_SOLUTIONS } from "./data/solutions";
import { NAV_ITEMS } from "./data/constants";
import { AUTH_CONFIG, DATA_CONFIG } from "./data/config";
import { getStoredAuth, handleOAuthCallback, clearAuth } from "./services/auth";
import { configure } from "./services/github";

const pillStyle = {
  fontSize: 12, padding: "4px 10px", borderRadius: 99, cursor: "pointer",
  border: "1px solid var(--border-light)", fontWeight: 450,
  fontFamily: "inherit", transition: "all 0.15s",
};

export default function App() {
  const [auth, setAuth] = useState(getStoredAuth);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [filterTag, setFilterTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && !auth) {
      // Clean the URL so the code doesn't linger
      window.history.replaceState({}, "", window.location.pathname);
      setAuthLoading(true);

      handleOAuthCallback(code)
        .then((result) => {
          setAuth(result);
          setAuthLoading(false);
        })
        .catch((err) => {
          setAuthError(err.message);
          setAuthLoading(false);
        });
    }
  }, []);

  // Configure GitHub service when auth exists
  useEffect(() => {
    if (auth) {
      configure({
        owner: DATA_CONFIG.owner,
        repo: DATA_CONFIG.repo,
        token: auth.token,
      });
    }
  }, [auth]);

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setView("dashboard");
    setSelectedId(null);
  }

  // Not authenticated — show login
  if (!auth) {
    return <Login error={authError} loading={authLoading} />;
  }

  // TODO: Replace with GitHub API loading once data repo is seeded
  const solutions = SEED_SOLUTIONS;
  const selected = solutions.find((s) => s.id === selectedId);

  function handleSelect(id) {
    setSelectedId(id);
    setView("detail");
  }

  function handleSolutionSaved(sol) {
    // After saving a new solution via upload, navigate to it
    // (Once wired to live data, this would trigger a refresh)
    setSelectedId(sol.id);
    setView("detail");
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
      {/* Nav header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 20, paddingBottom: 12,
          borderBottom: "0.5px solid var(--border-light)",
        }}
      >
        <div
          style={{
            fontSize: 16, fontWeight: 500, color: "var(--text-primary)",
            marginRight: "auto", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-chart-bar" style={{ fontSize: 18 }} aria-hidden="true" />
          Solution tracker
        </div>

        {NAV_ITEMS.map((n) => {
          const isActive = view === n.id || (view === "detail" && n.id === "solutions");
          return (
            <button
              key={n.id}
              onClick={() => { setView(n.id); setSelectedId(null); }}
              style={{
                ...pillStyle,
                background: isActive ? "var(--text-primary)" : "transparent",
                color: isActive ? "var(--bg-primary)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <i className={`ti ${n.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
              {n.label}
            </button>
          );
        })}

        {/* User avatar + logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            ...pillStyle, display: "flex", alignItems: "center", gap: 6,
            color: "var(--text-secondary)", background: "transparent",
          }}
        >
          {auth.avatar && (
            <img
              src={auth.avatar}
              alt=""
              style={{ width: 18, height: 18, borderRadius: 99 }}
            />
          )}
          {auth.username}
          <i className="ti ti-logout" style={{ fontSize: 13 }} aria-hidden="true" />
        </button>
      </div>

      {/* Views */}
      {view === "dashboard" && <Dashboard solutions={solutions} onSelect={handleSelect} />}
      {view === "solutions" && (
        <SolutionList solutions={solutions} onSelect={handleSelect}
          filterTag={filterTag} setFilterTag={setFilterTag}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
      )}
      {view === "timeline" && <Timeline solutions={solutions} onSelect={handleSelect} />}
      {view === "detail" && selected && (
        <SolutionDetail solution={selected} onBack={() => setView("solutions")} />
      )}
      {view === "upload" && (
        <SolutionUpload
          workerUrl={AUTH_CONFIG.workerUrl}
          onSaved={handleSolutionSaved}
        />
      )}
    </div>
  );
}
