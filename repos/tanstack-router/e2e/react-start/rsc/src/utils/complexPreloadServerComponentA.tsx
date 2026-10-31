import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { ComplexPreloadContentA } from './ComplexPreloadContentA'

// ============================================================================
// Server function that returns server component A (with children slot)
// Separate module from B so CSS is not bundled together
// ============================================================================

export const getComplexPreloadServerComponentA = createServerFn({
  method: 'GET',
})
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    return createCompositeComponent((props: { children?: React.ReactNode }) => (
      <ComplexPreloadContentA data={data}>
        {props.children}
      </ComplexPreloadContentA>
    ))
  })
