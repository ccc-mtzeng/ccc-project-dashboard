import { Component } from "react";

/**
 * Catches render-time exceptions in the view area so one broken
 * component shows a recoverable error panel instead of white-screening
 * the whole app.
 *
 * @prop {string} [resetKey] — when this changes (e.g. on view switch),
 *   the boundary clears its error state and retries rendering.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render error:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating to a different view clears the error and retries.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          border: "1px solid #E24B4A",
          background: "#FCEBEB",
          borderRadius: 10,
          padding: "20px 24px",
          color: "#7A1D1D",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 17 }} />
          Something went wrong rendering this view
        </div>
        <div style={{ fontSize: 12, fontFamily: "monospace", marginBottom: 14, opacity: 0.8, whiteSpace: "pre-wrap" }}>
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            fontFamily: "inherit", fontSize: 13, fontWeight: 500,
            padding: "6px 14px", borderRadius: 6,
            border: "1px solid #E24B4A", background: "transparent",
            color: "#7A1D1D", cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
