import neostandard from 'neostandard';

export default [
  {
    ignores: ['dist/**', 'i18next.js', 'i18next.min.js', 'examples/**', 'jsr.json'],
  },
  ...neostandard({ semi: true, ts: true, noStyle: true }),
  {
    rules: {
      'no-var': 'error',
      'no-void': 'off',
      curly: 'off',
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      // allow for...in for deep extend etc.
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['test/**/*'],
    rules: {
      'no-unused-expressions': 'off',
      'n/no-callback-literal': 'off',
      'n/handle-callback-err': 'off',
      'n/no-path-concat': 'off',
      'no-useless-call': 'off',
    },
  },
];
