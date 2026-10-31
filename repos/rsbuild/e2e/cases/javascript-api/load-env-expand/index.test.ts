import { expect, test } from '@e2e/helper';
import { loadEnv } from '@rsbuild/core';

test('should expand env variables with existing processEnv values', () => {
  const targetEnv: Record<string, string> = {
    PUBLIC_PASSWORD: 'pa$word',
  };
  const env = loadEnv({
    cwd: import.meta.dirname,
    mode: 'production',
    prefixes: ['PUBLIC_'],
    processEnv: targetEnv,
  });

  expect(env.parsed).toMatchObject({
    PUBLIC_REF: 'rsbuild',
    PUBLIC_DEFAULT: 'fallback',
    PUBLIC_PASSWORD: 'pa$word',
    PUBLIC_PASSWORD_EXPAND: 'pa$word',
    PUBLIC_COMPOSED: 'rsbuild@1',
  });
  expect(env.rawPublicVars.PUBLIC_COMPOSED).toBe('rsbuild@1');

  env.cleanup();
  expect(targetEnv.PUBLIC_COMPOSED).toBe(undefined);
});
