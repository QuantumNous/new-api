import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as secretModule from '~/violations/secret.server'

export const Route = createFileRoute('/alias-path-namespace-leak')({
  component: AliasPathNamespaceLeak,
})

function AliasPathNamespaceLeak() {
  const secret = secretModule.getSecret?.() ?? 'missing-secret'

  return (
    <div>
      <h1 data-testid="alias-path-namespace-leak-heading">
        Alias Path Namespace Leak
      </h1>
      <p data-testid="alias-path-namespace-leak-secret">{secret}</p>
      <ClientOnly>
        <p data-testid="alias-path-namespace-leak-secret-hydration">hydrated</p>
        <p data-testid="alias-path-namespace-leak-secret-client">{secret}</p>
      </ClientOnly>
    </div>
  )
}
