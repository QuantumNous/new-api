import * as React from 'react'
import { createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return <div>Hello</div>
}
