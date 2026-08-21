import { describe, expect, it } from 'vitest'
import { render } from '@solidjs/testing-library'
import { createContext, useContext } from 'solid-js'
import { createRootRoute, createRouter } from '../src'
import { RouterProvider } from '../src/RouterProvider'

describe('RouterProvider', () => {
  it('should provide context through RouterProvider Wrap', async () => {
    const ctx = createContext<string>()

    const rootRoute = createRootRoute({
      component: () => {
        const contextValue = useContext(ctx)
        expect(contextValue, 'Context is not provided').not.toBeUndefined()

        return <div>{contextValue}</div>
      },
    })

    const routeTree = rootRoute.addChildren([])
    const router = createRouter({
      routeTree,
    })

    const app = render(() => (
      <RouterProvider
        router={router}
        Wrap={(props) => {
          return <ctx.Provider value={'findMe'}>{props.children}</ctx.Provider>
        }}
      />
    ))

    const indexElem = await app.findByText('findMe')
    expect(indexElem).toBeInTheDocument()
  })
})
