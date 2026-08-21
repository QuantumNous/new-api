import { createFileRoute } from '@tanstack/react-router'
import { leakyGetRequestUsage } from '../violations/leaky-server-import'

export const Route = createFileRoute('/leaky-server-import')({
  component: LeakyServerImportRoute,
})

function LeakyServerImportRoute() {
  return (
    <div>
      <h1 data-testid="leaky-heading">Leaky Server Import</h1>
      <p data-testid="leaky-result">{String(leakyGetRequestUsage())}</p>
    </div>
  )
}
