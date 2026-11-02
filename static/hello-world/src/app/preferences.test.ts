import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  parsePreferences,
  preferenceAttributes,
  resolveTheme,
} from "./preferences";

describe("display preferences", () => {
  it("defaults to following the host theme and system settings", () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences);
    expect(resolveTheme(defaultPreferences, "dark")).toBe("dark");
    expect(resolveTheme(defaultPreferences, "light")).toBe("light");
    expect(resolveTheme(defaultPreferences, "unexpected")).toBe("light");
  });
  it("lets an explicit theme override the host", () => {
    expect(
      resolveTheme({ ...defaultPreferences, theme: "light" }, "dark"),
    ).toBe("light");
    expect(
      resolveTheme({ ...defaultPreferences, theme: "dark" }, "light"),
    ).toBe("dark");
  });
  it("keeps only known values from storage", () => {
    expect(
      parsePreferences(
        JSON.stringify({
          theme: "dark",
          textSize: "huge",
          contrast: "high",
          motion: 1,
          extra: "x",
        }),
      ),
    ).toEqual({ ...defaultPreferences, theme: "dark", contrast: "high" });
    expect(parsePreferences("{not json")).toEqual(defaultPreferences);
    expect(parsePreferences("null")).toEqual(defaultPreferences);
  });
  it("maps every preference to a root data attribute", () => {
    expect(
      preferenceAttributes({ ...defaultPreferences, layout: "calm" }),
    ).toMatchObject({ "data-layout": "calm", "data-text-size": "default" });
  });
});
