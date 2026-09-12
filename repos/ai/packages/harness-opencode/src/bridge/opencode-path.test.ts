import { describe, expect, it } from 'vitest';
import { prependOpenCodeBinToPath } from './opencode-path';

describe('prependOpenCodeBinToPath', () => {
  it('prepends the bridge node_modules bin directory', () => {
    const env = { PATH: '/usr/bin:/bin' };

    prependOpenCodeBinToPath({
      bootstrapDir: '/tmp/harness/opencode',
      env,
    });

    expect(env.PATH).toBe(
      '/tmp/harness/opencode/node_modules/.bin:/usr/bin:/bin',
    );
  });

  it('keeps a usable system path fallback when PATH is absent', () => {
    const env: { PATH?: string } = {};

    prependOpenCodeBinToPath({
      bootstrapDir: '/tmp/harness/opencode',
      env,
    });

    expect(env.PATH).toContain('/tmp/harness/opencode/node_modules/.bin:');
    expect(env.PATH).toContain('/usr/bin');
  });
});
