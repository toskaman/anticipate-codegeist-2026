import React from "react";
import { CoreClientError } from "./api/ForgeClient";

export interface CoreErrorDetails {
  code: string;
  message: string;
  requestId: string | null;
  retryable: boolean;
}

/**
 * Extracts the ForgeClient failure contract (code/requestId/retryable) from a
 * caught render error. Falls back to duck typing so errors crossing a module
 * boundary with the same shape are still recognized.
 */
export function coreErrorDetails(error: unknown): CoreErrorDetails | null {
  if (error instanceof CoreClientError) {
    return {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      retryable: error.retryable,
    };
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const shaped = error as {
      code: string;
      message?: unknown;
      requestId?: unknown;
      retryable?: unknown;
    };
    return {
      code: shaped.code,
      message:
        typeof shaped.message === "string"
          ? shaped.message
          : "Request failed. No success is assumed.",
      requestId: typeof shaped.requestId === "string" ? shaped.requestId : null,
      retryable: shaped.retryable === true,
    };
  }
  return null;
}

/**
 * CoreClientError messages already embed the code prefix and the request
 * suffix; both are shown in their own elements, so strip them here to avoid
 * reading the same values twice.
 */
function displayMessage(details: CoreErrorDetails): string {
  let message = details.message;
  if (message.startsWith(`${details.code}: `)) {
    message = message.slice(details.code.length + 2);
  }
  if (details.requestId) {
    const suffix = ` (request ${details.requestId})`;
    if (message.endsWith(suffix)) message = message.slice(0, -suffix.length);
  }
  return message;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { failed: boolean; error: unknown }
> {
  state = { failed: false, error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }
  private handleRetry = () => {
    this.setState({ failed: false, error: null });
    this.props.onRetry?.();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    const details = coreErrorDetails(this.state.error);
    return (
      <section className="panel" role="alert" aria-live="assertive">
        <h2>This view could not be loaded</h2>
        <p>
          Your local session has not been sent to any external service. Reload
          to recover, or return to the dashboard.
        </p>
        {details && (
          <p className="ax-error__message">
            <span className="ax-error__code">{details.code}</span>
            <span>{displayMessage(details)}</span>
          </p>
        )}
        {details?.requestId && (
          <p>
            Request ID: <code className="ax-code">{details.requestId}</code>
          </p>
        )}
        {details && (
          <p className="ax-muted">
            {details.retryable
              ? "This request may succeed if you try it again. No automatic retry was made."
              : "Check the selected project and request inputs before trying again."}
          </p>
        )}
        <button onClick={this.handleRetry}>Try again</button>
        <button onClick={() => location.reload()}>Reload application</button>
        <a href="./">Return to Mission Control</a>
      </section>
    );
  }
}
