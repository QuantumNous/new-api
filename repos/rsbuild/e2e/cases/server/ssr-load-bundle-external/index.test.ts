import { expect, test } from '@e2e/helper';

type CheckResult = {
  loadBundleType: string;
  nativeType: string;
  loadBundleResult: string;
  nativeResult: string;
  loadBundleUndefinedType: string;
};

test('should align loadBundle ESM default import with native Node.js', async ({
  copyNodeModules,
  devOnly,
  request,
}) => {
  await copyNodeModules();

  const rsbuild = await devOnly();
  const response = await request.get(`http://localhost:${rsbuild.port}/check`);

  expect(response.status()).toBe(200);

  const result = (await response.json()) as CheckResult;

  expect(result.nativeType).toBe('function');
  expect(result.loadBundleType).toBe(result.nativeType);
  expect(result.loadBundleResult).toBe(result.nativeResult);
  expect(result.loadBundleUndefinedType).toBe('undefined');
});
