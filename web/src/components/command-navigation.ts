/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import type { LinkProps } from '@tanstack/react-router'

import type { NavLink } from './layout/types'

export type CommandNavTarget = Pick<NavLink, 'url' | 'reloadDocument'>
export type CommandNavigate = (options: {
  to: LinkProps['to'] | (string & {})
}) => unknown

/**
 * Preserve the sidebar's navigation contract in the command palette.
 * Separate same-origin applications (for example /agent/*) must use a
 * document navigation so their own application shell can initialize.
 */
export function navigateCommandTarget(
  item: CommandNavTarget,
  navigate: CommandNavigate,
  reload: (url: string) => void = (url) => window.location.assign(url)
) {
  if (item.reloadDocument && typeof item.url === 'string') {
    reload(item.url)
    return
  }

  navigate({ to: item.url })
}
