require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  extends: ['@internal/eslint-config/profile/react'],
  globals: {
    __DEV__: 'readonly',
    __VERSION__: 'readonly',
    NodeJS: true
  },
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.eslint.json' },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.ts'],
      // 测试文件允许以下规则
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
        'no-console': 'off',
        'dot-notation': 'off'
      }
    }
  ],

  
  rules: {
    "react/display-name": "off",
    // "prettier/prettier": ["error"],
    // 强制使用 Unix 换行符： \n
    'linebreak-style': ['error', 'unix'],
    // 强制换行时操作符在行首
    // 与prettier冲突
    // "operator-linebreak": ["error", "before", { "overrides": { "=": "after" } }],
    // 允许给能自动推断出类型的primitive类型变量额外添加类型声明
    '@typescript-eslint/no-inferrable-types': 'off',
    // 在类型导入时推荐import type写法
    '@typescript-eslint/consistent-type-imports': 'warn',
    // 禁止出现空接口定义
    '@typescript-eslint/no-empty-interface': 'error',
    // 禁止出现空函数
    '@typescript-eslint/no-empty-function': 'error',
    '@typescript-eslint/no-this-alias': 'off',
    // 禁止使用namespace
    '@typescript-eslint/no-namespace': 'error',
    // 禁止使用for-in Array
    '@typescript-eslint/no-for-in-array': 'error',
    // 禁止在optional chain语句后加非空断言
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    // 接口定义中使用函数属性而不是对象方法声明
    '@typescript-eslint/method-signature-style': 'error',
    // 默认省略除属性以外的public修饰符
    '@typescript-eslint/explicit-member-accessibility': [
      'warn',
      {
        overrides: {
          accessors: 'off',
          constructors: 'no-public',
          methods: 'no-public',
          properties: 'no-public',
          parameterProperties: 'explicit'
        }
      }
    ],
    'no-console': [
      2,
      {
        allow: ['warn', 'error']
      }
    ],
    // 如果一个变量不会被重新赋值，最好使用const进行声明
    'prefer-const': 2,
    // 禁止在条件中使用常量表达式
    'no-constant-condition': 0,
    'no-debugger': 2,
    // 禁止对象字面量中出现重复的 key
    'no-dupe-keys': 2,
    // 禁止在正则表达式中使用空字符集
    'no-empty-character-class': 2,
    // 禁止对 catch 子句的参数重新赋值
    'no-ex-assign': 2,
    'no-extra-boolean-cast': 0,
    // 禁止对 function 声明重新赋值
    'no-func-assign': 2,
    // 禁止在嵌套的块中出现变量声明或 function 声明
    'no-inner-declarations': 2,
    // 禁止 RegExp 构造函数中存在无效的正则表达式字符串
    'no-invalid-regexp': 2,
    // 禁止对关系运算符的左操作数使用否定操作符
    'no-unsafe-negation': 2,
    // 禁止把全局对象作为函数调用
    'no-obj-calls': 2,
    // 禁用稀疏数组
    'no-sparse-arrays': 2,
    // 禁止在 return、throw、continue 和 break 语句之后出现不可达代码
    'no-unreachable': 2,
    // 要求使用 isNaN() 检查 NaN
    'use-isnan': 2,
    // 强制 typeof 表达式与有效的字符串进行比较
    'valid-typeof': 2,
    // 要求使用 === 和 !==，除了与 null 字面量进行比较时
    eqeqeq: [
      'error',
      'always',
      {
        null: 'ignore'
      }
    ],
    // 允许 if 语句中 return 语句之后有 else 块
    'no-else-return': 1,
    // 禁用标签语句
    'no-labels': [
      2,
      {
        // 忽略循环语句中的标签
        allowLoop: true
      }
    ],
    // 禁用 eval()
    'no-eval': 2,
    // 禁止扩展原生类型
    'no-extend-native': 2,
    // 禁止不必要的 .bind() 调用
    'no-extra-bind': 0,
    // 禁止使用类似 eval() 的方法
    'no-implied-eval': 2,
    // 禁用 __iterator__ 属性
    'no-iterator': 2,
    // 禁止不规则的空白
    'no-irregular-whitespace': 2,
    // 禁用不必要的嵌套块
    'no-lone-blocks': 2,
    // 禁止循环中存在函数
    'no-loop-func': 2,
    // 禁止多行字符串
    'no-multi-str': 2,
    // 禁止对原生对象或只读的全局对象进行赋值
    'no-global-assign': 2,
    // 禁止对 String，Number 和 Boolean 使用 new 操作符
    'no-new-wrappers': 2,
    // 禁用八进制字面量
    'no-octal': 2,
    // 禁止在字符串中使用八进制转义序列
    'no-octal-escape': 2,
    // 禁用 __proto__ 属性
    'no-proto': 2,
    // 禁止自身比较
    'no-self-compare': 2,
    // 禁止可以在有更简单的可替代的表达式时使用三元操作符
    'no-unneeded-ternary': 2,
    // 禁用 with 语句
    'no-with': 2,
    // 强制在 parseInt() 使用基数参数
    radix: 2,
    // 要求 IIFE 使用括号括起来
    'wrap-iife': [2, 'any'],
    // 禁止删除变量
    'no-delete-var': 2,
    // 禁止 function 定义中出现重名参数
    'no-dupe-args': 2,
    // 禁止出现重复的 case 标签
    'no-duplicate-case': 2,
    // 不允许标签与变量同名
    'no-label-var': 2,
    // 禁止将标识符定义为受限的名字
    'no-shadow-restricted-names': 2,
    // 禁用未声明的变量，除非它们在 /*global */ 注释中被提到
    'no-undef': 2,
    // 禁止将变量初始化为 undefined
    'no-undef-init': 2,
    // 允许在变量定义之前使用它们
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 0,
    // 强制或禁止调用无参构造函数时有圆括号
    'new-parens': 2,
    // 禁用 Array 构造函数
    'no-array-constructor': 2,
    // 禁用 Object 的构造函数
    'no-new-object': 2,
    // 禁止不必要的括号
    'no-extra-parens': [2, 'functions'],
    // 禁止使用 空格 和 tab 混合缩进
    'no-mixed-spaces-and-tabs': 2,
    // 强制函数中的变量在分开声明
    'one-var': [2, 'never'],
    // 建议回调函数最大嵌套深度不超过5
    'max-nested-callbacks': [1, 5],
    // 建议可嵌套的块的最大深度不超过6
    'max-depth': [1, 6],
    // 强制一行的最大长度不超过120，不包括注释和url
    'max-len': [
      'error',
      {
        code: 120,
        ignoreUrls: true,
        ignoreComments: true
      }
    ],
    // 建议函数定义中最多允许的参数数量不超过15个
    'max-params': [1, 15],
    // 强制非一元操作符周围有空格
    'space-infix-ops': 2,
    // 强制尽可能地使用点号
    'dot-notation': [
      2,
      {
        // 避免对是保留字的属性使用点号
        allowKeywords: true,
        allowPattern: '^catch$'
      }
    ],
    // 强制箭头函数的箭头前后使用一致的空格
    'arrow-spacing': 2,
    // 要求在构造函数中有 super() 的调用
    'constructor-super': 2,
    // 禁止在可能与比较操作符相混淆的地方使用箭头函数
    // 与prettier冲突
    // "no-confusing-arrow": [
    //   2,
    //   {
    //     // 该规则不那么严格，将括号作为有效防止混淆的语法。
    //     "allowParens": true
    //   }
    // ],
    // 禁止修改类声明的变量
    'no-class-assign': 2,
    // 禁止修改 const 声明的变量
    'no-const-assign': 2,
    // 允许在构造函数中，在调用 super() 之前使用 this 或 super
    'no-this-before-super': 0,
    // 要求使用 let 或 const 而不是 var
    'no-var': 2,
    // 重复模块导入
    'no-duplicate-imports': 1,
    // 建议使用剩余参数而不是 arguments
    'prefer-rest-params': 1,
    // 禁止 Unicode 字节顺序标记 (BOM)
    'unicode-bom': 2,
    // 强制每一行中所允许的最大语句数量为2
    'max-statements-per-line': 2,
    // 允许不必要的构造函数
    'no-useless-constructor': 0,
    // 允许在函数标识符和其调用之间有空格
    'func-call-spacing': 'off',
    '@typescript-eslint/func-call-spacing': 'error',
    // 允许出现未使用过的变量
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      1,
      {
        // 仅仅检测本作用域中声明的变量是否使用，允许不使用全局环境中的变量。
        vars: 'local',
        // 不检查参数
        args: 'none'
      }
    ],
    // 禁用特定的全局变量
    'no-restricted-globals': [2, 'event', 'name', 'length', 'orientation', 'top', 'parent', 'location', 'closed'],
    // 不允许省略大括号
    curly: 'error',
    'promise/catch-or-return': 'warn'
  },
  ignorePatterns: ['scripts/**', 'bundler.config.js']
};
