const rule = require('../lib/rules/index').default;
const RuleTester = require('eslint').RuleTester;
const eslintConfig = require('../.eslintrc.json');

const ruleTester = new RuleTester({ parserOptions: eslintConfig.parserOptions });
const { messages } = rule['no-import'].meta;

ruleTester.run('no-import', rule['no-import'], {
    valid: [
        {
            code: 'var invalidVariable = true',
        },
        {
            code: "import { Input } from '@douyinfe/semi-ui'",
            filename: 'packages/semi-ui/table/_story/v2/fixedResizableWithForm.tsx',
        },
    ],
    invalid: [
        {
            code: "import Input from '@douyinfe/semi-ui'",
            filename: 'packages/semi-foundation/input/foundation.ts',
            errors: [{ message: messages.unexpected }]
        },
        {
            code: "import { get } from 'lodash-es'",
            filename: 'packages/semi-foundation/input/foundation.ts',
            output: "import { get } from 'lodash'",
            errors: [{ message: messages.unexpectedLodashES }]
        },
        {
            code: "import get from 'lodash-es/get'",
            filename: 'packages/semi-ui/input/index.tsx',
            output: "import get from 'lodash/get'",
            errors: [{ message: messages.unexpectedLodashES }]
        },
        {
            code: "import inputNumberFoundation from '../../semi-foundation/inputNumber/foundation.ts'",
            filename: 'packages/semi-ui/inputNumber/index.tsx',
            output: "import inputNumberFoundation from '@douyinfe/semi-foundation/inputNumber/foundation.ts'",
            errors: [{ message: messages.unexpectedRelativeImport }]
        },
        {
            code: "import Input from '@douyinfe/semi-ui/input/index.tsx'",
            filename: 'packages/semi-ui/inputNumber/index.tsx',
            errors: [{ message: messages.unexpectedImportSelf }]
        },
        {
            code: "import React from 'react'",
            filename: 'packages/semi-foundation/input/foundation.ts',
            errors: [{ message: messages.unexpectedReactImport }]
        },
        {
            code: "import React from 'react-dom'",
            filename: 'packages/semi-foundation/input/foundation.ts',
            errors: [{ message: messages.unexpectedReactImport }]
        },
    ]
});