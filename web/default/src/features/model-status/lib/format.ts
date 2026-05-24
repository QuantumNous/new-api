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
import dayjs from '@/lib/dayjs'
import type { ModelStatusHealth } from '../types'

export function formatPercent(value: number) {
  const normalized = value > 1 ? value / 100 : value
  return `${(normalized * 100).toFixed(normalized >= 0.995 ? 0 : 1)}%`
}

export function formatLatency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value)}ms`
}

export function formatRelativeTime(timestamp: number) {
  if (!timestamp) return '暂无更新'
  return dayjs.unix(timestamp).fromNow()
}

export function formatAbsoluteTime(timestamp: number) {
  if (!timestamp) return '暂无时间'
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

export function healthText(health: ModelStatusHealth) {
  if (health === 'up') return '正常'
  if (health === 'degraded') return '波动'
  if (health === 'down') return '不可用'
  return '未知'
}

export function healthDescription(health: ModelStatusHealth) {
  if (health === 'up') return '全部模型运行正常'
  if (health === 'degraded') return '部分模型出现波动'
  if (health === 'down') return '部分模型当前不可用'
  return '暂无状态数据'
}
