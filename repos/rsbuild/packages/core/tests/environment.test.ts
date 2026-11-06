import { createCacheableFunction, type ServerUtils } from '../src/server/environment';
import type { Rspack } from '../src/types';

const stats = {} as Rspack.Stats;
const utils = {} as ServerUtils;

test('should cache pending calls for the same compilation and entry', async () => {
  let resolveGetter: ((value: string) => void) | undefined;
  const getter = rstest.fn(
    () =>
      new Promise<string>((resolve) => {
        resolveGetter = resolve;
      }),
  );
  const cacheableGetter = createCacheableFunction(getter);

  const first = cacheableGetter(stats, 'index', utils);
  const second = cacheableGetter(stats, 'index', utils);

  expect(first).toBe(second);
  await Promise.resolve();
  expect(getter).toHaveBeenCalledTimes(1);

  resolveGetter?.('result');
  await expect(first).resolves.toBe('result');
  await expect(second).resolves.toBe('result');
  await expect(cacheableGetter(stats, 'index', utils)).resolves.toBe('result');
  expect(getter).toHaveBeenCalledTimes(1);
});

test('should retry after a pending call rejects', async () => {
  const error = new Error('failed');
  const getter = rstest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('result');
  const cacheableGetter = createCacheableFunction<string>(getter);

  const first = cacheableGetter(stats, 'index', utils);
  const second = cacheableGetter(stats, 'index', utils);

  expect(first).toBe(second);
  await expect(first).rejects.toBe(error);
  await expect(cacheableGetter(stats, 'index', utils)).resolves.toBe('result');
  expect(getter).toHaveBeenCalledTimes(2);
});
