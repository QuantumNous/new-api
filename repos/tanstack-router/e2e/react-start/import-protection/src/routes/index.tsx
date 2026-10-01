import { createFileRoute } from '@tanstack/react-router'
// This import chain triggers a file-based violation in the CLIENT env:
//   index.tsx -> violations/edge-a.ts -> violations/secret.server.ts
import { getWrappedSecret } from '../violations/edge-a'
import { getWrappedSecret1 } from '../violations/edge-1'
// This import triggers a marker violation in the CLIENT env:
//   index.tsx -> violations/marked-server-only-edge.ts -> violations/marked-server-only.ts
import { getServerOnlyDataViaEdge } from '../violations/marked-server-only-edge'
import { secretServerFn } from '../violations/compiler-leak'
import { factorySafeServerFn } from '../violations/factory-safe/usage'
import {
  safeIsomorphic,
  safeServerFn,
  safeServerOnly,
} from '../violations/boundary-safe'
import {
  crossBoundarySafeServerFn,
  crossBoundarySafeWithAuth,
} from '../violations/cross-boundary-safe/usage'
import { safeFn } from '../violations/cross-boundary-leak/safe-consumer'
import { leakyGetSharedData } from '../violations/cross-boundary-leak/leaky-consumer'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h1 data-testid="heading">Import Protection E2E</h1>
      <p data-testid="status">App loaded successfully with mock mode</p>
      <p data-testid="secret">{getWrappedSecret()}</p>
      <p data-testid="secret-deep">{getWrappedSecret1()}</p>
      <p data-testid="server-only-data">{getServerOnlyDataViaEdge()}</p>
      <p data-testid="compiler-ok">{String(typeof secretServerFn)}</p>
      <p data-testid="factory-safe">{String(typeof factorySafeServerFn)}</p>
      <p data-testid="boundary-safe-so">{String(typeof safeServerOnly)}</p>
      <p data-testid="boundary-safe-sf">{String(typeof safeServerFn)}</p>
      <p data-testid="boundary-safe-iso">{String(typeof safeIsomorphic)}</p>
      <p data-testid="cross-boundary-safe-sf">
        {String(typeof crossBoundarySafeServerFn)}
      </p>
      <p data-testid="cross-boundary-safe-mw">
        {String(typeof crossBoundarySafeWithAuth)}
      </p>
      <p data-testid="cross-boundary-leak-safe">{String(typeof safeFn)}</p>
      <p data-testid="cross-boundary-leak-leaky">
        {String(typeof leakyGetSharedData)}
      </p>
    </div>
  )
}
