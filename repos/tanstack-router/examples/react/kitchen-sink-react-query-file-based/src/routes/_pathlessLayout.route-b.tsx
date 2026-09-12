import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/_pathlessLayout/route-b')({
  component: LayoutBComponent,
})

function LayoutBComponent() {
  return <div>I'm B!</div>
}
