//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  {
    files: ['**/*.js'],
    languageOptions: {
      parserOptions: { project: null, projectService: { allowDefaultProject: ['*.js'] } },
    },
  },
];
