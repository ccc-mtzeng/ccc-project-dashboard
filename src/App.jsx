import { useState, useEffect, useCallback } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import SolutionList from "./components/SolutionList";
import SolutionDetail from "./components/SolutionDetail";
import Timeline from "./components/Timeline";
import SolutionUpload from "./components/SolutionUpload";
import Timesheet from "./components/Timesheet";
import { NAV_ITEMS } from "./data/constants";
import { AUTH_CONFIG, DATA_CONFIG } from "./data/config";
import { getStoredAuth, handleOAuthCallback, clearAuth } from "./services/auth";
import { configure, isConfigured, loadIndex, loadSolution, saveSolution, loadActivities, saveActivities, loadTimesheet, saveTimesheet } from "./services/github";
import { isoWeekKey, todayISO } from "./data/utils";

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

  // Live data state
  const [solutions, setSolutions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Timesheet state
  const [currentWeek, setCurrentWeek] = useState(isoWeekKey(todayISO()));
  const [timesheet, setTimesheet] = useState(null);
  const [timesheetSha, setTimesheetSha] = useState(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activitiesSha, setActivitiesSha] = useState(null);

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && !auth) {
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

  // Load solutions from GitHub after auth
  const fetchSolutions = useCallback(async () => {
    if (!isConfigured()) return;
    setDataLoading(true);
    setDataError("");

    try {
      const { data: index } = await loadIndex();

      if (!index || index.length === 0) {
        setSolutions([]);
        setDataLoading(false);
        return;
      }

      const results = await Promise.all(
        index.map((entry) =>
          loadSolution(entry.id).catch((err) => {
            console.warn(`Failed to load ${entry.id}:`, err);
            return null;
          })
        )
      );

      const loaded = results
        .filter((r) => r !== null)
        .map((r) => r.data);

      setSolutions(loaded);
    } catch (err) {
      console.error("Failed to load solutions:", err);
      setDataError(err.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth && isConfigured()) {
      fetchSolutions();
    }
  }, [auth, fetchSolutions]);

  // Load activities once on auth
  useEffect(() => {
    if (auth && isConfigured()) {
      loadActivities().then((result) => {
        setActivities(result.data || []);
        setActivitiesSha(result.sha);
      }).catch((err) => console.warn("Failed to load activities:", err));
    }
  }, [auth]);

  // Load timesheet when week changes
  useEffect(() => {
    if (!auth || !isConfigured()) return;
    setTimesheetLoading(true);
    loadTimesheet(currentWeek)
      .then((result) => {
        setTimesheet(result.data);
        setTimesheetSha(result.sha);
      })
      .catch((err) => {
        console.warn("Failed to load timesheet:", err);
        setTimesheet({ week: currentWeek, entries: [] });
        setTimesheetSha(null);
      })
      .finally(() => setTimesheetLoading(false));
  }, [auth, currentWeek]);

  async function handleTimesheetSave(weekKey, data, sha) {
    const result = await saveTimesheet(weekKey, data, sha);
    setTimesheet(data);
    setTimesheetSha(result.sha);
  }

  async function handleActivitiesSave(updatedActivities) {
    const result = await saveActivities(updatedActivities, activitiesSha);
    setActivities(updatedActivities);
    setActivitiesSha(result.sha);
  }

  async function handleRefresh() {
    // Reload activities
    try {
      const actResult = await loadActivities();
      setActivities(actResult.data || []);
      setActivitiesSha(actResult.sha);
    } catch (err) {
      console.warn("Failed to reload activities:", err);
    }
    // Reload current week's timesheet
    try {
      const tsResult = await loadTimesheet(currentWeek);
      setTimesheet(tsResult.data);
      setTimesheetSha(tsResult.sha);
    } catch (err) {
      console.warn("Failed to reload timesheet:", err);
    }
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setSolutions([]);
    setView("dashboard");
    setSelectedId(null);
  }

  // Not authenticated — show login
  if (!auth) {
    return <Login error={authError} loading={authLoading} />;
  }

  // Active solutions = not excluded (for Dashboard + Timeline)
  const activeSolutions = solutions.filter((s) => !s.excluded);
  const selected = solutions.find((s) => s.id === selectedId);

  function handleSelect(id) {
    setSelectedId(id);
    setView("detail");
  }

  function handleSolutionSaved(sol) {
    fetchSolutions().then(() => {
      setSelectedId(sol.id);
      setView("detail");
    });
  }

  // Save handler for detail view (exclude/restore)
  async function handleDetailSave(updatedSolution) {
    await saveSolution(updatedSolution);
    await fetchSolutions();
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
          Solution Tracker
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

      {/* Loading state */}
      {dataLoading && solutions.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div
            style={{
              width: 28, height: 28,
              border: "3px solid var(--border-light)",
              borderTopColor: "var(--text-primary)",
              borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Loading solutions…
          </div>
        </div>
      )}

      {/* Error state */}
      {dataError && (
        <div
          style={{
            background: "#FCEBEB",
            border: "1px solid #E24B4A",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "#7A1D1D",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-alert-circle" style={{ fontSize: 16 }} />
          Failed to load solutions: {dataError}
          <button
            onClick={fetchSolutions}
            style={{
              marginLeft: "auto", fontFamily: "inherit", fontSize: 12,
              padding: "4px 10px", borderRadius: 6,
              border: "1px solid #E24B4A", background: "transparent",
              color: "#7A1D1D", cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!dataLoading && !dataError && solutions.length === 0 && view !== "upload" && view !== "timesheet" && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <i
            className="ti ti-folder-off"
            style={{ fontSize: 36, color: "var(--text-secondary)", display: "block", marginBottom: 12 }}
          />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
            No solutions yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Import a solution design PDF to get started.
          </div>
          <button
            onClick={() => setView("upload")}
            style={{
              fontFamily: "inherit", fontSize: 13, fontWeight: 500,
              padding: "8px 16px", borderRadius: 6, border: "none",
              background: "var(--text-primary)", color: "var(--bg-primary)",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="ti ti-file-upload" style={{ fontSize: 15 }} />
            Import solution
          </button>
        </div>
      )}

      {/* Views — Dashboard and Timeline use activeSolutions (excludes excluded) */}
      {!dataLoading && view === "dashboard" && activeSolutions.length > 0 && (
        <Dashboard solutions={activeSolutions} onSelect={handleSelect} />
      )}
      {/* Show empty dashboard message if all solutions are excluded */}
      {!dataLoading && view === "dashboard" && solutions.length > 0 && activeSolutions.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-secondary)", fontSize: 13 }}>
          All solutions are currently excluded. Check the Solutions view to restore them.
        </div>
      )}
      {!dataLoading && view === "solutions" && solutions.length > 0 && (
        <SolutionList solutions={solutions} onSelect={handleSelect}
          filterTag={filterTag} setFilterTag={setFilterTag}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
      )}
      {!dataLoading && view === "timeline" && activeSolutions.length > 0 && (
        <Timeline solutions={activeSolutions} onSelect={handleSelect} />
      )}
      {view === "detail" && selected && (
        <SolutionDetail solution={selected} onBack={() => setView("solutions")} onSave={handleDetailSave} username={auth?.username} activities={activities} />
      )}
      {view === "upload" && (
        <SolutionUpload
          workerUrl={AUTH_CONFIG.workerUrl}
          onSaved={handleSolutionSaved}
          solutions={solutions}
        />
      )}
      {view === "timesheet" && (
        <Timesheet
          activities={activities}
          timesheet={timesheet}
          timesheetSha={timesheetSha}
          solutions={solutions}
          onSave={handleTimesheetSave}
          onSaveActivities={handleActivitiesSave}
          onWeekChange={setCurrentWeek}
          currentWeek={currentWeek}
          loading={timesheetLoading}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
