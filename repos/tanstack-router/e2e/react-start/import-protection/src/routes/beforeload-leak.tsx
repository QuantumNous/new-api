import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromRequest } from '../violations/beforeload-server-leak'

export const Route = createFileRoute('/beforeload-leak')({
  // beforeLoad is NOT stripped by the compiler on the client side.
  // It is not in splitRouteIdentNodes or deleteNodes, so this import
  // chain survives: beforeload-leak.tsx -> beforeload-server-leak.ts
  //   -> @tanstack/react-start/server
  // This is a TRUE POSITIVE violation in the client environment.
  beforeLoad: () => {
    const session = getSessionFromRequest()
    return { session }
  },
  component: BeforeloadLeakRoute,
})

function BeforeloadLeakRoute() {
  return (
    <div>
      <h1 data-testid="beforeload-leak-heading">Beforeload Leak</h1>
      <p data-testid="beforeload-leak-status">Route loaded</p>
    </div>
  )
}
