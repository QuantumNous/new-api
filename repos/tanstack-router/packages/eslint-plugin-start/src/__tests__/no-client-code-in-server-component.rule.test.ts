import * as path from 'node:path'
import { RuleTester } from '@typescript-eslint/rule-tester'
import * as vitest from 'vitest'

import {
  name,
  rule,
} from '../rules/no-client-code-in-server-component/no-client-code-in-server-component.rule'

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
      },
      tsconfigRootDir: path.join(__dirname),
    },
  },
})

ruleTester.run(name, rule as any, {
  valid: [
    // useId is allowed in server components
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const id = useId()
          return <div id={id}>Content</div>
        })
      `,
    },
    // File with 'use client' is skipped entirely
    {
      code: `
        'use client'
        
        import { useState } from 'react'
        
        function ClientComponent() {
          const [state] = useState(0)
          return <button onClick={() => {}}>Click</button>
        }
      `,
    },
    // Async server component is fine
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(async () => {
          const data = await fetch('/api/data')
          return <div>{data}</div>
        })
      `,
    },
    // Regular function outside createCompositeComponent is fine
    {
      code: `
        function RegularComponent() {
          const [state] = useState(0)
          return <button onClick={() => {}}>Click</button>
        }
      `,
    },
    // Component passed as prop (slot) is allowed
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(({ ActionButton }) => {
          return <div><ActionButton /></div>
        })
      `,
    },
    // Component from destructured props is allowed
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent((props) => {
          const { ActionButton } = props
          return <div><ActionButton /></div>
        })
      `,
    },
    // Non-JSX attribute function is allowed (not an event handler)
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <div style={{ color: 'red' }}>Content</div>
        })
      `,
    },
    // Static strings and primitives are fine
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const name = "John"
          return <div className="container">{name}</div>
        })
      `,
    },
    // Custom hook allowed via options
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const data = useServerData()
          return <div>{data}</div>
        })
      `,
      options: [{ allowedServerHooks: ['useServerData'] }],
    },
  ],
  invalid: [
    // Hook in inline server component
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const [state] = useState(0)
          return <div>{state}</div>
        })
      `,
      errors: [{ messageId: 'hookInServerComponent' }],
    },
    // Browser API in server component
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const width = window.innerWidth
          return <div>{width}</div>
        })
      `,
      errors: [{ messageId: 'browserGlobalInServerComponent' }],
    },
    // Event handler in server component
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <button onClick={() => {}}>Click</button>
        })
      `,
      errors: [{ messageId: 'eventHandlerInServerComponent' }],
    },
    // Event handler on intrinsic element (div) is also not allowed
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <div onClick={() => {}}>Click</div>
        })
      `,
      errors: [{ messageId: 'eventHandlerInServerComponent' }],
    },
    // Multiple violations
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const [state] = useState(0)
          const width = window.innerWidth
          return <button onClick={() => {}}>{state} - {width}</button>
        })
      `,
      errors: [
        { messageId: 'hookInServerComponent' },
        { messageId: 'browserGlobalInServerComponent' },
        { messageId: 'eventHandlerInServerComponent' },
      ],
    },
    // localStorage browser API
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const val = localStorage.getItem('key')
          return <div>{val}</div>
        })
      `,
      errors: [{ messageId: 'browserGlobalInServerComponent' }],
    },
    // document browser API
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const el = document.getElementById('foo')
          return <div>{el}</div>
        })
      `,
      errors: [{ messageId: 'browserGlobalInServerComponent' }],
    },
    // useEffect hook
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          useEffect(() => {}, [])
          return <div>Content</div>
        })
      `,
      errors: [{ messageId: 'hookInServerComponent' }],
    },
    // useRef hook
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const ref = useRef(null)
          return <div ref={ref}>Content</div>
        })
      `,
      errors: [{ messageId: 'hookInServerComponent' }],
    },
    // useContext hook
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          const ctx = useContext(MyContext)
          return <div>{ctx}</div>
        })
      `,
      errors: [{ messageId: 'hookInServerComponent' }],
    },
    // onSubmit event handler
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <form onSubmit={() => {}}>Submit</form>
        })
      `,
      errors: [{ messageId: 'eventHandlerInServerComponent' }],
    },
    // onChange event handler
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <input onChange={() => {}} />
        })
      `,
      errors: [{ messageId: 'eventHandlerInServerComponent' }],
    },
    // onMouseEnter event handler
    {
      code: `
        import { createCompositeComponent } from '@tanstack/react-start/rsc'
        
        createCompositeComponent(() => {
          return <div onMouseEnter={() => {}}>Hover</div>
        })
      `,
      errors: [{ messageId: 'eventHandlerInServerComponent' }],
    },
  ],
})
