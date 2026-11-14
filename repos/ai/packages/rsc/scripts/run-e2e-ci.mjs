import { spawnSync } from 'node:child_process';

if (process.env.SKIP_RSC_E2E === '1') {
  console.log('Skipping RSC e2e tests');
  process.exit(0);
}

const result = spawnSync('pnpm', ['test:e2e'], {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
