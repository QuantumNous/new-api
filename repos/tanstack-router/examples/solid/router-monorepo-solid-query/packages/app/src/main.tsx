import { render } from 'solid-js/web'
import { RouterProvider } from '@tanstack/solid-router'
import { QueryClientProvider } from '@tanstack/solid-query'
import { queryClient, router } from '@router-solid-mono-solid-query/router'
import {
  PostErrorComponent,
  PostIdComponent,
  PostsListComponent,
} from '@router-solid-mono-solid-query/post-feature'
import { RootComponent } from './rootComponent'
import type { RouterIds } from '@router-solid-mono-solid-query/router'
import './style.css'
import type { JSX } from 'solid-js'
// Not lazy loaded for simplicity, but you could expose from your library component
// individually, and enforce here to use react lazy components via typings
// so that you have code splitting
const routerMap = {
  '/': PostsListComponent,
  '/$postId': PostIdComponent,
  __root__: RootComponent,
} as const satisfies Record<RouterIds, () => JSX.Element>

Object.entries(routerMap).forEach(([path, component]) => {
  const foundRoute = router.routesById[path as RouterIds]

  foundRoute.update({
    component: component,
  })
})

// And you can do the same logic with custom error pages, and any other properties
const errorComponentMap = {
  '/': null,
  '/$postId': PostErrorComponent,
  __root__: null,
}

Object.entries(errorComponentMap).forEach(([path, component]) => {
  if (!component) {
    return
  }

  const foundRoute = router.routesById[path as RouterIds]
  foundRoute.update({
    errorComponent: component,
  })
})

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    rootElement,
  )
}
