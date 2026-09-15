import { stripVTControlCharacters as stripAnsi } from 'node:util';
import { expect, test } from '@e2e/helper';

test('should run build command with log level: info', async ({ execCliSync }) => {
  const stdout = stripAnsi(execCliSync('build --logLevel info'));
  expect(stdout).toContain('Rsbuild v');
  expect(stdout).toContain('build started...');
  expect(stdout).toContain('built in');
});

test('should run build command with log level: warn', async ({ execCliSync }) => {
  const stdout = stripAnsi(execCliSync('build --logLevel warn'));
  expect(stdout).not.toContain('Rsbuild v');
  expect(stdout).not.toContain('build started...');
  expect(stdout).not.toContain('built in');
});

test('should always print verbose logs when debug mode is enabled', async ({ execCliSync }) => {
  const stdout = stripAnsi(
    execCliSync('build --logLevel error', {
      env: {
        ...process.env,
        DEBUG: 'rsbuild',
      },
    }),
  );
  expect(stdout).toContain('config inspection completed');
});
