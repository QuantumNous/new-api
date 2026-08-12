/*
 * Eslint config file
 * Documentation: https://eslint.org/docs/user-guide/configuring/
 * Install the Eslint extension before using this feature.
 */
module.exports = {
  env: {
    es6: true,
    browser: true,
    node: true
  },
  ecmaFeatures: {
    modules: true
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  globals: {
    wx: true,
    App: true,
    Page: true,
    getCurrentPages: true,
    getApp: true,
    Component: true,
    requirePlugin: true,
    requireMiniProgram: true
  },
  // extends: 'eslint:recommended',
  ignorePatterns: ['typings', '*.ts', 'miniprogram'],
  rules: {}
};
