/**
 * Single source of truth for the console sidebar navigation.
 * Consumed by ConsoleSidebar (desktop) and ConsoleNavStrip (mobile).
 */

export interface ConsoleNavItem {
  name: string
  labelKey: string
  route?: string
  icon: string
  disabled?: boolean
  permission?: { resource: string; action: string }
  feature?: string
}

export interface ConsoleNavGroup {
  key: string
  labelKey: string
  access?: 'admin'
  items: ConsoleNavItem[]
}

export interface ConsoleNavAccessContext {
  isAdmin: boolean
  hasPermission?: (resource: string, action: string) => boolean
  featureStatus?: (feature: string) => 'live' | 'prototype' | 'disabled'
}

export const consoleNavGroups: ConsoleNavGroup[] = [
  {
    key: 'console',
    labelKey: 'nav.groupConsole',
    items: [
      {
        name: 'models',
        labelKey: 'nav.models',
        route: 'models',
        feature: 'user_models',
        icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
      },
      {
        name: 'market',
        labelKey: 'nav.market',
        route: 'market',
        feature: 'marketplace',
        icon: 'M3 9l1.5-5h15L21 9M3 9h18M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M9 21v-6h6v6',
      },
      {
        name: 'logs',
        labelKey: 'nav.logs',
        route: 'logs',
        feature: 'logs',
        icon: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM9 13h6M9 17h6',
      },
      {
        name: 'keys',
        labelKey: 'nav.keys',
        // Lucide "key-round" — fits within the 0..24 viewBox (the previous path
        // extended above y=0 and was clipped at the top).
        route: 'keys',
        feature: 'legacy_token',
        icon: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 0 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16.5 7.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z',
      },
      {
        name: 'tickets',
        labelKey: 'nav.tickets',
        route: 'tickets',
        feature: 'tickets',
        icon: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8ZM13 6v2m0 8v2m0-7v2',
      },
    ],
  },
  {
    key: 'account',
    labelKey: 'nav.groupAccount',
    items: [
      {
        name: 'wallet',
        labelKey: 'nav.wallet',
        route: 'wallet',
        feature: 'wallet',
        icon: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 10h18M8 15h4',
      },
      {
        name: 'invoice',
        labelKey: 'nav.invoice',
        route: 'invoice',
        feature: 'invoices',
        // Lucide "receipt": paper receipt with line items
        icon: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1ZM14 8H8M14 12H8M11 16H8',
      },
      {
        name: 'subscription',
        labelKey: 'nav.subscription',
        route: 'subscription',
        feature: 'subscription_balance',
        // Lucide "gem": faceted stone, reads as a tiered membership
        icon: 'M6 3h12l4 6-10 12L2 9l4-6ZM11 3 8 9l4 12M13 3l3 6-4 12M2 9h20',
      },
      {
        name: 'invite',
        labelKey: 'nav.invite',
        // Lucide "user-plus": plus sits clear to the right of the person
        // (was overlapping the head/shoulder in the previous path).
        route: 'invite',
        feature: 'invites',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 8v6M22 11h-6',
      },
    ],
  },
  {
    key: 'admin',
    labelKey: 'nav.groupAdmin',
    access: 'admin',
    items: [
      {
        name: 'channel-management',
        labelKey: 'nav.channelManagement',
        route: 'channels',
        feature: 'admin',
        permission: { resource: 'channel', action: 'read' },
        icon: 'M4 6h16M4 12h16M4 18h16M7 3v6M17 9v6M10 15v6',
      },
      {
        name: 'user-management',
        labelKey: 'nav.userManagement',
        route: 'users',
        feature: 'admin',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      },
      {
        name: 'redemption-management',
        labelKey: 'nav.redemptionManagement',
        route: 'redemption',
        feature: 'admin',
        icon: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8ZM13 6v2m0 8v2m0-7v2',
      },
      {
        name: 'plan-management',
        labelKey: 'nav.planManagement',
        route: 'plan-management',
        feature: 'admin',
        // Lucide "layers": stacked tiers, the catalogue behind the storefront
        icon: 'm12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5',
      },
      {
        name: 'order-management',
        labelKey: 'nav.orderManagement',
        route: 'orders',
        feature: 'orders',
        icon: 'M9 5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 12h6M9 16h6',
      },
    ],
  },
]

export const consoleNavTools: ConsoleNavItem[] = [
  {
    name: 'docs',
    labelKey: 'nav.docs',
    disabled: true,
    icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  },
]

function canAccessConsoleNavGroup(
  group: ConsoleNavGroup,
  context: ConsoleNavAccessContext
): boolean {
  return group.access !== 'admin' || context.isAdmin
}

export function getAccessibleConsoleNavGroups(
  context: ConsoleNavAccessContext
): ConsoleNavGroup[] {
  return consoleNavGroups.flatMap((group) => {
    if (!canAccessConsoleNavGroup(group, context)) return []
    const items = group.items.filter(
      (item) =>
        !item.permission ||
        context.hasPermission?.(
          item.permission.resource,
          item.permission.action
        ) === true
    )
    const resolvedItems = items.map((item) => ({
      ...item,
      disabled:
        item.disabled ||
        (item.feature !== undefined &&
          context.featureStatus?.(item.feature) === 'disabled'),
    }))
    return resolvedItems.length > 0 ? [{ ...group, items: resolvedItems }] : []
  })
}

/** Route metadata and visible navigation derive from the same access rule. */
export function getConsoleRouteAccessMeta(routeName: string): {
  requiresAdmin?: true
  requiresPermission?: { resource: string; action: string }
} {
  const group = consoleNavGroups.find((candidate) =>
    candidate.items.some((item) => item.route === routeName)
  )
  if (group?.access !== 'admin') return {}
  const item = group.items.find((candidate) => candidate.route === routeName)
  return {
    requiresAdmin: true,
    ...(item?.permission ? { requiresPermission: item.permission } : {}),
  }
}

/** Landing route when the topbar "控制台" button is clicked. */
export const consoleEntryRoute = 'keys'
