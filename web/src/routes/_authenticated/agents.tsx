import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'
import { useAgentAccess } from '@/features/agents/hooks/use-agent-access'
export const Route = createFileRoute('/_authenticated/agents')({
  beforeLoad: ({ location }) => { if (!useAgentAccess) throw redirect({ to: '/', search: { redirect: location.href } }) },
  component: () => <AgentWorkspace search={{ tab: 'overview', p: 1 }} initialOverview={{} as never} onSearchChange={() => undefined} />,
})
