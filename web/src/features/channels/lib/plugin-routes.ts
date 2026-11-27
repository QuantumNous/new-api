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
import type { PluginRelayRoute } from '../api'
import { ADVANCED_CUSTOM_CONVERTER_OPTIONS } from './advanced-custom'

/** The label key of a route converter; a hooks chain names its converter. */
export function pluginRouteConverterLabel(converter?: string): string {
  const value = converter?.trim() ?? ''
  if (value === '' || value === 'none') return 'Native forwarding'
  if (value === 'plugin') return 'Converted by the plugin'
  const base = value.endsWith('+plugin')
    ? value.slice(0, -'+plugin'.length)
    : value
  return (
    ADVANCED_CUSTOM_CONVERTER_OPTIONS.find((option) => option.value === base)
      ?.label ?? base
  )
}

/**
 * The switches a channel keeps for its plugin's routes after one changes:
 * only those that differ from the route's default.
 */
export function nextPluginRouteToggles(
  routes: PluginRelayRoute[],
  toggles: Record<string, boolean>,
  key: string,
  on: boolean
): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const route of routes) {
    const value = route.key === key ? on : toggles[route.key]
    if (value !== undefined && value !== route.default_enabled) {
      next[route.key] = value
    }
  }
  return next
}
