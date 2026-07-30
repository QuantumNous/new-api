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
import type { TopNavLink } from '../types'

/**
 * Default public navigation links.
 *
 * Priority: Backend HeaderNavModules (via useTopNavLinks) > provided navLinks >
 * these defaults. Keep titles as English i18n source keys.
 */
export const defaultTopNavLinks: TopNavLink[] = [
  { title: 'Home', href: '/' },
  { title: 'Workspace', href: '/playground' },
  { title: 'Agents', href: '/agents' },
  { title: 'Connect', href: '/connect' },
  { title: 'Inspiration', href: '/inspiration' },
  { title: 'Model Hub', href: '/pricing' },
  { title: 'Rankings', href: '/rankings' },
]
