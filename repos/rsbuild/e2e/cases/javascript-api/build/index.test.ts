import { expect, test } from '@e2e/helper';

test('should allow to call `build` and get stats object', async ({ build }) => {
  const result = await build();

  await result.close();

  const statsJson = result.stats?.toJson({ all: true });
  expect(statsJson?.name).toBe('web');
  expect(statsJson?.assets?.length).toBeGreaterThan(0);
});
