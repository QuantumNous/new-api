import * as React from 'react'
import { createRootRouteWithContext } from '@tanstack/react-router'

interface MyRouterContext {
  auth: boolean
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return <div>Hello</div>
}
