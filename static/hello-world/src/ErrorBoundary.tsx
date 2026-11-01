import React from "react";
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="panel" role="alert">
        <h2>This view could not be loaded</h2>
        <p>
          Your local session has not been sent to any external service. Reload
          to recover, or return to the dashboard.
        </p>
        <button onClick={() => location.reload()}>Reload application</button>
        <a href="./">Return to Mission Control</a>
      </section>
    ) : (
      this.props.children
    );
  }
}
