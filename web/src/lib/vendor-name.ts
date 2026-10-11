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

import type { TFunction } from 'i18next'

// Only exact, recognized brand aliases are localized; custom names are preserved.
const brands = [
  { key: 'Baidu', aliases: ['Baidu', '百度'] },
  { key: 'Alibaba', aliases: ['Alibaba', '阿里巴巴'] },
  { key: 'Tencent', aliases: ['Tencent', '腾讯', '騰訊'] },
  { key: 'Zhipu', aliases: ['Zhipu', '智谱', '智譜', 'Zhipu AI'] },
  { key: '01.AI', aliases: ['01.AI', '零一万物', '零一萬物', 'LingYiWanWu'] },
  { key: 'Moonshot', aliases: ['Moonshot', 'Moonshot AI', '月之暗面'] },
] as const

export function getVendorDisplayName(name: string, t: TFunction): string {
  const brand = brands.find((item) =>
    item.aliases.some(
      (alias) => alias.toLowerCase() === name.trim().toLowerCase()
    )
  )
  return brand ? t(brand.key, { defaultValue: brand.key }) : name
}

export function matchesVendorName(
  name: string,
  query: string,
  t?: TFunction
): boolean {
  const search = query.toLowerCase()
  const brand = brands.find((item) =>
    item.aliases.some(
      (alias) => alias.toLowerCase() === name.trim().toLowerCase()
    )
  )
  return (
    name.toLowerCase().includes(search) ||
    !!brand?.aliases.some((alias) => alias.toLowerCase().includes(search)) ||
    !!(t && getVendorDisplayName(name, t).toLowerCase().includes(search))
  )
}
