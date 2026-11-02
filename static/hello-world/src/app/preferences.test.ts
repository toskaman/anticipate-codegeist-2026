import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  parsePreferences,
  preferenceAttributes,
  resolveTheme,
} from "./preferences";

describe("display preferences", () => {
  it("defaults to the dark theme; Automatic still follows the host when chosen", () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences);
    expect(defaultPreferences.theme).toBe("dark");
    expect(resolveTheme(defaultPreferences, "light")).toBe("dark");
    const auto = { ...defaultPreferences, theme: "system" as const };
    expect(resolveTheme(auto, "dark")).toBe("dark");
    expect(resolveTheme(auto, "light")).toBe("light");
    expect(resolveTheme(auto, "unexpected")).toBe("light");
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
