/* eslint-disable */
module.exports = {
    env: {
        'jest/globals': true,
        'browser': true,
        'node': true
    },
    settings: {
        react: {
            "version": "detect"
        }
    },
    extends: ["plugin:markdown/recommended"],
    overrides: [
        {
            files: ['*.js', '*.jsx'],
            extends: ['jest-enzyme', 'plugin:react/recommended', 'plugin:import/recommended', 'plugin:import/errors', 'plugin:import/warnings', 'plugin:jsx-a11y/recommended'],
            parser: '@babel/eslint-parser',
            plugins: ['react', 'react-hooks', 'jest', 'import'],
            rules: {
                // 因为历史原因，现有项目基本全部是4个空格
                indent: ['error', 4, {'SwitchCase': 1}],
                'comma-spacing': ["error", {"before": false, "after": true}],
                'no-multi-spaces': ["error", {ignoreEOLComments: true}],
                'no-unused-vars': 'off', // We need to consider many scenarios of deconstruction and rest, this rule is not reasonable in component library scenarios, so turn it off globally
                'react/display-name': 'off',
                'key-spacing': ["error", {"beforeColon": false}],
                'react/jsx-indent': ['error', 4],
                'react/jsx-indent-props': ['error', 4],
                'react/no-find-dom-node': 'off',
                'react/prop-types': 'off',
                'react/prefer-stateless-function': 'off',
                'jsx-a11y/alt-text': ["warn"],
                'operator-linebreak': ['warn', 'after', {'overrides': {'?': 'before', ':': 'before'}}],
                'import/no-unresolved': 'off',
                'semi': ['error', 'always'],
                'keyword-spacing': ["error", {"before": true, "after": true}],
                'jsx-a11y/click-events-have-key-events': ['warn'],
                'jsx-a11y/no-noninteractive-element-interactions': ['warn'],
                'jsx-a11y/no-autofocus': ['warn'],
                'jsx-a11y/no-static-element-interactions': ['warn'],
                'jsx-a11y/html-has-lang': ['warn'],
                'jsx-a11y/mouse-events-have-key-events': ['warn'],
                'object-curly-spacing': ['error', 'always'],
                'space-before-blocks': ['error', 'always'],
                "space-infix-ops": "error",
                'max-len': 'off',
                'react/forbid-foreign-prop-types': ['error', { "allowInPropTypes": true }]
            },
            globals: {
                "sinon": "readonly",
            },
        },
        {
            files: ['*.ts', '*.tsx'],
            excludedFiles: ['content/**'],
            extends: ['jest-enzyme', 'plugin:@typescript-eslint/recommended', 'plugin:import/typescript', 'plugin:react/recommended', 'plugin:jsx-a11y/recommended'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: ['./tsconfig.eslint.json'],
            },
            plugins: ['react', 'jest', 'react-hooks', 'import', '@typescript-eslint', 'semi-design'],
            rules: {
                // 因为历史原因，现有项目基本全部是4个空格
                "arrow-spacing": ["error", { "before": true, "after": true }],
                indent: 'off',
                'comma-spacing': ["error", {"before": false, "after": true}],
                'no-multi-spaces': ["error", {ignoreEOLComments: true}],
                'no-unused-vars': 'off', // We need to consider many scenarios of deconstruction and rest, this rule is not reasonable in component library scenarios, so turn it off globally
                'key-spacing': ["error", {"beforeColon": false, "afterColon": true}],
                '@typescript-eslint/indent': ['error', 4],
                'react/display-name': 'off',
                'react/jsx-indent': ['error', 4],
                'react/jsx-indent-props': ['error', 4],
                'react/no-find-dom-node': 'off',
                'react/prop-types': 'off',
                "react/no-unknown-property": ['error', { 
                    ignore: [
                        'x-semi-prop',
                        'x-placement',
                        'x-type',
                        'x-label-pos',
                        'x-prompt-pos',
                        'x-field-id',
                        'x-extra-pos',
                        'x-open-type',
                        'x-panel-yearandmonth-open-type',
                        'x-insetinput',
                        'x-preset-position',
                        'x-form-id'
                    ]}],
                'react-hooks/rules-of-hooks': 'error',
                'react-hooks/exhaustive-deps': 'warn',
                'react/prefer-stateless-function': 'off',
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/no-empty-interface': 'off',
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/naming-convention': 'off',
                '@typescript-eslint/ban-ts-comment': 'off',
                '@typescript-eslint/no-var-requires': 'warn',
                '@typescript-eslint/no-inferrable-types': 'off',
                '@typescript-eslint/no-this-alias': 'off',
                '@typescript-eslint/no-empty-function': 'off',
                // In scenarios where specific rest props need to be passed, some keys may be taken out first, so set 'no-unused-vars' to off
                '@typescript-eslint/no-unused-vars': 'off',
                'import/no-unresolved': 'off',
                'max-len': 'off',
                'semi': ['error', 'always'],
                'keyword-spacing': ["error", {"before": true, "after": true}],
                'jsx-a11y/click-events-have-key-events': ['warn'],
                'jsx-a11y/no-noninteractive-element-interactions': ['warn'],
                'jsx-a11y/no-autofocus': ['warn'],
                'jsx-a11y/no-static-element-interactions': ['warn'],
                'jsx-a11y/alt-text': ["warn"],
                'jsx-a11y/mouse-events-have-key-events': ["warn"],
                'jsx-a11y/html-has-lang': ['warn'],
                'object-curly-spacing': ['error', 'always'],
                'prefer-const': 'off',
                'semi-design/no-import': 'error',
                "space-infix-ops": ["error", { "int32Hint": false }],
                'space-before-blocks': ['error', 'always'],
                "space-infix-ops": "error",
                '@typescript-eslint/prefer-as-const': 'off',
                '@typescript-eslint/no-namespace': 'off',
                "@typescript-eslint/type-annotation-spacing": ['error', {"after": true}],
                "@typescript-eslint/member-delimiter-style": [
                    "error",
                    {
                        "multiline": {
                            "delimiter": "semi",
                            "requireLast": false
                        },
                        "singleline": {
                            "delimiter": "semi",
                            "requireLast": false
                        }
                    }
                ],
                'react/forbid-foreign-prop-types': ['error', { "allowInPropTypes": true }]
            }
        },
    ],
};
