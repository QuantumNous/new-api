import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
import { agentWorkspaceSearchSchema } from '@/features/agents/lib/workspace'
export const Route = createFileRoute('/_authenticated/agents')({ validateSearch: agentWorkspaceSearchSchema, component: AgentsRoute })
function AgentsRoute() {
  const access = useAgentAccess(); const search = Route.useSearch(); const navigate = Route.useNavigate()
  if (access.isChecking) return null
  if (!access.hasAccess) throw redirect({ to: '/' })
  return <AgentWorkspace search={search} initialOverview={{} as never} onSearchChange={(updates) => { void navigate({ search: (prev) => ({ ...prev, ...updates }) }) }} />
}
