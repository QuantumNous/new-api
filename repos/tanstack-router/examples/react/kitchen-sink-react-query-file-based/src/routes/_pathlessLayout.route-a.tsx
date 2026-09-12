import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/_pathlessLayout/route-a')({
  component: LayoutAComponent,
})

function LayoutAComponent() {
  return <div>I'm A!</div>
}
