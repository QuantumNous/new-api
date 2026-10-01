import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { ComplexPreloadContentB } from './ComplexPreloadContentB'

// ============================================================================
// Server function that returns server component B (no children slot)
// Separate module from A so CSS is not bundled together
// ============================================================================

export const getComplexPreloadServerComponentB = createServerFn({
  method: 'GET',
})
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    return renderServerComponent(<ComplexPreloadContentB data={data} />)
  })
