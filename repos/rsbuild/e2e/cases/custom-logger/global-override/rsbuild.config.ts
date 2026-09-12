import { defineConfig, logger } from '@rsbuild/core';

logger.override({
  info: (message) => {
    console.log(`[TEST] ${message}`);
  },
});

export default defineConfig({
  customLogger: logger,
  plugins: [
    {
      name: 'restore-global-logger',
      setup(api) {
        api.onAfterBuild(() => {
          logger.info('hello world');
        });
      },
    },
  ],
});
