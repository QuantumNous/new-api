import { stripVTControlCharacters as stripAnsi } from 'node:util';
import { expect, test } from '@e2e/helper';
import { loadEnv } from '@rsbuild/core';

function getLoadEnvError(prefixes: string[]) {
  try {
    loadEnv({
      cwd: import.meta.dirname,
      prefixes,
    });
  } catch (err) {
    return err as Error;
  }

  throw new Error('Expected loadEnv to throw.');
}

test('should load env files correctly', () => {
  const env = loadEnv({
    cwd: import.meta.dirname,
    mode: 'staging',
    prefixes: ['REACT_'],
  });

  expect(process.env.REACT_NAME).toEqual('react');

  expect(env.parsed).toEqual({
    REACT_EMPTY_STRING: '',
    REACT_NAME: 'react',
    REACT_VERSION: '18',
    VUE_NAME: 'vue',
    VUE_VERSION: '3',
  });

  expect(env.publicVars).toEqual({
    'import.meta.env.REACT_EMPTY_STRING': '""',
    'import.meta.env.REACT_NAME': '"react"',
    'import.meta.env.REACT_VERSION': '"18"',
    'process.env.REACT_EMPTY_STRING': '""',
    'process.env.REACT_NAME': '"react"',
    'process.env.REACT_VERSION': '"18"',
  });

  expect(env.rawPublicVars).toEqual({
    REACT_EMPTY_STRING: '',
    REACT_NAME: 'react',
    REACT_VERSION: '18',
  });

  expect(env.filePaths.find((item) => item.endsWith('.env'))).toBeTruthy();
  expect(env.filePaths.find((item) => item.endsWith('.env.staging'))).toBeTruthy();

  env.cleanup();
  expect(process.env.REACT_NAME).toEqual(undefined);
});

test('should not modify process.env if processEnv is provided', () => {
  delete process.env.REACT_NAME;

  const targetEnv: Record<string, string> = {};
  const env = loadEnv({
    cwd: import.meta.dirname,
    processEnv: targetEnv,
  });

  expect(process.env.REACT_NAME).toEqual(undefined);
  expect(targetEnv.REACT_NAME).toEqual('react');

  env.cleanup();
  expect(process.env.REACT_NAME).toEqual(undefined);
  expect(targetEnv.REACT_NAME).toEqual(undefined);
});

test('should throw when prefixes contains empty string', () => {
  const message = stripAnsi(getLoadEnvError(['PUBLIC_', '']).message);

  expect(message).toContain('Invalid prefixes option');
  expect(message).toContain('received ""');
  expect(message).toContain('An empty string matches every key in processEnv');
  expect(message).toContain('process.env.* and import.meta.env.* replacements');
});

test('should throw when prefixes contains whitespace-only string', () => {
  const message = stripAnsi(getLoadEnvError(['PUBLIC_', '  ']).message);

  expect(message).toContain('Invalid prefixes option');
  expect(message).toContain('received "  "');
  expect(message).toContain('A whitespace-only string is not a valid public');
});
