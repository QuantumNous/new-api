import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

export const apiKeyStatuses = [
  {
    label: 'Enabled',
    value: 1 as const,
    icon: CheckCircle,
    color: 'success' as const,
  },
  {
    label: 'Disabled',
    value: 2 as const,
    icon: XCircle,
    color: 'danger' as const,
  },
  {
    label: 'Expired',
    value: 3 as const,
    icon: Clock,
    color: 'warning' as const,
  },
  {
    label: 'Exhausted',
    value: 4 as const,
    icon: AlertCircle,
    color: 'secondary' as const,
  },
]
