import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/params')({
  component: () => <div>Hello /params!</div>,
})
