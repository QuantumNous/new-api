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
import { nanoid } from 'nanoid'

import { safeJsonParse } from '../utils/json-parser'

/** 可视化分组定价表中的一行配置。 */
export type GroupPricingRow = {
  _id: string
  identifier: string
  committedIdentifier: string
  name: string
  ratio: string
  topupRatio: string
  selectable: boolean
  description: string
}

let groupPricingIdCounter = 0

/** 生成仅用于前端表格渲染的稳定行键。 */
export function createGroupPricingId(): string {
  groupPricingIdCounter += 1
  return `gpr_${groupPricingIdCounter}`
}

// 为新分组生成与显示名称无关的稳定标识。
export function createGroupIdentifier(): string {
  return `grp_${nanoid(12)}`
}

/** 将倍率输入归一化为可序列化的有限数值。 */
export function normalizeRatio(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 1
}

/** 解析一层分组倍率映射，非法 JSON 回退为空映射。 */
export function parseRatioMap(value: string): Record<string, number> {
  return safeJsonParse<Record<string, number>>(value, {
    fallback: {},
    silent: true,
  })
}

/** 解析一层分组字符串映射，非法 JSON 回退为空映射。 */
export function parseUsableMap(value: string): Record<string, string> {
  return safeJsonParse<Record<string, string>>(value, {
    fallback: {},
    silent: true,
  })
}

/** 汇总所有已配置分组的稳定标识。 */
export function getGroupIdentifiers(
  groupRatio: string,
  userUsableGroups: string,
  topupGroupRatio: string
): string[] {
  return [
    ...new Set([
      ...Object.keys(parseRatioMap(groupRatio)),
      ...Object.keys(parseUsableMap(userUsableGroups)),
      ...Object.keys(parseRatioMap(topupGroupRatio)),
    ]),
  ]
}

/** 将旧配置和新显示名称配置统一转换为表格行。 */
export function buildGroupPricingRows(
  groupRatio: string,
  groupDisplayNames: string,
  userUsableGroups: string,
  topupGroupRatio: string
): GroupPricingRow[] {
  const ratioMap = parseRatioMap(groupRatio)
  const displayNameMap = parseUsableMap(groupDisplayNames)
  const usableMap = parseUsableMap(userUsableGroups)
  const topupMap = parseRatioMap(topupGroupRatio)
  const identifiers = getGroupIdentifiers(
    groupRatio,
    userUsableGroups,
    topupGroupRatio
  )

  return identifiers.map((identifier) => ({
    _id: createGroupPricingId(),
    identifier,
    committedIdentifier: identifier,
    name: displayNameMap[identifier] || identifier,
    ratio: String(normalizeRatio(ratioMap[identifier])),
    topupRatio: Object.hasOwn(topupMap, identifier)
      ? String(topupMap[identifier])
      : '',
    selectable: Object.hasOwn(usableMap, identifier),
    description: String(usableMap[identifier] ?? ''),
  }))
}

/** 按稳定标识序列化，修改显示名称不会改变其他配置的键。 */
export function serializeGroupPricingRows(rows: GroupPricingRow[]): {
  GroupRatio: string
  GroupDisplayNames: string
  UserUsableGroups: string
  TopupGroupRatio: string
} {
  const groupRatio: Record<string, number> = {}
  const groupDisplayNames: Record<string, string> = {}
  const userUsableGroups: Record<string, string> = {}
  const topupGroupRatio: Record<string, number> = {}

  for (const row of rows) {
    const identifier = row.committedIdentifier.trim()
    if (!identifier) continue
    const displayName = row.name.trim()

    groupRatio[identifier] = normalizeRatio(row.ratio)
    if (displayName) {
      groupDisplayNames[identifier] = displayName
    }
    if (row.selectable) {
      userUsableGroups[identifier] = row.description
    }
    const topup = row.topupRatio.trim()
    if (topup !== '' && Number.isFinite(Number(topup))) {
      topupGroupRatio[identifier] = Number(topup)
    }
  }

  return {
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    GroupDisplayNames: JSON.stringify(groupDisplayNames, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
    TopupGroupRatio: JSON.stringify(topupGroupRatio, null, 2),
  }
}

/** 生成当前已提交分组行的内容签名，忽略尚未失焦的标识草稿。 */
export function groupPricingSignature(rows: GroupPricingRow[]): string {
  const serialized = serializeGroupPricingRows(rows)
  return sourceGroupPricingSignature(
    serialized.GroupRatio,
    serialized.GroupDisplayNames,
    serialized.UserUsableGroups,
    serialized.TopupGroupRatio
  )
}

/** 将分组配置字符串转换为可比较的内容签名。 */
export function sourceGroupPricingSignature(
  groupRatio: string,
  groupDisplayNames: string,
  userUsableGroups: string,
  topupGroupRatio: string
): string {
  return JSON.stringify({
    groupRatio: parseRatioMap(groupRatio),
    groupDisplayNames: parseUsableMap(groupDisplayNames),
    userUsableGroups: parseUsableMap(userUsableGroups),
    topupGroupRatio: parseRatioMap(topupGroupRatio),
  })
}

/** 可能引用分组标识的关联配置。 */
export type GroupIdentifierReferenceConfig = {
  GroupGroupRatio: string
  AutoGroups: string
  GroupSpecialUsableGroup: string
}

/** 修改新分组标识时，同步迁移其他分组配置中的关联引用。 */
export function renameGroupIdentifierReferences(
  config: GroupIdentifierReferenceConfig,
  previousIdentifier: string,
  nextIdentifier: string
): GroupIdentifierReferenceConfig {
  if (
    !previousIdentifier ||
    !nextIdentifier ||
    previousIdentifier === nextIdentifier
  ) {
    return config
  }

  const groupGroupRatio = safeJsonParse<Record<string, Record<string, number>>>(
    config.GroupGroupRatio,
    { fallback: {}, silent: true }
  )
  let groupGroupRatioChanged = false
  const renamedGroupGroupRatio: Record<string, Record<string, number>> = {}
  for (const [userGroup, targetRatios] of Object.entries(groupGroupRatio)) {
    const renamedUserGroup =
      userGroup === previousIdentifier ? nextIdentifier : userGroup
    if (renamedUserGroup !== userGroup) groupGroupRatioChanged = true

    const renamedTargetRatios: Record<string, number> = {}
    for (const [targetGroup, ratio] of Object.entries(targetRatios ?? {})) {
      const renamedTargetGroup =
        targetGroup === previousIdentifier ? nextIdentifier : targetGroup
      if (renamedTargetGroup !== targetGroup) groupGroupRatioChanged = true
      renamedTargetRatios[renamedTargetGroup] = ratio
    }
    renamedGroupGroupRatio[renamedUserGroup] = {
      ...renamedGroupGroupRatio[renamedUserGroup],
      ...renamedTargetRatios,
    }
  }

  const autoGroups = safeJsonParse<string[]>(config.AutoGroups, {
    fallback: [],
    silent: true,
  })
  const autoGroupsChanged = autoGroups.includes(previousIdentifier)
  const renamedAutoGroups: string[] = []
  const seenAutoGroups = new Set<string>()
  for (const identifier of autoGroups) {
    const renamedIdentifier =
      identifier === previousIdentifier ? nextIdentifier : identifier
    if (seenAutoGroups.has(renamedIdentifier)) continue
    seenAutoGroups.add(renamedIdentifier)
    renamedAutoGroups.push(renamedIdentifier)
  }

  const specialUsableGroups = safeJsonParse<
    Record<string, Record<string, string>>
  >(config.GroupSpecialUsableGroup, { fallback: {}, silent: true })
  let specialUsableGroupsChanged = false
  const renamedSpecialUsableGroups: Record<string, Record<string, string>> = {}
  for (const [userGroup, rules] of Object.entries(specialUsableGroups)) {
    const renamedUserGroup =
      userGroup === previousIdentifier ? nextIdentifier : userGroup
    if (renamedUserGroup !== userGroup) specialUsableGroupsChanged = true

    const renamedRules: Record<string, string> = {}
    for (const [rawTargetGroup, description] of Object.entries(rules ?? {})) {
      let prefix = ''
      let targetGroup = rawTargetGroup
      if (rawTargetGroup.startsWith('+:') || rawTargetGroup.startsWith('-:')) {
        prefix = rawTargetGroup.slice(0, 2)
        targetGroup = rawTargetGroup.slice(2)
      }
      const renamedTargetGroup =
        targetGroup === previousIdentifier ? nextIdentifier : targetGroup
      if (renamedTargetGroup !== targetGroup) specialUsableGroupsChanged = true
      renamedRules[`${prefix}${renamedTargetGroup}`] = description
    }
    renamedSpecialUsableGroups[renamedUserGroup] = {
      ...renamedSpecialUsableGroups[renamedUserGroup],
      ...renamedRules,
    }
  }

  return {
    GroupGroupRatio: groupGroupRatioChanged
      ? JSON.stringify(renamedGroupGroupRatio, null, 2)
      : config.GroupGroupRatio,
    AutoGroups: autoGroupsChanged
      ? JSON.stringify(renamedAutoGroups, null, 2)
      : config.AutoGroups,
    GroupSpecialUsableGroup: specialUsableGroupsChanged
      ? JSON.stringify(renamedSpecialUsableGroups, null, 2)
      : config.GroupSpecialUsableGroup,
  }
}
