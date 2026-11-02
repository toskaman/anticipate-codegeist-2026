import React from "react";
export interface OperationFailure {
  message: string;
  code: string;
  retryable: boolean;
  mutation: boolean;
}
export default function CoreOperationError({
  failure,
  onDismiss,
}: {
  failure: OperationFailure;
  onDismiss(): void;
}) {
  const guidance = failure.mutation
    ? "Read current plan status and audit before another write. No automatic resubmission was made."
    : failure.code === "INVALID_RESPONSE"
      ? "The service response could not be verified. Read it again before using its results."
      : failure.code === "RATE_LIMITED"
        ? "Jira limited this request. Wait before trying the read again. No automatic retry was made."
        : failure.code === "PERMISSION_DENIED"
          ? "Check your Jira project permissions before trying this request again."
          : failure.code === "SNAPSHOT_EXPIRED"
            ? "Read a new snapshot and compare again. Existing plan status and audit can still be recovered."
            : failure.retryable ||
                ["NETWORK_ERROR", "TIMEOUT", "UPSTREAM_UNAVAILABLE"].includes(
                  failure.code,
                )
              ? "Try this read again when the service is available. No automatic retry was made."
              : "Check the selected project and request inputs before trying again.";
  return (
    <section className="panel" role="alert">
      <h2>{failure.mutation ? "Review action outcome" : "Request failed"}</h2>
      <p>{failure.message}</p>
      <p>{guidance}</p>
      <button onClick={onDismiss}>Dismiss error</button>
    </section>
  );
}
