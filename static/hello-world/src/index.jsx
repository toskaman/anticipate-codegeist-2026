import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
const App = import.meta.env.DEV
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
