import { render } from 'solid-js/web'
import { RouterProvider } from '@tanstack/solid-router'
import { Outlet, router } from '@router-solid-mono-simple/router'
import {
  PostErrorComponent,
  PostIdComponent,
  PostsListComponent,
} from '@router-solid-mono-simple/post-feature'
import { RootComponent } from './rootComponent'
import type { RouterIds } from '@router-solid-mono-simple/router'
import type { JSX } from 'solid-js'
import './style.css'
// Not lazy loaded for simplicity, but you could expose from your library component
// individually, and enforce here to use solid lazy components via typings
// so that you have code splitting
const routerMap = {
  '/': PostsListComponent,
  '/$postId': PostIdComponent,
  __root__: RootComponent,
} as const satisfies Record<RouterIds, (() => JSX.Element) | null>

function EmptyComponent() {
  return <Outlet />
}

Object.entries(routerMap).forEach(([path, component]) => {
  const foundRoute = router.routesById[path as RouterIds]
  foundRoute.update({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    component: component ?? EmptyComponent,
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
  render(() => <RouterProvider router={router} />, rootElement)
}
