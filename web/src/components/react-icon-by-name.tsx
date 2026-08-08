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
import { LuCreditCard } from 'react-icons/lu'
import {
  SiAlipay,
  SiDiscord,
  SiGithub,
  SiLinux,
  SiStripe,
  SiWechat,
} from 'react-icons/si'
import type { IconBaseProps, IconType } from 'react-icons'

/**
 * Static icon map: replaces the previous dynamic `import('react-icons/xxx')`
 * loaders. Each icon is statically imported so tree-shaking keeps only the
 * icons actually used instead of bundling full icon packs per pack.
 *
 * Add a new icon here when a new icon name is introduced; unknown names
 * render nothing (same as the previous unresolved-name behavior).
 */
const ICON_MAP: Record<string, IconType> = {
  SiAlipay,
  SiDiscord,
  SiGithub,
  SiLinux,
  SiStripe,
  SiWechat,
  LuCreditCard,
}

function normalizeIconName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed || !/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return null
  return trimmed
}

type ReactIconByNameProps = IconBaseProps & {
  name?: string | null
}

export function ReactIconByName({ name, ...props }: ReactIconByNameProps) {
  const iconName = normalizeIconName(name)
  if (!iconName) return null

  const Icon = ICON_MAP[iconName]
  if (!Icon) return null

  return <Icon {...props} />
}