import * as path from 'node:path'
import { RuleTester } from '@typescript-eslint/rule-tester'
import * as vitest from 'vitest'

import {
  name,
  rule,
} from '../rules/no-async-client-component/no-async-client-component.rule'

RuleTester.afterAll = vitest.afterAll
RuleTester.it = ((name, fn) =>
  vitest.it(name, { timeout: 15000 }, fn)) as typeof RuleTester.it
RuleTester.itOnly = vitest.it.only
RuleTester.describe = vitest.describe

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      projectService: {
        allowDefaultProject: ['*.tsx'],
        maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 50,
      },
      tsconfigRootDir: path.join(__dirname),
    },
  },
})

ruleTester.run(name, rule as any, {
  valid: [
    // Sync component in route is fine
    {
      filename: 'SyncRoute.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        function SyncComponent() {
          return <div>Hello</div>
        }
        
        export const Route = createFileRoute('/')({
          component: SyncComponent,
        })
      `,
    },
    // Async inside createCompositeComponent is fine
    {
      filename: 'ServerComponent.tsx',
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(async () => {
          const data = await fetch('/api')
          return <div>{data}</div>
        })
      `,
    },
    // Sync component with 'use client' is fine (not async)
    {
      filename: 'ClientFile.tsx',
      code: `
        'use client'
        
        function ClientComponent() {
          return <button onClick={() => {}}>Click</button>
        }
      `,
    },
    // Inline sync component in route is fine
    {
      filename: 'InlineRoute.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        export const Route = createFileRoute('/')({
          component: () => <div>Hello</div>,
        })
      `,
    },
    // Sync pendingComponent is fine
    {
      filename: 'SyncPending.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        function Loading() {
          return <div>Loading...</div>
        }
        
        export const Route = createFileRoute('/')({
          component: () => <div>Hello</div>,
          pendingComponent: Loading,
        })
      `,
    },
    // createRootRoute with sync component is fine
    {
      filename: 'RootSync.tsx',
      code: `
        import { createRootRoute } from '@tanstack/react-router'
        
        function RootLayout() {
          return <div>Layout</div>
        }
        
        export const Route = createRootRoute()({
          component: RootLayout,
        })
      `,
    },
  ],
  invalid: [
    // Async component directly in route option
    {
      filename: 'AsyncRoute.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        async function AsyncPage() {
          const data = await fetch('/api')
          return <div>{data}</div>
        }
        
        export const Route = createFileRoute('/')({
          component: AsyncPage,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async component in 'use client' file
    {
      filename: 'AsyncClient.tsx',
      code: `
        'use client'
        
        export async function AsyncClientComponent() {
          return <div>Async</div>
        }
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async arrow component in route
    {
      filename: 'AsyncArrowRoute.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        const AsyncPage = async () => {
          return <div>Async</div>
        }
        
        export const Route = createFileRoute('/')({
          component: AsyncPage,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async pendingComponent
    {
      filename: 'AsyncPending.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        async function AsyncPending() {
          return <div>Loading...</div>
        }
        
        export const Route = createFileRoute('/')({
          component: () => <div>Hello</div>,
          pendingComponent: AsyncPending,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async errorComponent
    {
      filename: 'AsyncError.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        async function AsyncError() {
          return <div>Error</div>
        }
        
        export const Route = createFileRoute('/')({
          component: () => <div>Hello</div>,
          errorComponent: AsyncError,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async in createRootRoute
    {
      filename: 'AsyncRoot.tsx',
      code: `
        import { createRootRoute } from '@tanstack/react-router'
        
        async function AsyncRoot() {
          return <div>Root</div>
        }
        
        export const Route = createRootRoute()({
          component: AsyncRoot,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Async in createRootRouteWithContext
    {
      filename: 'AsyncRootWithContext.tsx',
      code: `
        import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

        interface MyRouterContext {
          foo: string
        }

        async function AsyncRoot() {
          return <div>Root</div>
        }

        const rootRoute = createRootRouteWithContext<MyRouterContext>()({
          component: AsyncRoot,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
    // Multiple async components in same file
    {
      filename: 'AsyncMultiple.tsx',
      code: `
        import { createFileRoute } from '@tanstack/react-router'
        
        async function AsyncOne() {
          return <div>One</div>
        }
        
        async function AsyncTwo() {
          return <div>Two</div>
        }
        
        export const Route = createFileRoute('/')({
          component: AsyncOne,
          pendingComponent: AsyncTwo,
        })
      `,
      errors: [
        {
          messageId: 'asyncClientComponentDefinition',
        },
        {
          messageId: 'asyncClientComponentDefinition',
        },
      ],
    },
  ],
})
