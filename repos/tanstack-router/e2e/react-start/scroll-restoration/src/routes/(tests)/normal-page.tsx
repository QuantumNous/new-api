import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createFileRoute('/(tests)/normal-page')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>normal-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
