export type DashboardGreetingPeriod =
  'lateNight' | 'morning' | 'lunch' | 'afternoon' | 'evening'

interface DashboardGreetingUser {
  display_name?: string | null
  username?: string | null
}

export function getDashboardGreetingName(
  user: DashboardGreetingUser | null | undefined
): string {
  return user?.display_name?.trim() || user?.username?.trim() || ''
}

export function getDashboardGreetingPeriod(
  hour: number
): DashboardGreetingPeriod {
  if (hour < 5) return 'lateNight'
  if (hour < 11) return 'morning'
  if (hour < 14) return 'lunch'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
