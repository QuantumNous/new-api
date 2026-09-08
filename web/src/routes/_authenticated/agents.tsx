import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
export const Route = createFileRoute('/_authenticated/agents')({ component: AgentsRoute })
function AgentsRoute() {
  const access = useAgentAccess()
  if (access.isPending) return null
  if (!access.hasAccess) throw redirect({ to: '/' })
  return <AgentWorkspace search={{ tab: 'overview', p: 1 }} initialOverview={{} as never} onSearchChange={() => undefined} />
}
