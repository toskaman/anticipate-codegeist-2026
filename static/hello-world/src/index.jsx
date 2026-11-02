import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
// A Forge tunnel is also a Vite development server. Never show the authored
// prototype inside a host iframe; LIVE envelopes still require Forge authorization.
const localPrototype =
  import.meta.env.DEV &&
  window.self === window.top &&
  !new URLSearchParams(location.search).has("core");
const App = localPrototype
  ? lazy(() => import("./App.tsx"))
  : lazy(() => import("./ForgeApp.tsx"));
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<p role="status">Loading ANTICIPATE…</p>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
