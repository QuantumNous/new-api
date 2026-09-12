import { RuleTester } from '@typescript-eslint/rule-tester'

import { name, rule } from '../rules/route-param-names/route-param-names.rule'

const ruleTester = new RuleTester()

ruleTester.run(name, rule, {
  valid: [
    // Valid param names - simple $param format
    {
      name: 'valid simple param: $userId',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$userId')({})
      `,
    },
    {
      name: 'valid simple param: $id',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/posts/$id')({})
      `,
    },
    {
      name: 'valid simple param: $_id (underscore prefix)',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/items/$_id')({})
      `,
    },
    {
      name: 'valid simple param: $$var (dollar prefix)',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/data/$$var')({})
      `,
    },
    {
      name: 'valid param with numbers: $user123',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$user123')({})
      `,
    },

    // Valid param names - braces format {$param}
    {
      name: 'valid braces param: {$userName}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/{$userName}')({})
      `,
    },
    {
      name: 'valid braces param with prefix/suffix: prefix{$id}suffix',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/items/item-{$id}-details')({})
      `,
    },

    // Valid optional params - {-$param}
    {
      name: 'valid optional param: {-$optional}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/search/{-$query}')({})
      `,
    },
    {
      name: 'valid optional param with prefix/suffix: prefix{-$opt}suffix',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/filter/by-{-$category}-items')({})
      `,
    },

    // Wildcards - should be skipped (no validation)
    {
      name: 'wildcard: $ alone',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/files/$')({})
      `,
    },
    {
      name: 'wildcard: {$}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/catch/{$}')({})
      `,
    },

    // Multiple valid params
    {
      name: 'multiple valid params in path',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$userId/posts/$postId')({})
      `,
    },

    // createRoute with path property
    {
      name: 'createRoute with valid param in path property',
      code: `
        import { createRoute } from '@tanstack/react-router'
        const Route = createRoute({ path: '/users/$userId' })
      `,
    },

    // createLazyFileRoute
    {
      name: 'createLazyFileRoute with valid param',
      code: `
        import { createLazyFileRoute } from '@tanstack/react-router'
        const Route = createLazyFileRoute('/users/$userId')({})
      `,
    },

    // createLazyRoute
    {
      name: 'createLazyRoute with valid param',
      code: `
        import { createLazyRoute } from '@tanstack/react-router'
        const Route = createLazyRoute('/users/$userId')({})
      `,
    },

    // No params - should pass
    {
      name: 'no params in path',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/list')({})
      `,
    },

    // Not from tanstack router - should be ignored
    {
      name: 'non-tanstack import should be ignored',
      code: `
        import { createFileRoute } from 'other-router'
        const Route = createFileRoute('/users/$123invalid')({})
      `,
    },
  ],

  invalid: [
    // Invalid param names - starts with number
    {
      name: 'invalid param starting with number: $123',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$123')({})
      `,
      errors: [{ messageId: 'invalidParamName', data: { paramName: '123' } }],
    },
    {
      name: 'invalid param starting with number: $1user',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$1user')({})
      `,
      errors: [{ messageId: 'invalidParamName', data: { paramName: '1user' } }],
    },

    // Invalid param names - contains hyphen
    {
      name: 'invalid param with hyphen: $user-name',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$user-name')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: 'user-name' } },
      ],
    },

    // Invalid param names - contains dot
    {
      name: 'invalid param with dot: {$my.param}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/{$my.param}')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: 'my.param' } },
      ],
    },

    // Invalid param names - contains space
    {
      name: 'invalid param with space: {$param name}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/{$param name}')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: 'param name' } },
      ],
    },

    // Invalid optional param
    {
      name: 'invalid optional param: {-$123invalid}',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/search/{-$123invalid}')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: '123invalid' } },
      ],
    },

    // Multiple invalid params
    {
      name: 'multiple invalid params in path',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/users/$1id/posts/$post-id')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: '1id' } },
        { messageId: 'invalidParamName', data: { paramName: 'post-id' } },
      ],
    },

    // createRoute with invalid path property
    {
      name: 'createRoute with invalid param in path property',
      code: `
        import { createRoute } from '@tanstack/react-router'
        const Route = createRoute({ path: '/users/$123' })
      `,
      errors: [{ messageId: 'invalidParamName', data: { paramName: '123' } }],
    },

    // createLazyFileRoute with invalid param
    {
      name: 'createLazyFileRoute with invalid param',
      code: `
        import { createLazyFileRoute } from '@tanstack/react-router'
        const Route = createLazyFileRoute('/users/$user-id')({})
      `,
      errors: [
        { messageId: 'invalidParamName', data: { paramName: 'user-id' } },
      ],
    },

    // createLazyRoute with invalid param
    {
      name: 'createLazyRoute with invalid param',
      code: `
        import { createLazyRoute } from '@tanstack/react-router'
        const Route = createLazyRoute('/users/$1abc')({})
      `,
      errors: [{ messageId: 'invalidParamName', data: { paramName: '1abc' } }],
    },

    // Invalid braces param with prefix/suffix
    {
      name: 'invalid braces param with prefix/suffix',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        const Route = createFileRoute('/items/item-{$123}-details')({})
      `,
      errors: [{ messageId: 'invalidParamName', data: { paramName: '123' } }],
    },
  ],
})
