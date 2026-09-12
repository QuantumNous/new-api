import { createLazyFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { ScrollBlock } from '../-components/scroll-block'

export const Route = createLazyFileRoute('/(tests)/lazy-page')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>lazy-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
