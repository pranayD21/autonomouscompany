import {Component, type ErrorInfo, type ReactNode} from "react";
import "./error-boundary.css";

/** Keeps one render error from blanking the whole app; offers a reload and a way back to the workspace. */
export class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch(error: unknown, info: ErrorInfo) { console.error("Assurance render error", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="error-boundary">
      <div className="error-boundary-card" role="alert">
        <h1>Something went wrong on this page.</h1>
        <p>Your cases are safe. Reload to try again, or go back to your workspace.</p>
        <div className="error-boundary-actions">
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
          <a href="#workspace" onClick={() => this.setState({failed: false})}>Back to your cases</a>
        </div>
      </div>
    </main>;
  }
}
