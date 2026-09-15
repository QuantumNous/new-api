import { expect, test } from '@e2e/helper';
import {
  createLogger,
  createRsbuild,
  logger,
  type Logger,
  type RsbuildPlugin,
} from '@rsbuild/core';

test('should use the current instance logger for api.logger when customLogger is not set', async () => {
  let pluginLogger: Logger | undefined;

  const loggerPlugin: RsbuildPlugin = {
    name: 'logger-plugin',
    setup(api) {
      pluginLogger = api.logger;
    },
  };

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      plugins: [loggerPlugin],
    },
  });

  await rsbuild.initConfigs();

  expect(pluginLogger).toBe(rsbuild.logger);
  expect(pluginLogger).not.toBe(logger);
});

test('should use customLogger for api.logger', async () => {
  let pluginLogger: Logger | undefined;
  const customLogger = createLogger();

  const loggerPlugin: RsbuildPlugin = {
    name: 'logger-plugin',
    setup(api) {
      pluginLogger = api.logger;
    },
  };

  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      customLogger,
      plugins: [loggerPlugin],
    },
  });

  await rsbuild.initConfigs();

  expect(pluginLogger).toBe(customLogger);
});

test('should apply logLevel to customLogger', async () => {
  const customLogger = createLogger();

  await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      customLogger,
      logLevel: 'error',
    },
  });

  expect(customLogger.level).toBe('error');
});

test('should use customLogger for build logs', async ({ build }) => {
  const customLogger = createLogger();

  customLogger.override({
    ready(message) {
      console.log(`[CUSTOM_READY] ${message}`);
    },
  });

  const rsbuild = await build({
    config: {
      customLogger,
    },
  });

  expect(rsbuild.logs.find((item) => item.includes('[CUSTOM_READY] built in'))).toBeTruthy();
});

test('should use customLogger for dev server logs', async ({ devOnly }) => {
  const customLogger = createLogger();

  customLogger.override({
    log(message) {
      console.log(`[CUSTOM_LOG] ${message}`);
    },
  });

  const rsbuild = await devOnly({
    config: {
      customLogger,
    },
  });

  await rsbuild.expectLog((log) => log.includes('[CUSTOM_LOG]') && log.includes('Local:'));
});

test('should use customLogger for preview server logs', async ({ build }) => {
  const customLogger = createLogger();

  customLogger.override({
    log(message) {
      console.log(`[CUSTOM_LOG] ${message}`);
    },
  });

  const rsbuild = await build({
    runServer: true,
    config: {
      customLogger,
    },
  });

  expect(
    rsbuild.logs.find((item) => item.includes('[CUSTOM_LOG]') && item.includes('Local:')),
  ).toBeTruthy();
});
