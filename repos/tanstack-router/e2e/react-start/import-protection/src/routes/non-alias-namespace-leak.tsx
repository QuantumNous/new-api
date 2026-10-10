import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as secretModule from '../violations/secret.server'

export const Route = createFileRoute('/non-alias-namespace-leak')({
  component: NonAliasNamespaceLeak,
})

function NonAliasNamespaceLeak() {
  const secret = secretModule.getSecret?.() ?? 'missing-secret'

  return (
    <div>
      <h1 data-testid="non-alias-namespace-leak-heading">
        Non-Alias Namespace Leak
      </h1>
      <p data-testid="non-alias-namespace-leak-secret">{secret}</p>
      <ClientOnly>
        <p data-testid="non-alias-namespace-leak-secret-hydration">hydrated</p>
        <p data-testid="non-alias-namespace-leak-secret-client">{secret}</p>
      </ClientOnly>
    </div>
  )
}
