module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['header', 'react-hooks'],
  overrides: [
    {
      files: ['**/*.{js,jsx}'],
      rules: {
        // 个人 fork：不强制 QuantumNous 许可证头（见 CLAUDE.md Rule 5 例外）。
        // 现有文件的头保持不变，新文件不再要求加头。
        'header/header': 'off',
        'no-multiple-empty-lines': ['error', { max: 1 }],
      },
    },
  ],
};
