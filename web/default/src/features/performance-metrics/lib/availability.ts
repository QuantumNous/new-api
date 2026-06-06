/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { cn } from '@/lib/utils'

export type PerformanceAvailability = 'available' | 'unavailable' | 'unknown'

export type PerformanceAvailabilitySource = {
  availability?: PerformanceAvailability | null
  request_count?: number | null
  success_count?: number | null
  success_rate?: number | null
}

export function getPerformanceAvailability(
  source: PerformanceAvailabilitySource | undefined
): PerformanceAvailability {
  if (!source) return 'unknown'

  if (
    source.availability === 'available' ||
    source.availability === 'unavailable' ||
    source.availability === 'unknown'
  ) {
    return source.availability
  }

  const requestCount = Number(source.request_count)
  const successCount = Number(source.success_count)
  const successRate = Number(source.success_rate)

  if (
    Number.isFinite(requestCount) &&
    requestCount > 0 &&
    Number.isFinite(successCount)
  ) {
    return successCount > 0 ? 'available' : 'unavailable'
  }

  if (!Number.isFinite(successRate)) return 'unknown'
  return successRate > 0 ? 'available' : 'unavailable'
}

export function performanceAvailabilityTextClassName(
  availability: PerformanceAvailability
): string {
  switch (availability) {
    case 'available':
      return 'text-success'
    case 'unavailable':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

export function performanceAvailabilityDotClassName(
  availability: PerformanceAvailability
): string {
  switch (availability) {
    case 'available':
      return 'bg-success'
    case 'unavailable':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground'
  }
}

export function performanceAvailabilityIntent(
  availability: PerformanceAvailability
): 'default' | 'destructive' | 'success' {
  switch (availability) {
    case 'available':
      return 'success'
    case 'unavailable':
      return 'destructive'
    default:
      return 'default'
  }
}

export function performanceAvailabilityBarClassNames(
  availability: PerformanceAvailability
): [string, string, string] {
  const colorClass = performanceAvailabilityDotClassName(availability)
  const opacityClass = availability === 'unknown' ? 'opacity-40' : 'opacity-100'

  return [
    cn('h-2', colorClass, opacityClass),
    cn('h-2.5', colorClass, opacityClass),
    cn('h-3', colorClass, opacityClass),
  ]
}
