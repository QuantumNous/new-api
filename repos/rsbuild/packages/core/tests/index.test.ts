import { createLogger, logger, version } from '../src';

it('should export current Rsbuild version', async () => {
  expect(typeof version).toEqual('string');
});

it('should export createLogger to create isolated logger instances', () => {
  const instance = createLogger({ level: 'warn' });

  expect(instance).not.toBe(logger);
  expect(instance.level).toBe('warn');
});
