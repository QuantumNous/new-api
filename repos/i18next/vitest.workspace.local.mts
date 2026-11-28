import { defineConfig } from 'vitest/config';

/**
 * See CONTRIBUTING.md for more information
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'local',
          dir: './test/local',
        },
      },
    ],
  },
});
