import { useCallback, useEffect, useState } from "react";

/**
 * Per-viewer display and accessibility preferences. Stored only in this
 * browser (best effort); the app renders correctly when storage is blocked.
 * Defaults keep the previous behaviour: follow the Atlassian host theme and
 * the operating-system motion/contrast preferences.
 */
export interface Preferences {
  theme: "system" | "light" | "dark";
  textSize: "default" | "large" | "larger";
  contrast: "system" | "high";
  motion: "system" | "reduce";
  focus: "standard" | "enhanced";
  links: "standard" | "underline";
  layout: "standard" | "calm";
}

export const defaultPreferences: Preferences = {
  theme: "dark",
  textSize: "default",
  contrast: "system",
  motion: "system",
  focus: "standard",
  links: "standard",
  layout: "standard",
};

const allowed: { [K in keyof Preferences]: readonly Preferences[K][] } = {
  theme: ["system", "light", "dark"],
  textSize: ["default", "large", "larger"],
  contrast: ["system", "high"],
  motion: ["system", "reduce"],
  focus: ["standard", "enhanced"],
  links: ["standard", "underline"],
  layout: ["standard", "calm"],
};

export const STORAGE_KEY = "anticipate-display-preferences";

export function parsePreferences(raw: string | null): Preferences {
  const result = { ...defaultPreferences };
  if (!raw) return result;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object") return result;
    for (const key of Object.keys(allowed) as (keyof Preferences)[]) {
      const v = value[key];
      if ((allowed[key] as readonly unknown[]).includes(v))
        (result as Record<string, unknown>)[key] = v;
    }
  } catch {
    /* ignore malformed storage */
  }
  return result;
}

function load(): Preferences {
  try {
    return parsePreferences(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { ...defaultPreferences };
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable: preferences last for this page only */
    }
  }, [prefs]);
  const update = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
      setPrefs((p) => ({ ...p, [key]: value })),
    [],
  );
  const reset = useCallback(() => setPrefs({ ...defaultPreferences }), []);
  return { prefs, update, reset };
}
export type PreferencesApi = ReturnType<typeof usePreferences>;

export function resolveTheme(prefs: Preferences, hostTheme: string) {
  return prefs.theme === "system"
    ? hostTheme === "dark"
      ? "dark"
      : "light"
    : prefs.theme;
}

/** Data attributes applied on the app root; CSS keys off these. */
export function preferenceAttributes(prefs: Preferences) {
  return {
    "data-text-size": prefs.textSize,
    "data-contrast": prefs.contrast,
    "data-motion": prefs.motion,
    "data-focus": prefs.focus,
    "data-links": prefs.links,
    "data-layout": prefs.layout,
  };
}
