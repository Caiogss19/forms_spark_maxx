import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false, // shared mock-webhook & rate-limit map => keep serial
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `node scripts/mock-webhook.mjs & pnpm next dev -p ${PORT}`,
    url: `${BASE_URL}/api/validate-email`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      N8N_WEBHOOK_URL: "http://localhost:4567/ok",
      N8N_WEBHOOK_AUTH: "test-token",
      RATE_LIMIT_PER_MIN: "999",
      MOCK_WEBHOOK_PORT: "4567",
    },
  },
});
