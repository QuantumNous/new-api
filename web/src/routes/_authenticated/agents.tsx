import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
import { agentWorkspaceSearchSchema } from '@/features/agents/lib/workspace'
import { getAgentOverview } from '@/features/agents/api'
import { useQuery } from '@tanstack/react-query'
export const Route = createFileRoute('/_authenticated/agents')({ validateSearch: agentWorkspaceSearchSchema, component: AgentsRoute })
function AgentsRoute() {
  const { t } = useTranslation()
  const access = useAgentAccess(); const overview = useQuery({ queryKey: ['agent-overview'], queryFn: () => getAgentOverview(), enabled: access.hasAccess }); const search = Route.useSearch(); const navigate = Route.useNavigate()
  if (access.isChecking || overview.isLoading) return null
  if (!access.hasAccess) throw redirect({ to: '/' })
  if (overview.isError) return <div className='p-6 text-destructive'>{t('Unable to load agent overview')}</div>
  if (!overview.data || !overview.data.success) return null
  return <AgentWorkspace search={search} initialOverview={overview.data.data} onSearchChange={(updates) => { void navigate({ search: (prev) => ({ ...prev, ...updates }) }) }} />
}
