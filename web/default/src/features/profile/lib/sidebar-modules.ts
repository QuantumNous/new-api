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
export type SidebarModuleConfig = {
  enabled: boolean
  [key: string]: boolean
}

export type SidebarModulesConfig = Record<string, SidebarModuleConfig>

export type SidebarSectionDef = {
  key: string
  title: string
  description: string
  modules: { key: string; title: string; description: string }[]
}

const parseAdminConfig = (
  adminConfigValue: string | null | undefined
): SidebarModulesConfig | null => {
  if (!adminConfigValue || adminConfigValue.trim() === '') return null

  try {
    const parsed = JSON.parse(adminConfigValue) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as SidebarModulesConfig
  } catch {
    return null
  }
}

/**
 * Limits the user's personal sidebar settings to modules still allowed by the
 * administrator-wide sidebar configuration.
 */
export function filterSidebarSectionDefsByAdminConfig(
  sections: SidebarSectionDef[],
  adminConfigValue: string | null | undefined
): SidebarSectionDef[] {
  const adminConfig = parseAdminConfig(adminConfigValue)
  if (!adminConfig) return sections

  return sections.flatMap((section) => {
    const adminSection = adminConfig[section.key]
    if (!adminSection) return [section]
    if (adminSection.enabled === false) return []

    const visibleModules = section.modules.filter(
      (module) => adminSection[module.key] !== false
    )
    if (visibleModules.length === 0) return []

    return [
      {
        ...section,
        modules: visibleModules,
      },
    ]
  })
}
