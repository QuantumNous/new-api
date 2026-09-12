import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { loadConfig } from '@rsbuild/core';

test('should pass command to config function', async () => {
  const { content } = await loadConfig({
    cwd: import.meta.dirname,
    command: 'build',
  });

  expect(content.source?.define).toEqual({
    COMMAND: JSON.stringify('build'),
  });
});

test('should load config from custom config file names', async () => {
  const { content, filePath } = await loadConfig({
    cwd: import.meta.dirname,
    configFileNames: ['custom.config.mjs', 'fallback.config.mjs'],
  });

  expect(filePath).toBe(join(import.meta.dirname, 'custom.config.mjs'));
  expect(content.source?.define).toEqual({
    CONFIG_FILE_NAME: JSON.stringify('custom'),
  });
});

test('should load config from named export', async () => {
  const { content } = await loadConfig<{ name: string }>({
    cwd: import.meta.dirname,
    configFileNames: ['named.config.mjs'],
    exportName: 'rsbuildConfig',
  });

  expect(content.name).toBe('rsbuildConfig');
});

test('should execute config file without reading exports', async () => {
  const globalState = globalThis as typeof globalThis & {
    __LOAD_CONFIG_HIT__?: string;
  };
  delete globalState.__LOAD_CONFIG_HIT__;

  const { content, filePath } = await loadConfig({
    cwd: import.meta.dirname,
    configFileNames: ['side-effect.config.mjs'],
    exportName: false,
  });

  expect(filePath).toBe(join(import.meta.dirname, 'side-effect.config.mjs'));
  expect(content.source).toBeUndefined();
  expect(content._privateMeta?.configFilePath).toBe(filePath);
  expect(globalState.__LOAD_CONFIG_HIT__).toBe('loaded');
});

test('should throw when named export is missing', async () => {
  await expect(
    loadConfig({
      cwd: import.meta.dirname,
      configFileNames: ['named.config.mjs'],
      exportName: 'missingConfig',
    }),
  ).rejects.toThrow(/Cannot find export .*missingConfig/);
});
