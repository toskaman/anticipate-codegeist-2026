import { useCallback, useEffect, useState } from "react";
export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };
export function useResource<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let current = true;
    setResource({ status: "loading" });
    load().then(
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
    };
  }, [load, attempt]);
  return { ...resource, retry };
}
