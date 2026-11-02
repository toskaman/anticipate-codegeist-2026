import React, { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import type { Preferences, PreferencesApi } from "../app/preferences";

type Option<K extends keyof Preferences> = {
  value: Preferences[K];
  label: string;
};
const groups: {
  [K in keyof Preferences]: {
    key: K;
    legend: string;
    hint: string;
    options: Option<K>[];
  };
}[keyof Preferences][] = [
  {
    key: "theme",
    legend: "Theme",
    hint: "Automatic follows your Atlassian appearance.",
    options: [
      { value: "system", label: "Automatic" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  },
  {
    key: "textSize",
    legend: "Text size",
    hint: "Enlarges text across every screen.",
    options: [
      { value: "default", label: "Default" },
      { value: "large", label: "Large" },
      { value: "larger", label: "Larger" },
    ],
  },
  {
    key: "contrast",
    legend: "Contrast",
    hint: "High contrast strengthens text, borders and status colours.",
    options: [
      { value: "system", label: "System" },
      { value: "high", label: "High" },
    ],
  },
  {
    key: "motion",
    legend: "Motion",
    hint: "Reduce removes animations and transitions.",
    options: [
      { value: "system", label: "System" },
      { value: "reduce", label: "Reduce" },
    ],
  },
  {
    key: "layout",
    legend: "Visual style",
    hint: "Simplified removes decorative backgrounds, shadows and gradients.",
    options: [
      { value: "standard", label: "Standard" },
      { value: "calm", label: "Simplified" },
    ],
  },
  {
    key: "focus",
    legend: "Keyboard focus",
    hint: "Enhanced shows a thicker, high-visibility focus outline.",
    options: [
      { value: "standard", label: "Standard" },
      { value: "enhanced", label: "Enhanced" },
    ],
  },
  {
    key: "links",
    legend: "Links",
    hint: "Underline makes every link visibly distinct from text.",
    options: [
      { value: "standard", label: "Standard" },
      { value: "underline", label: "Underline" },
    ],
  },
];

/** Shared controls used by the top-bar menu and the Settings screen. */
export function AccessibilityControls({
  api,
  hostNote,
}: {
  api: PreferencesApi;
  hostNote?: string;
}) {
  const base = useId();
  return (
    <div className="ax-prefs">
      {groups.map((g) => (
        <fieldset key={g.key} className="ax-prefs__group">
          <legend>{g.legend}</legend>
          <div className="ax-segmented" role="presentation">
            {g.options.map((o) => {
              const id = `${base}-${g.key}-${o.value}`;
              return (
                <span key={o.value} className="ax-segmented__item">
                  <input
                    type="radio"
                    id={id}
                    name={`${base}-${g.key}`}
                    value={o.value}
                    checked={api.prefs[g.key] === o.value}
                    onChange={() =>
                      api.update(g.key, o.value as Preferences[typeof g.key])
                    }
                    aria-describedby={`${base}-${g.key}-hint`}
                  />
                  <label htmlFor={id}>{o.label}</label>
                </span>
              );
            })}
          </div>
          <p className="ax-prefs__hint" id={`${base}-${g.key}-hint`}>
            {g.hint}
            {g.key === "theme" && hostNote ? ` ${hostNote}` : ""}
          </p>
        </fieldset>
      ))}
      <div className="ax-prefs__footer">
        <button
          type="button"
          className="ax-btn ax-btn--ghost"
          onClick={api.reset}
        >
          <Icon name="refresh" size={14} />
          Reset display settings
        </button>
        <p className="ax-prefs__hint">
          Saved in this browser only. Nothing is sent to Jira.
        </p>
      </div>
    </div>
  );
}

/** Top-bar disclosure: non-modal panel, Escape or outside click closes it. */
export function AccessibilityMenu({ api }: { api: PreferencesApi }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("input:checked")?.focus();
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  return (
    <div className="ax-prefs-menu">
      <button
        ref={button}
        type="button"
        className="ax-btn ax-btn--ghost ax-btn--sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Icon name="eye" size={15} />
        <span>Display &amp; accessibility</span>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className="ax-prefs-menu__panel"
          role="dialog"
          aria-label="Display and accessibility"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              button.current?.focus();
            }
          }}
        >
          <div className="ax-prefs-menu__head">
            <h2 className="ax-h4">Display &amp; accessibility</h2>
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon"
              aria-label="Close display settings"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
          <AccessibilityControls api={api} />
        </div>
      )}
    </div>
  );
}
