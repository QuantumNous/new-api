import { createFileRoute } from '@tanstack/react-router'
import { AliasedRouteImportParentPanel } from '../components/AliasedRouteImportParentPanel'

export const Route = createFileRoute('/aliased-route-imports/$id')({
  component: AliasedRouteImportParentPanel,
})
