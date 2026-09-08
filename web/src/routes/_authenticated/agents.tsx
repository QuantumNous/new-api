import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
import { agentWorkspaceSearchSchema } from '@/features/agents/lib/workspace'
import { getAgentOverview } from '@/features/agents/api'
import { useQuery } from '@tanstack/react-query'
export const Route = createFileRoute('/_authenticated/agents')({ validateSearch: agentWorkspaceSearchSchema, component: AgentsRoute })
function AgentsRoute() {
  const access = useAgentAccess(); const overview = useQuery({ queryKey: ['agent-overview'], queryFn: () => getAgentOverview() }); const search = Route.useSearch(); const navigate = Route.useNavigate()
  if (access.isChecking || overview.isLoading) return null
  if (!access.hasAccess) throw redirect({ to: '/' })
  if (!overview.data?.data) return null
  return <AgentWorkspace search={search} initialOverview={overview.data.data} onSearchChange={(updates) => { void navigate({ search: (prev) => ({ ...prev, ...updates }) }) }} />
}
