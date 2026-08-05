import { describe, expect, it } from 'vitest'

import {
  consoleNavGroups,
  getAccessibleConsoleNavGroups,
  getConsoleRouteAccessMeta,
} from '@/constants/navigation/consoleNav'

describe('console navigation', () => {
  it('exposes the complete administration scaffold', () => {
    const adminGroup = consoleNavGroups.find((group) => group.key === 'admin')

    expect(adminGroup?.access).toBe('admin')

    expect(adminGroup?.items.map((item) => item.name)).toEqual([
      'channel-management',
      'user-management',
      'redemption-management',
      'plan-management',
      'order-management',
    ])
    expect(adminGroup?.items[0]).toEqual(
      expect.objectContaining({
        name: 'channel-management',
        route: 'channels',
      })
    )
    expect(adminGroup?.items[1]).toEqual(
      expect.objectContaining({
        name: 'user-management',
        route: 'users',
      })
    )
    expect(adminGroup?.items).toContainEqual(
      expect.objectContaining({
        name: 'plan-management',
        labelKey: 'nav.planManagement',
        route: 'plan-management',
      })
    )
    expect(adminGroup?.items).toContainEqual(
      expect.objectContaining({
        name: 'order-management',
        labelKey: 'nav.orderManagement',
        route: 'orders',
      })
    )

    // The real invariant: an item is live exactly when it has a route. Keying
    // off positions instead would break every time a page ships.
    adminGroup?.items.forEach((item) => {
      if (item.route) expect(item.disabled).toBeUndefined()
      else expect(item.disabled).toBe(true)
    })
  })

  it('hides every administrator entry from ordinary users', () => {
    const ordinaryGroups = getAccessibleConsoleNavGroups({ isAdmin: false })
    const adminGroups = getAccessibleConsoleNavGroups({
      isAdmin: true,
      hasPermission: () => true,
    })
    const restrictedAdminGroups = getAccessibleConsoleNavGroups({
      isAdmin: true,
      hasPermission: () => false,
    })

    expect(ordinaryGroups.some((group) => group.key === 'admin')).toBe(false)
    expect(adminGroups.some((group) => group.key === 'admin')).toBe(true)
    expect(
      restrictedAdminGroups
        .flatMap((group) => group.items)
        .some((item) => item.route === 'channels')
    ).toBe(false)
    expect(getConsoleRouteAccessMeta('channels')).toEqual({
      requiresAdmin: true,
      requiresPermission: { resource: 'channel', action: 'read' },
    })
    expect(getConsoleRouteAccessMeta('models')).toEqual({})
  })

  it('exposes the subscription storefront in the account group', () => {
    const accountGroup = consoleNavGroups.find(
      (group) => group.key === 'account'
    )

    expect(accountGroup?.items).toContainEqual(
      expect.objectContaining({
        name: 'subscription',
        labelKey: 'nav.subscription',
        route: 'subscription',
      })
    )
  })

  it('keeps every route name unique across the whole navigation', () => {
    // Two entries sharing a route would make the active-item lookup in the
    // sidebar and the command palette resolve to whichever came first.
    const routes = consoleNavGroups
      .flatMap((group) => group.items)
      .flatMap((item) => (item.route ? [item.route] : []))

    expect(new Set(routes).size).toBe(routes.length)
  })
})
