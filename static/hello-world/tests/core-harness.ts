// Dev-server test harness only. This entry is not part of the production build.
import React from "react";
import { createRoot } from "react-dom/client";
import CoreWorkspace from "../src/CoreWorkspace";
import { ForgeClient } from "../src/api/ForgeClient";
import "../src/styles/anticipate.css";
import { STORAGE_KEY } from "../src/app/preferences";

// `?theme=light|dark` is applied as the viewer's saved display choice (the
// product default is Dark since PR #25, so a host theme alone no longer
// changes it). `?host=` sets the Atlassian host theme for Automatic.
const params = new URLSearchParams(location.search);
const chosen = params.get("theme");
if (chosen === "light" || chosen === "dark") {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...saved, theme: chosen }),
    );
  } catch {
    /* storage unavailable: product default applies */
  }
}
const client = new ForgeClient(
  async (operation, input) =>
    (
      await fetch("/__core_test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, input }),
      })
    ).json(),
  250,
);
createRoot(document.getElementById("root")!).render(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "p",
      {
        role: "status",
        style: {
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: "white",
          color: "#111",
          margin: 0,
          padding: 8,
        },
      },
      "MOCK TRANSPORT TEST ONLY. No Forge session or real Jira action.",
    ),
    React.createElement(CoreWorkspace, {
      client,
      theme: params.get("host") === "dark" ? "dark" : "light",
    }),
  ),
);
