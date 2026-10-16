import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from '@router-mono-simple-lazy/router'
import { RootComponent } from './rootComponent'
import type { RouteById, RouterIds } from '@router-mono-simple-lazy/router'
import type { LazyRoute } from '@tanstack/react-router'
import './style.css'

// Generic to enforce that the route returned matches the route path
type LazyRouteFn<TRoutePath extends RouterIds> = () => Promise<
  LazyRoute<RouteById<(typeof router)['routeTree'], TRoutePath>>
>

type RouterMap = {
  // __root__ is a special route that isn't lazy loaded, so we need to manually bind it
  // You could consider adding null to the returned type to have routes without rendering
  [K in Exclude<RouterIds, '__root__'>]: LazyRouteFn<K>
}

const routerMap: RouterMap = {
  '/': () =>
    import('@router-mono-simple-lazy/post-feature/post-list').then(
      (d) => d.PostRoute,
    ),
  '/$postId': () =>
    import('@router-mono-simple-lazy/post-feature/post-id-page').then(
      (d) => d.PostIdRoute,
    ),
}

// Given __root__ is a special route that isn't lazy loaded, we need to update it manually
router.routesById['__root__'].update({
  component: RootComponent,
})

Object.entries(routerMap).forEach(([path, component]) => {
  const foundRoute = router.routesById[path as RouterIds]
  // Bind the lazy route to the actual route
  foundRoute.lazy(component)
})

// Render the app
const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  console.log('Rendering')
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
