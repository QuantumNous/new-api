import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactElement, ReactLazy } from '../src/reactSymbols'

import { createRscProxy } from '../src/createRscProxy'
import { awaitLazyElements } from '../src/awaitLazyElements'

describe('createRscProxy prop access', () => {
  it('tracks which props React accesses during rendering', () => {
    const accessedProps: Array<string | symbol> = []
    const tree = React.createElement('div', null, 'test content')

    // Create a proxy that tracks all property access
    const trackingProxy = new Proxy(function RscProxy() {}, {
      get(_target, prop) {
        accessedProps.push(prop)

        // Return values that allow React to proceed
        if (prop === 'then') return undefined
        if (prop === 'constructor') return Function
        if (prop === Symbol.toStringTag) return 'RscProxy'
        if (prop === Symbol.toPrimitive) return () => 'RscProxy'
        if (prop === 'toString') return () => 'RscProxy'
        if (prop === 'valueOf') return () => _target
        if (prop === 'displayName') return 'RscProxy'
        if (prop === 'name') return 'RscProxy'
        if (prop === 'length') return 0
        if (prop === 'contextTypes') return undefined
        if (prop === 'childContextTypes') return undefined
        if (prop === 'getDerivedStateFromProps') return undefined
        if (prop === 'defaultProps') return undefined
        if (prop === 'propTypes') return undefined
        if (prop === 'getDefaultProps') return undefined
        if (typeof prop === 'symbol') return undefined

        return undefined
      },
      apply() {
        // Return actual React element when called
        return tree
      },
      has() {
        return true
      },
      getPrototypeOf() {
        return Function.prototype
      },
    })

    function Wrapper() {
      const Component = trackingProxy as any
      return <Component />
    }

    render(<Wrapper />)

    expect(screen.getByText('test content')).toBeDefined()

    const uniqueProps = [...new Set(accessedProps.map((p) => String(p)))]

    // Keep this strict: it proves what React probes in this env.
    // This is NOT a contract for our proxy implementation.
    expect(uniqueProps.sort()).toEqual(
      [
        '$$typeof',
        'Symbol(Symbol.toStringTag)',
        'childContextTypes',
        'contextType',
        'contextTypes',
        'displayName',
        'getDerivedStateFromProps',
        'prototype',
      ].sort(),
    )
  })

  it('renders correctly with minimal prop handling', () => {
    const tree = React.createElement('div', null, 'minimal test')

    // Test with ONLY the critical props - no DevTools props
    const minimalProxy = new Proxy(function RscProxy() {}, {
      get(_target, prop) {
        // Critical props only
        if (prop === 'then') return undefined
        if (prop === 'constructor') return Function

        // Legacy class component props
        switch (prop) {
          case 'contextTypes':
          case 'childContextTypes':
          case 'getDerivedStateFromProps':
          case 'defaultProps':
          case 'propTypes':
          case 'getDefaultProps':
            return undefined
        }

        // Unknown symbols
        if (typeof prop === 'symbol') return undefined

        return undefined
      },
      apply() {
        return tree
      },
      has() {
        return true
      },
      getPrototypeOf() {
        return Function.prototype
      },
    })

    function Wrapper() {
      const Component = minimalProxy as any
      return <Component />
    }

    // This should render without errors even with minimal props
    render(<Wrapper />)

    expect(screen.getByText('minimal test')).toBeDefined()
  })
})

describe('awaitLazyElements', () => {
  /**
   * Creates a mock lazy element similar to what Flight decoder produces.
   * The _payload has a status and is thenable.
   */
  function createMockLazy(initialStatus: 'pending' | 'fulfilled' = 'pending') {
    let status = initialStatus
    const callbacks: Array<() => void> = []

    const payload = {
      get status() {
        return status
      },
      then(onFulfill: () => void) {
        if (status === 'fulfilled') {
          queueMicrotask(onFulfill)
        } else {
          callbacks.push(onFulfill)
        }
      },
    }

    return {
      $$typeof: ReactLazy,
      _payload: payload,
      _resolve() {
        status = 'fulfilled'
        callbacks.forEach((cb) => cb())
        callbacks.length = 0
      },
    }
  }

  it('awaits pending lazy elements', async () => {
    const lazy = createMockLazy()

    // Resolve after a microtask
    queueMicrotask(() => lazy._resolve())

    await awaitLazyElements(lazy)

    expect(lazy._payload.status).toBe('fulfilled')
  })

  it('skips already fulfilled lazy elements', async () => {
    const lazy = createMockLazy('fulfilled')

    // Should complete immediately without hanging
    await awaitLazyElements(lazy)

    expect(lazy._payload.status).toBe('fulfilled')
  })

  it('handles multiple lazy elements at different depths', async () => {
    const lazy1 = createMockLazy()
    const lazy2 = createMockLazy()
    const lazy3 = createMockLazy()

    const tree = {
      $$typeof: ReactElement,
      type: 'div',
      props: {
        children: [
          lazy1,
          {
            $$typeof: ReactElement,
            type: 'div',
            props: {
              children: [
                lazy2,
                {
                  $$typeof: ReactElement,
                  type: 'span',
                  props: { children: lazy3 },
                },
              ],
            },
          },
        ],
      },
    }

    // Resolve all after microtasks
    queueMicrotask(() => {
      lazy1._resolve()
      lazy2._resolve()
      lazy3._resolve()
    })

    await awaitLazyElements(tree)

    expect(lazy1._payload.status).toBe('fulfilled')
    expect(lazy2._payload.status).toBe('fulfilled')
    expect(lazy3._payload.status).toBe('fulfilled')
  })

  it('stops at Suspense boundaries', async () => {
    const lazyInsideSuspense = createMockLazy()
    const lazyOutsideSuspense = createMockLazy()

    const tree = {
      $$typeof: ReactElement,
      type: 'div',
      props: {
        children: [
          lazyOutsideSuspense,
          {
            $$typeof: ReactElement,
            type: Symbol.for('react.suspense'),
            props: { children: lazyInsideSuspense },
          },
        ],
      },
    }

    // Only resolve the outside one
    queueMicrotask(() => lazyOutsideSuspense._resolve())

    await awaitLazyElements(tree)

    // Outside should be resolved
    expect(lazyOutsideSuspense._payload.status).toBe('fulfilled')
    // Inside Suspense should NOT be awaited (still pending)
    expect(lazyInsideSuspense._payload.status).toBe('pending')
  })
})
