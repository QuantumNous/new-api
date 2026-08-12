import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createFileRoute('/(tests)/ssr-scroll-key')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>ssr-scroll-key</h3>
      <ScrollBlock />
    </div>
  )
}
