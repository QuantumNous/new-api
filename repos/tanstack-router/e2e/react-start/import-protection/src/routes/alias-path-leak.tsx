import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { getSecret } from '~/violations/secret.server'

export const Route = createFileRoute('/alias-path-leak')({
  component: AliasPathLeak,
})

function AliasPathLeak() {
  const secret = getSecret()

  return (
    <div>
      <h1 data-testid="alias-path-leak-heading">Alias Path Leak</h1>
      <p data-testid="alias-path-secret">{secret}</p>
      <ClientOnly>
        <p data-testid="alias-path-secret-hydration">hydrated</p>
        <p data-testid="alias-path-secret-client">{secret}</p>
      </ClientOnly>
    </div>
  )
}
