import { createFileRoute } from '@tanstack/react-router'
import { type RequestHandler } from '@tanstack/react-start/server'
import type { TypeOnlySecret } from '../violations/type-only.server'

type TypeOnlyStatus = TypeOnlySecret & {
  requestHandler?: RequestHandler<Record<string, never>>
}

const status: TypeOnlyStatus = {
  message: 'type-only protected imports are safe',
}

function getStatusMessage(): string {
  return status.message
}

export const Route = createFileRoute('/type-only-protected-import')({
  component: TypeOnlyProtectedImport,
})

function TypeOnlyProtectedImport() {
  return (
    <div>
      <h1 data-testid="type-only-protected-import-heading">
        Type-Only Protected Import
      </h1>
      <p data-testid="type-only-protected-import-status">
        {getStatusMessage()}
      </p>
    </div>
  )
}
