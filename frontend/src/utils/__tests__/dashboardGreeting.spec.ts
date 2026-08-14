import { describe, expect, it } from 'vitest'

import {
  getDashboardGreetingName,
  getDashboardGreetingPeriod,
} from '@/utils/dashboardGreeting'

describe('getDashboardGreetingPeriod', () => {
  it.each([
    [0, 'lateNight'],
    [4, 'lateNight'],
    [5, 'morning'],
    [10, 'morning'],
    [11, 'lunch'],
    [13, 'lunch'],
    [14, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
  ] as const)('maps hour %i to %s', (hour, period) => {
    expect(getDashboardGreetingPeriod(hour)).toBe(period)
  })

  it.each([
    [{ display_name: ' Display Name ', username: 'username' }, 'Display Name'],
    [{ display_name: '  ', username: ' username ' }, 'username'],
    [{ display_name: '', username: '' }, ''],
    [undefined, ''],
  ])('resolves the dashboard name from %j', (user, expected) => {
    expect(getDashboardGreetingName(user)).toBe(expected)
  })
})
