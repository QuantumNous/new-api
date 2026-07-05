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
import { SettingsSection } from '../types'
import { type TFunction } from 'i18next'
import { DollarSign } from 'lucide-react'
import { z } from 'zod'

export const COMMISSION_DEFAULT_SECTION = 'basic'

// 基础设置表单 schema
const basicSchema = z.object({
  CommissionEnabled: z.boolean(),
  CommissionMaxLevel: z.number().int().min(1).max(3),
  CommissionRealTimeSettleEnabled: z.boolean(),
})

// 防刷设置表单 schema
const antiSpamSchema = z.object({
  CommissionAntiSpamEnabled: z.boolean(),
  CommissionMaxDailyInvites: z.number().int().min(0),
  CommissionSameIPLimit: z.number().int().min(0),
  CommissionGlobalIPLimit: z.number().int().min(0),
})

export function getCommissionSectionContent(section: string) {
  switch (section) {
    case 'basic':
      return {
        title: '基础设置',
        description: '配置返佣功能的核心参数',
        schema: basicSchema,
        fields: [
          {
            key: 'CommissionEnabled',
            label: '启用消费返佣',
            type: 'switch' as const,
            description: '关闭后用户端隐藏返佣中心并停止计算消费返佣；原版邀请链接与注册奖励不受影响',
          },
          {
            key: 'CommissionMaxLevel',
            label: '返佣层级',
            type: 'segment' as const,
            options: [
              { label: '1级', value: 1, description: '仅直接邀请返佣（关闭多级功能）' },
              { label: '2级', value: 2, description: '开启二级返佣' },
              { label: '3级', value: 3, description: '开启三级返佣' },
            ],
            description: '1级=仅直接邀请返佣；2/3级=开启对应层级。各级比例在返佣规则中配置',
          },
          {
            key: 'CommissionRealTimeSettleEnabled',
            label: '实时结算',
            type: 'switch' as const,
            description: '关闭后返佣先记为待结算，由管理员手动结算',
          },
        ],
      }
    case 'anti-spam':
      return {
        title: '防刷设置',
        description: '配置防刷保护参数',
        schema: antiSpamSchema,
        fields: [
          {
            key: 'CommissionAntiSpamEnabled',
            label: '启用防刷保护',
            type: 'switch' as const,
            description: '开启后自动检测并拦截异常返佣请求',
          },
          {
            key: 'CommissionMaxDailyInvites',
            label: '每日邀请上限',
            type: 'number' as const,
            placeholder: '0',
            description: '每个用户每天最多邀请的人数（0=不限）',
          },
          {
            key: 'CommissionSameIPLimit',
            label: '同IP同邀请人上限',
            type: 'number' as const,
            placeholder: '5',
            description: '同一IP地址被同一邀请人邀请的账号数量上限',
          },
          {
            key: 'CommissionGlobalIPLimit',
            label: '同IP全局上限',
            type: 'number' as const,
            placeholder: '10',
            description: '同一IP地址所有邀请的账号总数上限（防环形绕过）',
          },
        ],
      }
    default:
      return null
  }
}

export function getCommissionSectionMeta(): SettingsSection[] {
  return [
    {
      id: 'basic',
      title: '基础设置',
      icon: 'Settings',
      description: '返佣功能核心配置',
    },
    {
      id: 'anti-spam',
      title: '防刷设置',
      icon: 'Shield',
      description: '防刷保护参数',
    },
  ]
}

export function getCommissionSectionNavItems(t: TFunction) {
  return [
    {
      title: t('基础设置'),
      to: '/system-settings/commission/$section',
      params: { section: 'basic' },
    },
    {
      title: t('防刷设置'),
      to: '/system-settings/commission/$section',
      params: { section: 'anti-spam' },
    },
  ]
}
