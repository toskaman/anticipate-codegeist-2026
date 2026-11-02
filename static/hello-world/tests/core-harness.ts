// Dev-server test harness only. This entry is not part of the production build.
import React from "react";
import { createRoot } from "react-dom/client";
import CoreWorkspace from "../src/CoreWorkspace";
import { ForgeClient } from "../src/api/ForgeClient";
import "../src/styles/anticipate.css";
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
      theme:
        new URLSearchParams(location.search).get("theme") === "dark"
          ? "dark"
          : "light",
    }),
  ),
);
