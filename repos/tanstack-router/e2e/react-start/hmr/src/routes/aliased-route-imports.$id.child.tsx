import { createFileRoute } from '@tanstack/react-router'
import { AliasedRouteImportChildPanel } from '../components/AliasedRouteImportChildPanel'

export const Route = createFileRoute('/aliased-route-imports/$id/child')({
  component: AliasedRouteImportChildPanel,
})
