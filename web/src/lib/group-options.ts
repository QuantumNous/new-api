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
/** 后端返回的用户可用分组信息。 */
export type UserGroupInfo<TRatio = number | string> = {
  name?: string
  desc?: string
  ratio: TRatio
}

/** 保持稳定提交值并提供独立展示名称的分组选项。 */
export type GroupDisplayOption<TRatio = number | string> = {
  value: string
  label: string
  desc?: string
  ratio: TRatio
}

/** 将后端分组响应转换为保持稳定标识的展示选项。 */
export function buildGroupOptions<TRatio>(
  groups: Record<string, UserGroupInfo<TRatio>>
): GroupDisplayOption<TRatio>[] {
  return Object.entries(groups).map(([identifier, info]) => {
    const name = info.name?.trim() || identifier
    const description = info.desc?.trim()
    const secondary = [name === identifier ? '' : identifier, description]
      .filter(Boolean)
      .join(' - ')

    return {
      value: identifier,
      label: name,
      desc: secondary || undefined,
      ratio: info.ratio,
    }
  })
}
