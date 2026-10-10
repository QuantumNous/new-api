import noUnknownDemoColors, {
  ruleName as noUnknownDemoColorsRuleName,
} from './scripts/stylelint/no-unknown-demo-colors.mjs';

// Note: To debug stylelint config resolution for a specific file, use
//         pnpm exec stylelint --print-config <path-to-file>

/** @type {import('stylelint').Config} */
export default {
  extends: '@mui/internal-code-infra/stylelint',
  plugins: [noUnknownDemoColors],
  rules: {
    // empty lines help with readability
    'declaration-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'comment-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'function-no-unknown': true,
    'number-max-precision': 5,

    'no-descending-specificity': null, // Some styles depend on order
  },
  overrides: [
    {
      files: ['docs/**/*'],
      extends: ['stylelint-config-tailwindcss'],
      rules: {
        // https://github.com/zhilidali/stylelint-config-tailwindcss/issues/12
        'declaration-property-value-no-unknown': null,
        // Remove when ready
        'keyframes-name-pattern': null,
        // `:has()` can be heavy on perf, be cautious
        'selector-pseudo-class-disallowed-list': ['has'],
      },
    },
    {
      files: ['docs/src/app/[(]docs[)]/**/demos/**/*.css'],
      rules: {
        [noUnknownDemoColorsRuleName]: true,
        'selector-pseudo-class-disallowed-list': null,
      },
    },
    {
      files: ['docs/src/app/[(]private[)]/**/*'],
      rules: {
        'selector-pseudo-class-disallowed-list': null,
      },
    },
    {
      // Not fixing experiments for now
      files: ['docs/src/app/[(]private[)]/experiments/**/*'],
      rules: {
        'block-no-redundant-nested-style-rules': null,
        'no-descending-specificity': null,
        'no-duplicate-selectors': null,
      },
    },
  ],
};
