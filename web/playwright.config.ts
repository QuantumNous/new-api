import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, '..');
const runId = process.env.PLAYWRIGHT_RUN_ID ?? `${Date.now()}`;
const tempRoot = path.join('/tmp', `new-api-playwright-${runId}`);
const apiPort = 3401;
const e2ePort = 3402;
const dockerHubStubPort = 3403;

function serverCommand(port: number, dbName: string, logDirName: string): string {
  const sqlitePath = path.join(tempRoot, dbName);
  const logDir = path.join(tempRoot, logDirName);
  const sessionSecret = `playwright-session-${runId}-${port}`;
  return [
    `mkdir -p ${tempRoot} ${logDir}`,
    `cd ${repoRoot}`,
    `SESSION_SECRET=${sessionSecret} SQLITE_PATH=${sqlitePath} PORT=${port} GIN_MODE=release TLS_INSECURE_SKIP_VERIFY=true GOCACHE=/tmp/new-api-go-build GOMODCACHE=/tmp/new-api-go-mod DOCKER_IMAGE_REPOSITORY=playwright/new-api DOCKER_IMAGE_TAG=v0.11.5 DOCKERHUB_API_BASE=http://127.0.0.1:${dockerHubStubPort} go run main.go --log-dir ${logDir}`,
  ].join(' && ');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: './test-results',
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : 'list',
  globalSetup: './tests/global-setup.ts',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: serverCommand(apiPort, 'api.sqlite', 'api-logs'),
      url: `http://127.0.0.1:${apiPort}/api/status`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: serverCommand(e2ePort, 'e2e.sqlite', 'e2e-logs'),
      url: `http://127.0.0.1:${e2ePort}/api/status`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: {
        baseURL: `http://127.0.0.1:${apiPort}`,
      },
    },
    {
      name: 'chromium-e2e',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${e2ePort}`,
      },
    },
  ],
});
