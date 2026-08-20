import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageDirectory, "../..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI ? {} : { channel: "chrome" })
      }
    }
  ],
  webServer: [
    {
      command: "npm run dev --workspace=@fitos/api",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:3000/api/v1/health/live",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        FITOS_REPOSITORY: "memory",
        SESSION_SECRET: "e2e-session-secret-must-be-long-enough",
        CSRF_SECRET: "e2e-csrf-secret-must-be-long-enough",
        WEB_PUBLIC_URL: "http://127.0.0.1:5173",
        PORT: "3000"
      }
    },
    {
      command: "npm run dev --workspace=@fitos/web -- --host 127.0.0.1",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:5173/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        WEB_PORT: "5173",
        API_PUBLIC_URL: "http://127.0.0.1:3000"
      }
    }
  ]
});
