// Route file that defines a server function which returns a server component.
// This should NOT affect no-async-client-component reporting for the route.

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import React from 'react'

export const myFn = createServerFn().handler(() => {
  return createCompositeComponent(async () => {
    return <div>Server-only async is ok</div>
  })
})

export const Route = createFileRoute(undefined)({
  component: () => {
    return <div>Route</div>
  },
})
