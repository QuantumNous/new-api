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
import * as z from 'zod'

import type {
  ChannelMonitorPolicyAction,
  ChannelMonitorSmartScheduleApplyMode,
  ChannelMonitorSmartScheduleStrategy,
  ChannelMonitorUpstreamAuthType,
  ChannelMonitorUpstreamType,
} from '../types'

export const MAX_MONITOR_RATIO = 1_000_000
export const MAX_BALANCE_WARNING_THRESHOLD = 1_000_000_000_000
export const MAX_AUTO_UPDATE_INTERVAL_MINUTES = 525_600
export const MAX_AUTO_UPDATE_RETRY_COUNT = 10
export const MAX_SMART_SCHEDULE_MIN_SAMPLES = 100_000

const channelMonitorSmartScheduleApplyModes = [
  'weight',
  'priority_weight',
] as const satisfies readonly ChannelMonitorSmartScheduleApplyMode[]

const channelMonitorSmartScheduleStrategies = [
  'ratio',
  'first_token',
  'tps',
  'smart',
] as const satisfies readonly ChannelMonitorSmartScheduleStrategy[]

const channelMonitorPolicyActions = [
  'none',
  'update_group_ratio',
  'disable_channel',
] as const satisfies readonly ChannelMonitorPolicyAction[]

export function createChannelRatioSchema() {
  return z.object({
    ratio: z.coerce
      .number()
      .finite('倍率必须是有效数字')
      .min(0, '倍率不能小于 0')
      .max(MAX_MONITOR_RATIO, '倍率不能超过 1000000'),
    remark: z.string().max(255, '备注不能超过 255 个字符'),
  })
}

export function createGroupRatioSchema() {
  return z.object({
    ratio: z.coerce
      .number()
      .finite('倍率必须是有效数字')
      .min(0, '倍率不能小于 0')
      .max(MAX_MONITOR_RATIO, '倍率不能超过 1000000'),
  })
}

export function createChannelMonitorSettingsSchema() {
  return z
    .object({
      autoUpdateIntervalMinutes: z.coerce
        .number()
        .int('自动更新间隔必须是整数')
        .min(0, '自动更新间隔不能小于 0')
        .max(
          MAX_AUTO_UPDATE_INTERVAL_MINUTES,
          '自动更新间隔不能超过 525600 分钟'
        ),
      autoUpdateRetryCount: z.coerce
        .number()
        .int('失败重试次数必须是整数')
        .min(0, '失败重试次数不能小于 0')
        .max(MAX_AUTO_UPDATE_RETRY_COUNT, '失败重试次数不能超过 10 次'),
      emailNotificationEnabled: z.boolean(),
      notificationEmail: z
        .string()
        .trim()
        .max(254, '通知邮箱不能超过 254 个字符')
        .refine(
          (value) =>
            value === '' || z.string().email().safeParse(value).success,
          '请输入有效的通知邮箱'
        ),
      smartScheduleEnabled: z.boolean(),
      smartScheduleIntervalMinutes: z.coerce
        .number()
        .int('智能调度间隔必须是整数')
        .min(1, '智能调度间隔不能小于 1 分钟')
        .max(
          MAX_AUTO_UPDATE_INTERVAL_MINUTES,
          '智能调度间隔不能超过 525600 分钟'
        ),
      smartScheduleStrategy: z.enum(channelMonitorSmartScheduleStrategies),
      smartScheduleStabilityEnabled: z.boolean(),
      smartScheduleApplyMode: z.enum(channelMonitorSmartScheduleApplyModes),
      smartSchedulePerformanceMinutes: z.union([
        z.literal(15),
        z.literal(60),
        z.literal(360),
        z.literal(1440),
      ]),
      smartScheduleModel: z
        .string()
        .trim()
        .max(255, '基准模型不能超过 255 个字符'),
      smartScheduleMinSamples: z.coerce
        .number()
        .int('最少样本数必须是整数')
        .min(1, '最少样本数不能小于 1')
        .max(MAX_SMART_SCHEDULE_MIN_SAMPLES, '最少样本数不能超过 100000'),
      smartScheduleForceReset: z.boolean(),
    })
    .superRefine((values, context) => {
      if (values.emailNotificationEnabled && !values.notificationEmail) {
        context.addIssue({
          code: 'custom',
          path: ['notificationEmail'],
          message: '开启邮件通知时请填写通知邮箱',
        })
      }
    })
}

export function createChannelGroupsSchema() {
  return z.object({
    groups: z
      .array(
        z
          .string()
          .trim()
          .min(1, '分组名称不能为空')
          .max(64, '单个分组名称不能超过 64 个字符')
      )
      .min(1, '请至少选择一个关联分组')
      .refine(
        (groups) => groups.join(',').length <= 64,
        '关联分组名称合计不能超过 64 个字符'
      ),
  })
}

export function createGroupRatioSyncSchema(
  highestUpstreamRatio: number | null
) {
  return z
    .object({
      coefficient: z.coerce
        .number()
        .finite('系数必须是有效数字')
        .min(0, '系数不能小于 0')
        .max(MAX_MONITOR_RATIO, '系数不能超过 1000000'),
    })
    .superRefine((values, context) => {
      if (highestUpstreamRatio == null) return
      if (highestUpstreamRatio * values.coefficient > MAX_MONITOR_RATIO) {
        context.addIssue({
          code: 'custom',
          path: ['coefficient'],
          message: '上游倍率乘以系数后的结果不能超过 1000000',
        })
      }
    })
}

type SavedUpstreamCredential = {
  type: ChannelMonitorUpstreamType
  authType: ChannelMonitorUpstreamAuthType
  hasAccessToken: boolean
} | null

export function createUpstreamConfigSchema(
  savedCredential: SavedUpstreamCredential
) {
  return z
    .object({
      upstreamType: z.enum(['new_api', 'sub2api']),
      baseUrl: z
        .string()
        .trim()
        .min(1, '请输入面板地址')
        .max(2048, '面板地址过长')
        .url({ error: '请输入有效的面板地址' }),
      group: z.string().trim().max(64, '上游分组不能超过 64 个字符'),
      authType: z.enum(['public', 'user', 'api_key', 'token']),
      userId: z.coerce.number().int().min(0, '上游用户 ID 必须大于 0'),
      accessToken: z.string().trim().max(4096, '访问令牌过长'),
      singleChannelAction: z.enum(channelMonitorPolicyActions),
      multipleChannelsAction: z.enum(channelMonitorPolicyActions),
      ratioSyncEnabled: z.boolean(),
      balanceSyncEnabled: z.boolean(),
      balanceWarningThreshold: z
        .number()
        .finite('余额预警值必须是有效数字')
        .min(0, '余额预警值不能小于 0')
        .max(MAX_BALANCE_WARNING_THRESHOLD, '余额预警值不能超过 1000000000000')
        .nullable(),
    })
    .superRefine((values, context) => {
      const hasSavedCredential =
        savedCredential?.type === values.upstreamType &&
        savedCredential.authType === values.authType
      const hasSavedAccessToken =
        hasSavedCredential && savedCredential?.hasAccessToken === true
      if (values.upstreamType === 'new_api') {
        if (values.authType !== 'public' && values.authType !== 'user') {
          context.addIssue({
            code: 'custom',
            path: ['authType'],
            message: '请选择 New API 认证方式',
          })
          return
        }
        if (values.authType === 'public') return
        if (values.userId <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['userId'],
            message: '上游用户 ID 必须大于 0',
          })
        }
        if (!values.accessToken && !hasSavedAccessToken) {
          context.addIssue({
            code: 'custom',
            path: ['accessToken'],
            message: '请输入上游访问令牌',
          })
        }
        return
      }

      if (values.authType === 'api_key') return
      if (values.authType !== 'token') {
        context.addIssue({
          code: 'custom',
          path: ['authType'],
          message: '请选择 Sub2API 认证方式',
        })
        return
      }
      if (!values.accessToken && !hasSavedAccessToken) {
        context.addIssue({
          code: 'custom',
          path: ['accessToken'],
          message: '请输入 Sub2API Token（旧版访问令牌）',
        })
      }
    })
}

export type ChannelRatioFormValues = z.infer<
  ReturnType<typeof createChannelRatioSchema>
>

export type GroupRatioFormValues = z.infer<
  ReturnType<typeof createGroupRatioSchema>
>

export type ChannelMonitorSettingsFormValues = z.infer<
  ReturnType<typeof createChannelMonitorSettingsSchema>
>

export type ChannelGroupsFormValues = z.infer<
  ReturnType<typeof createChannelGroupsSchema>
>

export type GroupRatioSyncFormValues = z.infer<
  ReturnType<typeof createGroupRatioSyncSchema>
>

export type UpstreamConfigFormValues = z.infer<
  ReturnType<typeof createUpstreamConfigSchema>
>
