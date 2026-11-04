import { defineConfig, devices } from "@playwright/test";

// Chromium runs every spec. Firefox and WebKit run the critical journeys (cross-browser evidence for the jury build).
const crossBrowser = [
  "**/journey.spec.ts",
  "**/decision-clarity.spec.ts",
  "**/portfolio-panel.spec.ts",
];
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  projects: [
    { name: "chromium" },
    {
      name: "firefox",
      testMatch: crossBrowser,
      use: { ...devices["Desktop Firefox"], baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "webkit",
      testMatch: crossBrowser,
      use: { ...devices["Desktop Safari"], baseURL: "http://127.0.0.1:3000" },
    },
  ],
  webServer: [
    {
      command: "npm run start -- --host 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
    },
    {
      command: "npm run preview -- --host 127.0.0.1 --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: true,
    },
  ],
});
