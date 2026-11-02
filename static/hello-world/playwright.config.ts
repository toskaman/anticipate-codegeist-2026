import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
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
