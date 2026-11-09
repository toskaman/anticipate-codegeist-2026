import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BuildInfo } from "@anticipate/contracts";
import type { ForgeClient } from "../api/ForgeClient";
import { Code, KeyValues, Notice, Panel, Spinner } from "./ui";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; info: BuildInfo }
  | { status: "error" };

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

// Last-resort fallback (#225): programmatic text selection needs no
// clipboard permission or focus, so it works where both copy paths fail
// (e.g. the Forge iframe). Returns whether the element is now selected.
function selectElementText(el: HTMLElement | null): boolean {
  try {
    if (!el) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.addRange(range);
    return true;
  } catch {
    return false;
  }
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Build identity reported by the backend (#217). Lazy: a single
 * getBuildInfo request when Settings mounts; retry is user-initiated only.
 * No polling, no timers, no cached deployment data.
 */
export default function BuildInfoPanel({ client }: { client: ForgeClient }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [shaSelected, setShaSelected] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const shaRef = useRef<HTMLElement | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      // Last attempt wins: supersede any prior in-flight request so two
      // identical requests are never concurrently outstanding (incl. dev
      // StrictMode remounts). Retry and unmount stay deterministic.
      inFlight.current?.abort();
      const own = new AbortController();
      inFlight.current = own;
      const effective = signal ?? own.signal;
      setState({ status: "loading" });
      try {
        const info = await client.request("getBuildInfo", {}, effective);
        if (effective.aborted) return;
        setState({ status: "ready", info });
      } catch {
        if (effective.aborted) return;
        setState({ status: "error" });
      } finally {
        if (inFlight.current === own) inFlight.current = null;
      }
    },
    [client],
  );

  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);

  const retry = useCallback(() => {
    setCopied(false);
    setCopyFailed(false);
    setShaSelected(false);
    void load();
  }, [load]);

  const copy = useCallback(async (value: string) => {
    setCopyFailed(false);
    setShaSelected(false);
    if (await copyText(value)) {
      setCopied(true);
    } else if (selectElementText(shaRef.current)) {
      setCopied(false);
      setShaSelected(true);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  }, []);

  const info = state.status === "ready" ? state.info : null;

  return (
    <Panel
      title="Build Information"
      id="build-info-title"
      description="Which code revision this installation runs, as reported by the backend."
    >
      {state.status === "loading" && (
        <p role="status">
          <Spinner /> Loading build information…
        </p>
      )}
      {state.status === "error" && (
        <>
          <Notice
            tone="danger"
            role="alert"
            title="Could not load build information"
          >
            The backend did not respond with build metadata. This is a failed
            request, not an unstamped build.
          </Notice>
          <p>
            <button type="button" className="ax-btn" onClick={retry}>
              Retry
            </button>
          </p>
        </>
      )}
      {info && info.commit === null && info.builtAt === null && (
        <Notice tone="neutral" title="Build metadata unavailable">
          This deployment did not stamp build information, so there is no commit
          or build time to show. Development tunnels, CI builds and older
          releases report no metadata.
        </Notice>
      )}
      {info && (info.commit !== null || info.builtAt !== null) && (
        <KeyValues
          items={[
            [
              "Commit",
              info.commit ? (
                <>
                  <Code>{info.commit.slice(0, 7)}</Code>{" "}
                  <button
                    type="button"
                    className="ax-btn"
                    aria-label={
                      copied
                        ? "Copied to clipboard"
                        : "Copy full SHA to clipboard"
                    }
                    onClick={() => void copy(info.commit as string)}
                  >
                    {copied ? "Copied" : "Copy full SHA"}
                  </button>
                </>
              ) : (
                <span className="ax-muted">
                  Not reported by this deployment.
                </span>
              ),
            ],
            ...(info.commit
              ? ([
                  [
                    "Full SHA",
                    <Code key="full">
                      <span ref={shaRef}>{info.commit}</span>
                    </Code>,
                  ],
                ] as [React.ReactNode, React.ReactNode][])
              : []),
            [
              "Built",
              info.builtAt ? (
                <time dateTime={info.builtAt} title={info.builtAt}>
                  {formatLocal(info.builtAt)}
                </time>
              ) : (
                <span className="ax-muted">
                  Not reported by this deployment.
                </span>
              ),
            ],
          ]}
        />
      )}
      {shaSelected && (
        <p role="status" className="ax-muted ax-small">
          Copy is unavailable in this browser context. The full SHA above is now
          selected — copy it manually.
        </p>
      )}
      {copyFailed && (
        <p role="status" className="ax-muted ax-small">
          Copy failed. Select the full SHA above to copy it manually.
        </p>
      )}
    </Panel>
  );
}
