import { mergeConfig, defineProject } from 'vitest/config';
// eslint-disable-next-line import/no-relative-packages
import sharedConfig from '../vitest.shared.mts';

export default mergeConfig(
  sharedConfig,
  defineProject({
    test: {
      environment: 'node',
      browser: {
        enabled: false,
        name: 'node',
      },
      env: {
        VITEST_ENV: 'node',
      },
    },
  }),
);
