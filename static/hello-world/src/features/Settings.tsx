import React from "react";
import type { CapabilityAvailability } from "@anticipate/contracts";
import Icon from "../components/Icon";
import {
  Badge,
  Notice,
  PageHeader,
  Panel,
  TechDetails,
} from "../components/ui";
import type { Workflow } from "../app/useCoreWorkflow";
import { capabilityStateCopy } from "../app/copy";

type Key = Exclude<keyof CapabilityAvailability, "operations">;
const rows: { key: Key; name: string; what: string; inApp: string }[] = [
  {
    key: "jiraRead",
    name: "Jira read",
    what: "Read projects, issues and issue links you can access.",
    inApp: "Built in",
  },
  {
    key: "jiraWrite",
    name: "Jira write",
    what: "Create comments, links, labels or issues — only after approval and a separate execution step.",
    inApp: "Built in",
  },
  {
    key: "rovoMcp",
    name: "Rovo MCP tools",
    what: "Three read-only tools: get evidence graph, simulate retirement, get Prevention Passport.",
    inApp: "Declared by the app",
  },
  {
    key: "rovoAgent",
    name: "Rovo agent",
    what: "A conversational decision-review assistant.",
    inApp: "Not in this version",
  },
  {
    key: "confluenceRead",
    name: "Confluence read",
    what: "Use Confluence pages as additional evidence.",
    inApp: "Reported by backend",
  },
  {
    key: "teamworkGraph",
    name: "Teamwork Graph",
    what: "Additional relationship sources across Atlassian products.",
    inApp: "Not in this version",
  },
  {
    key: "workflowValidator",
    name: "Jira workflow validator",
    what: "Enforce decisions inside Jira transitions. ANTICIPATE policies are not workflow validators.",
    inApp: "Not in this version",
  },
  {
    key: "llm",
    name: "Language model",
    what: "Generated explanations. Decisions never depend on it.",
    inApp: "Reported by backend",
  },
];

export default function Settings({
  w,
  theme,
  hostNotice,
}: {
  w: Workflow;
  theme: string;
  hostNotice: string;
}) {
  const caps = w.capabilities;
  const listed =
    w.resource.status === "ready" && w.resource.data.first !== null;
  const verified = (key: Key) =>
    key === "jiraRead" && listed
      ? {
          tone: "success" as const,
          text: "Project list loaded in this session",
        }
      : key === "jiraWrite"
        ? {
            tone: "neutral" as const,
            text: "Verified per action, after execution",
          }
        : { tone: "neutral" as const, text: "Not verified by this screen" };
  return (
    <>
      <PageHeader
        icon="settings"
        step="Connections & transparency"
        title="Settings"
        lead="What this installation can do, as reported by the backend — and what has actually been verified."
        actions={
          <button
            className="ax-btn"
            disabled={!!w.busy}
            onClick={w.actions.retryBootstrap}
          >
            <Icon name="refresh" size={15} />
            Refresh capabilities
          </button>
        }
      />
      <Notice tone="neutral" icon="info" title="Three different things">
        <p>
          <strong>In this app</strong> means the code supports it.{" "}
          <strong>Backend reports</strong> is the state on this site.{" "}
          <strong>Verified here</strong> is only what this session has observed.
          A capability declared in the app manifest is not proof that an admin
          enabled it on this site.
        </p>
      </Notice>
      <Panel title="Capabilities" id="caps-title">
        <div
          className="ax-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Capabilities table"
        >
          <table className="ax-table ax-table--caps">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">In this app</th>
                <th scope="col">Backend reports</th>
                <th scope="col">Verified here</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const state = caps?.[r.key];
                const v = verified(r.key);
                return (
                  <tr key={r.key}>
                    <th scope="row">
                      {r.name}
                      <span className="ax-table__sub">{r.what}</span>
                    </th>
                    <td>{r.inApp}</td>
                    <td>
                      {state ? (
                        <Badge tone={capabilityStateCopy[state].tone} size="sm">
                          {capabilityStateCopy[state].label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                      {state && (
                        <span className="ax-table__sub">
                          {r.key}: {state}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={v.tone}
                        size="sm"
                        icon={v.tone === "success" ? "check" : "minus"}
                      >
                        {v.text}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="ax-grid ax-grid--two">
        <Panel
          title="Appearance"
          id="theme-title"
          description="ANTICIPATE follows the Atlassian host theme."
        >
          <p>
            Current theme:{" "}
            <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
          </p>
          {hostNotice && <p className="ax-muted ax-small">{hostNotice}</p>}
          <p className="ax-muted ax-small">
            Reduced motion and high-contrast preferences from your system are
            respected.
          </p>
        </Panel>
        <Panel title="Data and privacy" id="privacy-title">
          <ul className="ax-checklist">
            <li>
              <Icon name="eye" size={15} />
              <span>
                Reads Jira through Forge, with your permissions. Production
                accepts live responses only — no demo data is substituted.
              </span>
            </li>
            <li>
              <Icon name="lock" size={15} />
              <span>
                Writes happen only for actions you approve, in a separate
                execution step.
              </span>
            </li>
            <li>
              <Icon name="plug" size={15} />
              <span>This page loads no external scripts or fonts.</span>
            </li>
          </ul>
        </Panel>
      </div>
      <TechDetails label="Enabled backend operations">
        <p className="ax-small">
          Enabled operations: {caps?.operations.join(", ") || "none reported"}
        </p>
      </TechDetails>
    </>
  );
}
