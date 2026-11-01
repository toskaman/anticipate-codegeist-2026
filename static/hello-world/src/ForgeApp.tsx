import React, { useCallback, useEffect, useState } from "react";
import { ForgeClient } from "./api/ForgeClient";
import { useResource } from "./useResource";
import "./style.css";
const client = new ForgeClient(async (resolver, input) =>
  (await import("@forge/bridge")).invoke(resolver, input),
);
export default function ForgeApp() {
  const [theme, setTheme] = useState("light");
  const [themeNotice, setThemeNotice] = useState("");
  useEffect(() => {
    let active = true;
    const sync = () =>
      setTheme(
        document.documentElement.getAttribute("data-color-mode") === "dark"
          ? "dark"
          : "light",
      );
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode"],
    });
    Promise.resolve()
      .then(async () => {
        const { view } = await import("@forge/bridge");
        await view.theme.enable();
      })
      .then(() => {
        if (active) sync();
      })
      .catch(() => {
        if (active)
          setThemeNotice(
            "Host theme unavailable outside a supported Forge installation.",
          );
      });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  const load = useCallback(async (signal?: AbortSignal) => {
    const capabilities = await client.getCapabilities(signal);
    const projects = capabilities.operations.includes("getProjects")
      ? await client.getProjects(signal)
      : null;
    return { capabilities, projects };
  }, []);
  const resource = useResource(load);
  return (
    <div className="app" data-theme={theme}>
      <main id="main">
        <p className="eyebrow">ANTICIPATE · FORGE</p>
        <h1>The Decision Firewall</h1>
        <p>Test the consequences. Prove the safeguards. Then ship.</p>
        <section className="panel">
          <h2>Connect your installed workspace</h2>
          <p>
            This production build uses Forge capability discovery. Fixture data
            and simulated approvals are unavailable.
          </p>
          {resource.status === "loading" ? (
            <p role="status">Checking backend capabilities…</p>
          ) : resource.status === "error" ? (
            <div role="alert">
              <p>{resource.error}</p>
              <button onClick={resource.retry}>Retry capability check</button>
            </div>
          ) : resource.data.projects === null ? (
            <>
              <span className="badge">PENDING_BACKEND</span>
              <p>
                CORE resolver contracts are not configured. No projects,
                permissions or execution results have been assumed.
              </p>
            </>
          ) : resource.data.projects.length === 0 ? (
            <>
              <h3>No projects available</h3>
              <p>
                Check Jira project access with your administrator, then refresh.
                No demonstration projects have been inserted.
              </p>
              <button onClick={resource.retry}>Refresh projects</button>
            </>
          ) : (
            <ul>
              {resource.data.projects.map((project) => (
                <li key={project.id}>
                  {project.name} — analysis contract pending
                </li>
              ))}
            </ul>
          )}
          <h3>Installation and access</h3>
          <p>
            The existing full-page module requires a Jira-compatible
            installation. Ask the app owner for the verified installation link
            and full-page URL. An Apps-menu entry is not assumed.
          </p>
          <p>
            Permissions and action authorization must be checked by the backend.
            No credentials should be entered into this interface.
          </p>
          {themeNotice && <p className="muted">{themeNotice}</p>}
        </section>
      </main>
    </div>
  );
}
