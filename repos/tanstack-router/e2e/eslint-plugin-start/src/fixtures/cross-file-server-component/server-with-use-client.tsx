// Valid: Server component that imports from a 'use client' file
// Should NOT error because the client code is behind a 'use client' boundary
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { UseClientComponent } from './use-client-boundary'

export const ValidServerComponent = createCompositeComponent(() => {
  return (
    <div>
      <h1>Server rendered</h1>
      <UseClientComponent />
    </div>
  )
})
