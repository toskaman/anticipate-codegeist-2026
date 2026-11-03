// @vitest-environment jsdom
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error: explicit .tsx extension selects App.tsx over the legacy App.jsx (same pattern as index.jsx)
import App, { readStoredTheme, persistStoredTheme } from "./App.tsx";
import { STORAGE_KEY, defaultPreferences } from "./app/preferences";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("storage guards", () => {
  it("falls back to defaults when no key is present", () => {
    expect(readStoredTheme()).toBe(defaultPreferences.theme);
  });

  it("returns defaults without throwing on corrupted JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => readStoredTheme()).not.toThrow();
    expect(readStoredTheme()).toBe(defaultPreferences.theme);
  });

  it("returns defaults without throwing when storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => readStoredTheme()).not.toThrow();
    expect(readStoredTheme()).toBe(defaultPreferences.theme);
  });

  it("ignores invalid theme values", () => {
    localStorage.setItem("anticipate-theme", "neon");
    expect(readStoredTheme()).toBe(defaultPreferences.theme);
  });

  it("resumes a valid stored value", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "light" }));
    expect(readStoredTheme()).toBe("light");
    localStorage.clear();
    localStorage.setItem("anticipate-theme", "light");
    expect(readStoredTheme()).toBe("light");
  });

  it("persists best-effort without throwing", () => {
    persistStoredTheme("light");
    expect(localStorage.getItem("anticipate-theme")).toBe("light");
    persistStoredTheme("neon");
    expect(localStorage.getItem("anticipate-theme")).toBe("light");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => persistStoredTheme("dark")).not.toThrow();
  });

  it("renders with the default theme when storage holds corrupted JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => render(<App />)).not.toThrow();
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe(
      defaultPreferences.theme,
    );
  });

  it("renders with the resumed theme for a valid stored value", () => {
    localStorage.setItem("anticipate-theme", "light");
    render(<App />);
    expect(document.querySelector(".app")?.getAttribute("data-theme")).toBe(
      "light",
    );
  });
});
