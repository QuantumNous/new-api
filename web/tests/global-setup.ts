import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  execFileSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
}

export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_FRONTEND_SETUP === '1') {
    return;
  }

  const testRoot = path.dirname(fileURLToPath(import.meta.url));
  const webRoot = path.resolve(testRoot, '..');
  const bunTmpDir = process.env.BUN_TMPDIR ?? '/tmp/new-api-bun-tmp';
  const bunInstallDir = process.env.BUN_INSTALL ?? '/tmp/new-api-bun-install';
  const env = {
    ...process.env,
    BUN_TMPDIR: bunTmpDir,
    BUN_INSTALL: bunInstallDir,
    DISABLE_ESLINT_PLUGIN: 'true',
    VITE_REACT_APP_VERSION: process.env.VITE_REACT_APP_VERSION ?? 'playwright',
  };

  mkdirSync(bunTmpDir, { recursive: true });
  mkdirSync(bunInstallDir, { recursive: true });

  runCommand('bun', ['install', '--frozen-lockfile'], webRoot, env);
  runCommand('bun', ['run', 'build'], webRoot, env);
}
