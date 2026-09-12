// Server component that transitively imports client code through multiple files
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { MiddleComponent } from './middle-component'

export const ServerComponent = createCompositeComponent(() => {
  return (
    <div>
      <MiddleComponent />
    </div>
  )
})
