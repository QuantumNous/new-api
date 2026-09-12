var baseFiles = ['*.ts'];
var baseExtends = ['plugin:@typescript-eslint/recommended', 'plugin:promise/recommended', 'prettier'];

var reactExtends = [
  'plugin:react/recommended',
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/HEAD/docs/rules/react-in-jsx-scope.md
  'plugin:react/jsx-runtime',
  'plugin:react-hooks/recommended'
];

/**
 *
 * @param {'react' | 'lib'} type
 * @returns {import('eslint').ESLint.ConfigData}
 */
module.exports = function buildConfig(type) {
  var isJsx = false;
  var settings = {};
  var reactRules = {};

  var _extends = baseExtends;

  if (type === 'react') {
    baseFiles.push('*.tsx');

    _extends = baseExtends.concat(reactExtends);

    isJsx = true;

    settings.react = {
      createClass: 'createReactClass',
      pragma: 'React',
      version: 'detect',
      flowVersion: '0.53'
    };

    reactRules = {
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react/react-in-jsx-scope': 'off'
    };
  }

  return {
    root: true,
    // Disable the parser by default
    parser: '',

    // Manually authored .d.ts files are generally used to describe external APIs that are  not expected
    // to follow our coding conventions.  Linting those files tends to produce a lot of spurious suppressions,
    // so we simply ignore them.
    ignorePatterns: ['*.d.ts', 'dist/**', 'vchart/index.js'],

    overrides: [
      {
        // Declare an override that applies to TypeScript files only
        files: baseFiles,
        parser: '@typescript-eslint/parser',
        extends: _extends,
        parserOptions: {
          // The "project" path is resolved relative to parserOptions.tsconfigRootDir.
          // Your local .eslintrc.js must specify that parserOptions.tsconfigRootDir=__dirname.
          project: './tsconfig.json',

          // Allow parsing of newer ECMAScript constructs used in TypeScript source code.  Although tsconfig.json
          // may allow only a small subset of ES2018 features, this liberal setting ensures that ESLint will correctly
          // parse whatever is encountered.
          ecmaVersion: 2018,

          sourceType: 'module',

          ecmaFeatures: {
            jsx: isJsx
          }
        },

        settings: settings,
        rules: {
          '@typescript-eslint/ban-ts-comment': 'off',
          '@typescript-eslint/no-empty-function': 'warn',
          '@typescript-eslint/ban-types': 'warn',
          '@typescript-eslint/no-var-requires': 'warn',
          'no-console': 'error',
          'no-debugger': 'error',
          '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
          'promise/always-return': 'off',
          'promise/no-callback-in-promise': 'off',
          ...reactRules
        }
      }
    ]
  };
};
