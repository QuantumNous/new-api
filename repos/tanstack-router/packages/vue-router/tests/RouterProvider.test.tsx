import * as Vue from 'vue'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/vue'
import { createRootRoute, createRouter } from '../src'
import { RouterProvider } from '../src/RouterProvider'

describe('RouterProvider', () => {
  it('should provide context through RouterProvider Wrap (via router options)', async () => {
    const ctxKey = Symbol('ctx') as Vue.InjectionKey<string>

    const rootRoute = createRootRoute({
      component: () => {
        const contextValue = Vue.inject(ctxKey)
        expect(contextValue, 'Context is not provided').not.toBeUndefined()

        return <div>{contextValue}</div>
      },
    })

    const routeTree = rootRoute.addChildren([])

    // Vue RouterProvider supports Wrap via router.options.Wrap, not as a prop
    // Use defineComponent to properly call provide() in setup
    const WrapComponent = Vue.defineComponent({
      setup(_, { slots }) {
        Vue.provide(ctxKey, 'findMe')
        return () => slots.default?.()
      },
    })

    const router = createRouter({
      routeTree,
      Wrap: WrapComponent as any,
    })

    const app = render(<RouterProvider router={router} />)

    const indexElem = await app.findByText('findMe')
    expect(indexElem).toBeInTheDocument()
  })
})
