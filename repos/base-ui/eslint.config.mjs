import {
  baseSpecRules,
  createBaseConfig,
  createDocsConfig,
  createTestConfig,
  EXTENSION_TEST_FILE,
  EXTENSION_TS,
} from '@mui/internal-code-infra/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import * as path from 'node:path';
import { fileURLToPath } from 'url';
import remarkConfig from './.remarkrc.mjs';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const playgroundRootDir = path.join(dirname, 'playground', 'vite-app');

const OneLevelImportMessage = [
  'Prefer one level nested imports to avoid bundling everything in dev mode or breaking CJS/ESM split.',
  'See https://github.com/mui/material-ui/pull/24147 for the kind of win it can unlock.',
].join('\n');

const NO_RESTRICTED_IMPORTS_PATTERNS_DEEPLY_NESTED = [
  {
    regex: '@base-ui/react/(?:(?!internals/).+|internals/.+)/.+',
    message: OneLevelImportMessage,
  },
];

// Add relevant packages to the list below.
const NO_RESTRICTED_IMPORTS_PATHS_TOP_LEVEL_PACKAGES = [
  // { name: string, message: string }
];

export default defineConfig(
  globalIgnores(['./examples', './playground/vite-app/dist']),
  createBaseConfig({
    baseDirectory: dirname,
    markdown: true,
  }),
  // eslint-plugin-mdx loads `.remarkrc.mjs` itself, but ESLint doesn't know
  // that file is a config dependency, so `--cache` doesn't invalidate when
  // it changes. Embedding the imported value in a setting puts its content
  // into the resolved-config hash, forcing cache invalidation on edits.
  { settings: { remarkConfig } },
  {
    name: 'Playground Vite app overrides',
    files: ['playground/vite-app/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: playgroundRootDir,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    name: 'Base UI overrides',
    files: [`**/*${EXTENSION_TS}`],
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json'],
        },
      },
      next: {
        rootDir: 'docs',
      },
    },
    /**
     * Sorted alphanumerically within each group. built-in and each plugin form
     * their own groups.
     */
    rules: {
      // @TODO: Remove this once we move away from namespaces
      '@typescript-eslint/no-namespace': 'off',
      'import/export': 'off', // FIXME: Maximum call stack exceeded
      'no-restricted-imports': [
        'error',
        {
          patterns: NO_RESTRICTED_IMPORTS_PATTERNS_DEEPLY_NESTED,
        },
      ],
      // We LOVE non-breaking spaces, and both straight and curly quotes here
      'no-irregular-whitespace': ['warn', { skipJSXText: true, skipStrings: true }],
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': ['warn', { forbid: ['>', '}'] }],
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: 'useIsoLayoutEffect',
        },
      ],

      // Modern browsers imply rel="noopener" for target="_blank", so no rel is required.
      // See https://github.com/mui/material-ui/pull/40447
      // TODO move to mui/mui-public.
      'react/jsx-no-target-blank': 'off',

      // This prevents us from creating components like `<h1 {...props} />`
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/anchor-has-content': 'off',

      // This rule doesn't recognise <label> wrapped around custom controls
      'jsx-a11y/label-has-associated-control': 'off',
      // Turn off new eslint-plugin-react-hooks rules till we can fix all warnings
      'react-hooks/error-boundaries': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: [`packages/*/src/**/*${EXTENSION_TS}`],
    ignores: [`**/*${EXTENSION_TEST_FILE}`, `**/*.spec${EXTENSION_TS}`, `test/**/*${EXTENSION_TS}`],
    rules: {
      'mui/add-undef-to-optional': 'error',
      'mui/disallow-react-api-in-server-components': 'error',
    },
  },
  {
    files: [
      // matching the pattern of the test runner
      `**/*${EXTENSION_TEST_FILE}`,
    ],
    extends: createTestConfig({ useMocha: false }),
    rules: {
      'mui/add-undef-to-optional': 'off',
    },
  },
  baseSpecRules,
  {
    name: 'MUI ESLint config for docs',
    files: [`docs/**/*${EXTENSION_TS}`],
    extends: createDocsConfig(),
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
      'import/extensions': [
        'error',
        // Ignores extensions in package imports as well as local ts/tsx imports but .mjs is always required
        'ignorePackages',
        {
          ts: 'never',
          tsx: 'never',
          mjs: 'always',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: NO_RESTRICTED_IMPORTS_PATHS_TOP_LEVEL_PACKAGES,
          patterns: NO_RESTRICTED_IMPORTS_PATTERNS_DEEPLY_NESTED,
        },
      ],
    },
  },
  {
    files: [`docs/src/app/(private)/experiments/**/*${EXTENSION_TS}`],
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
      'no-alert': 'off',
      'no-console': 'off',
      'import/no-relative-packages': 'off',
    },
  },
  {
    files: [`docs/src/app/(docs)/react/utils/use-render/demos/**/*${EXTENSION_TS}`],
    rules: {
      'jsx-a11y/control-has-associated-label': 'off',
      'react/button-has-type': 'off',
    },
  },
  {
    name: 'Disable image rule for demos',
    files: [
      `docs/src/app/(docs)/**/demos/**/*${EXTENSION_TS}`,
      `docs/src/app/(private)/experiments/**/*${EXTENSION_TS}`,
    ],
    ignores: ['docs/src/app/(private)/experiments/**/page.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: [`test/**/*${EXTENSION_TS}`],
    rules: {
      'guard-for-in': 'off',
      'testing-library/prefer-screen-queries': 'off', // Enable usage of playwright queries
      'testing-library/no-await-sync-queries': 'off',
      'testing-library/render-result-naming-convention': 'off', // inconsequential in regression tests
      'mui/consistent-production-guard': 'off',
    },
  },
);
