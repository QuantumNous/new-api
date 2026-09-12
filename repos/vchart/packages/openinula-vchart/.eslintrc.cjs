require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  extends: ['@internal/eslint-config/profile/react'],
  globals: {
    __DEV__: 'readonly',
    __VERSION__: 'readonly',
    NodeJS: true
  },
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.eslint.json' },
  // ignorePatterns: [],
  rules: {
    "@typescript-eslint/no-unused-vars": "warn",
    "react/display-name": "off",
    "no-console": "warn"
  }
};
