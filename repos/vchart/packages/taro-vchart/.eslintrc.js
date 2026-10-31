require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  extends: ['@internal/eslint-config/profile/react'],
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.eslint.json' },
  // ignorePatterns: [],
  rules: {
    "@typescript-eslint/no-unused-vars": "warn",
    "react/display-name": "off",
    "no-console": "warn"
  }
};
