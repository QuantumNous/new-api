import { join } from 'node:path';
import { expect, HMR_CONNECTED_LOG, test } from '@e2e/helper';
import { type LogLevel, logger } from '@rsbuild/core';

let originalLevel: LogLevel;

test.beforeEach(() => {
  originalLevel = logger.level as LogLevel;
});
test.afterEach(() => {
  logger.level = originalLevel;
});

test('should respect dev.client.logLevel when set to warn', async ({
  page,
  dev,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { addLog, expectNoLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      dev: {
        client: {
          logLevel: 'warn',
        },
      },
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild');

  expectNoLog(HMR_CONNECTED_LOG);
});

test('should show info logs when dev.client.logLevel is info (default)', async ({
  page,
  dev,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { expectLog, addLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  await expectLog(HMR_CONNECTED_LOG);
});

test('should inherit root logLevel when dev.client.logLevel is not set', async ({
  page,
  dev,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { addLog, expectNoLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      logLevel: 'error',
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild');
  expectNoLog(HMR_CONNECTED_LOG);
});

test('should suppress all logs when dev.client.logLevel is silent', async ({
  page,
  dev,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { addLog, expectNoLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      dev: {
        client: {
          logLevel: 'silent',
        },
      },
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild');
  expectNoLog('[rsbuild]');
});

test('should inherit silent mode from root logLevel', async ({
  page,
  dev,
  logHelper,
  copySrcDir,
}) => {
  const tempSrc = await copySrcDir();
  const { addLog, expectNoLog } = logHelper;

  page.on('console', (consoleMessage) => {
    addLog(consoleMessage.text());
  });

  await dev({
    config: {
      logLevel: 'silent',
      source: {
        entry: {
          index: join(tempSrc, 'index.tsx'),
        },
      },
    },
  });

  const locator = page.locator('#test');
  await expect(locator).toHaveText('Hello Rsbuild');
  expectNoLog('[rsbuild]');
});
