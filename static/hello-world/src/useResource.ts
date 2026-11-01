import { useCallback, useEffect, useState } from "react";
export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };
export function useResource<T>(load: (signal?: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setResource({ status: "loading" });
    load(controller.signal).then(
      (data) => {
        if (current) setResource({ status: "ready", data });
      },
      (error) => {
        if (current)
          setResource({
            status: "error",
            error:
              error instanceof Error ? error.message : "Unable to load data",
          });
      },
    );
    return () => {
      current = false;
      controller.abort();
    };
  }, [load, attempt]);
  return { ...resource, retry };
}
