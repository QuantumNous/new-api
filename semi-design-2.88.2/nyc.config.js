module.exports = {
    "report-dir": "cypress/coverage",
    "reporter": ["text", "json", "lcov"],
    "all": true,
    "include": [
        "packages/semi-ui/**/*.{js,jsx,ts,tsx}",
        "packages/semi-foundation/**/*.{js,jsx,ts,tsx}"
    ],
    "exclude": [
        "**/*.test.js",
        "**/*.stories.js",
        "packages/**/scripts/**",
        "packages/**/types/**",
        "packages/**/__test__/**",
        "packages/**/_story/**",
        "packages/**/getBabelConfig.js",
        "packages/**/gulpfile.js",
        "packages/**/webpack.config.js",
        "packages/semi-ui/index.ts",
        'packages/**/_test_/**',
        'packages/**/dist/**',
        'packages/semi-ui/locale/**',
    ]
};