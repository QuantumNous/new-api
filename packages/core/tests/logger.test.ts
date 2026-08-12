import { createLogger, createRsbuild, logger, type Logger, type RsbuildPlugin } from '../src';

const initialGlobalLogLevel = logger.level;

afterEach(() => {
  rs.unstubAllEnvs();
  logger.level = initialGlobalLogLevel;
});

it('should expose the current instance logger', async () => {
  let pluginLogger: Logger | undefined;

  const loggerPlugin: RsbuildPlugin = {
    name: 'logger-plugin',
    setup(api) {
      pluginLogger = api.logger;
    },
  };

  const rsbuild = await createRsbuild({
    config: {
      plugins: [loggerPlugin],
    },
  });

  await rsbuild.initConfigs();

  expect(rsbuild.logger).not.toBe(logger);
  expect(rsbuild.logger).toBe(pluginLogger);
});

it('should create isolated default loggers for different instances', async () => {
  const first = await createRsbuild();
  const second = await createRsbuild();
  const secondLoggerLevel = second.logger.level;
  const globalLoggerLevel = logger.level;

  first.logger.level = first.logger.level === 'silent' ? 'info' : 'silent';

  expect(first.logger).not.toBe(second.logger);
  expect(first.logger).not.toBe(logger);
  expect(second.logger).not.toBe(logger);
  expect(second.logger.level).toBe(secondLoggerLevel);
  expect(logger.level).toBe(globalLoggerLevel);
});

it('should expose customLogger on the current instance', async () => {
  let pluginLogger: Logger | undefined;
  const customLogger = createLogger();

  const loggerPlugin: RsbuildPlugin = {
    name: 'logger-plugin',
    setup(api) {
      pluginLogger = api.logger;
    },
  };

  const rsbuild = await createRsbuild({
    config: {
      customLogger,
      plugins: [loggerPlugin],
    },
  });

  await rsbuild.initConfigs();

  expect(rsbuild.logger).toBe(customLogger);
  expect(rsbuild.logger).toBe(pluginLogger);
});

it('should use the custom console for debug override', () => {
  const customConsole = {
    log: rstest.fn(),
    warn: rstest.fn(),
    error: rstest.fn(),
  };

  const customLogger = createLogger({
    console: customConsole,
    level: 'verbose',
  });

  customLogger.debug('hello');

  expect(customConsole.log).toHaveBeenCalledTimes(1);
  expect(customConsole.log).toHaveBeenCalledWith(expect.stringContaining('hello'));
});
