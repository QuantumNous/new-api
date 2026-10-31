import { mergeConfig, defineProject } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
// eslint-disable-next-line import/no-relative-packages
import sharedConfig from '../../vitest.shared.mts';

export default mergeConfig(
  sharedConfig,
  defineProject({
    test: {
      environment: 'node',
      testTimeout: (process.env.CIRCLECI === 'true' ? 4 : 2) * 1000, // Circle CI has low-performance CPUs.
      browser: {
        provider: playwright(),
        enabled: false,
      },
      env: {
        VITEST_ENV: 'node',
      },
    },
  }),
);
