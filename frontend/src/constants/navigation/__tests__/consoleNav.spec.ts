import { describe, expect, it } from 'vitest'

import { consoleNavGroups } from '@/constants/navigation/consoleNav'

describe('console navigation', () => {
  it('exposes the complete administration scaffold', () => {
    const adminGroup = consoleNavGroups.find((group) => group.key === 'admin')

    expect(adminGroup?.items.map((item) => item.name)).toEqual([
      'channel-management',
      'user-management',
      'redemption-management',
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
})
