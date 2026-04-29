import { Activity, Store, type LucideIcon } from 'lucide-react'

type CustomSidebarLink = {
  titleKey: string
  url: string
  icon: LucideIcon
  newTab?: boolean
}

type CustomTopNavLink = {
  titleKey: string
  href: string
  external?: boolean
  moduleKey?: keyof typeof customHeaderNavModuleDefaults
}

export const customSidebarLinks: CustomSidebarLink[] = [
  {
    titleKey: 'Model Square',
    url: '/pricing',
    icon: Store,
    newTab: true,
  },
  {
    titleKey: 'Status Monitor',
    url: 'https://status.tcp.red',
    icon: Activity,
    newTab: true,
  },
]

export const customTopNavLinks: CustomTopNavLink[] = [
  {
    titleKey: 'Status Monitor',
    href: 'https://status.tcp.red',
    external: true,
    moduleKey: 'statusMonitor',
  },
]

export const customHeaderNavModuleDefaults = {
  statusMonitor: true,
}

export function formatCustomPaymentAmount(amount: number | string): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  const safeAmount = Number.isFinite(numeric) ? numeric : 0

  return `¥${safeAmount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}
