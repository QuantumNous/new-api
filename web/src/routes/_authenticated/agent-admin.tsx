import { createFileRoute } from '@tanstack/react-router'
import { AgentAdmin } from '@/features/agent-admin'
export const Route = createFileRoute('/_authenticated/agent-admin')({ component: () => <AgentAdmin search={{ tab: 'agents', p: 1 }} onSearchChange={() => undefined} /> })
