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
import { CHANNEL_MONITOR_SUBSCRIPTION_DAYS } from './cost-conversion'

export const MAX_MONITOR_RATIO = 1_000_000
export const MAX_BALANCE_THRESHOLD = 1_000_000_000_000
export const MAX_COST_CONVERSION_AMOUNT = 1_000_000_000_000
export const MAX_CUSTOM_UPSTREAM_BALANCE = 1_000_000_000_000_000
export const MAX_CUSTOM_UPSTREAM_ENTRIES = 32
export const MAX_CUSTOM_UPSTREAM_BODY_BYTES = 49_152
export const MAX_AUTO_UPDATE_INTERVAL_MINUTES = 525_600
export const MAX_AUTO_UPDATE_RETRY_COUNT = 10
export const MAX_SMART_SCHEDULE_MIN_SAMPLES = 100_000
export const MAX_SMART_SCHEDULE_MODEL_COUNT = 100

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
  'remove_from_group',
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
      autoDisableOnUpdateFailure: z.boolean(),
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
      smartScheduleModels: z
        .array(
          z
            .string()
            .trim()
            .min(1, '基准模型不能为空')
            .max(255, '基准模型不能超过 255 个字符')
        )
        .max(MAX_SMART_SCHEDULE_MODEL_COUNT, '基准模型不能超过 100 个'),
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

export function createGroupRatioSyncSchema(highestCostRatio: number | null) {
  return z
    .object({
      coefficient: z.coerce
        .number()
        .finite('系数必须是有效数字')
        .min(0, '系数不能小于 0')
        .max(MAX_MONITOR_RATIO, '系数不能超过 1000000'),
    })
    .superRefine((values, context) => {
      if (highestCostRatio == null) return
      if (highestCostRatio * values.coefficient > MAX_MONITOR_RATIO) {
        context.addIssue({
          code: 'custom',
          path: ['coefficient'],
          message: '成本倍率乘以系数后的结果不能超过 1000000',
        })
      }
    })
}

type SavedUpstreamCredential = {
  type: ChannelMonitorUpstreamType
  baseUrl: string
  authType: ChannelMonitorUpstreamAuthType
  hasAccessToken: boolean
  account: string
  hasPassword: boolean
} | null

const customKeyValueSchema = z.object({
  key: z.string().trim().max(256, '名称不能超过 256 个字符'),
  value: z.string().max(8192, '值不能超过 8192 个字符'),
  secret: z.boolean(),
  hasValue: z.boolean(),
})

const customRequestSchema = z.object({
  method: z.enum(['GET', 'POST']),
  path: z.string().trim().max(2048, '接口路径不能超过 2048 个字符'),
  query: z
    .array(customKeyValueSchema)
    .max(MAX_CUSTOM_UPSTREAM_ENTRIES, '查询参数不能超过 32 项'),
  headers: z
    .array(customKeyValueSchema)
    .max(MAX_CUSTOM_UPSTREAM_ENTRIES, '请求头不能超过 32 项'),
  bodyType: z.enum(['none', 'json', 'form']),
  body: z
    .string()
    .max(MAX_CUSTOM_UPSTREAM_BODY_BYTES, 'JSON 请求体不能超过 49152 字节'),
  bodySecret: z.boolean(),
  hasBody: z.boolean(),
  form: z
    .array(customKeyValueSchema)
    .max(MAX_CUSTOM_UPSTREAM_ENTRIES, '表单参数不能超过 32 项'),
})

const customResultSchema = z.object({
  responseType: z.enum(['json', 'text']),
  valuePath: z.string().trim().max(512, 'JSON 取值路径不能超过 512 个字符'),
  multiplier: z.coerce
    .number()
    .finite('结果乘数必须是有效数字')
    .min(0, '结果乘数不能小于 0')
    .max(MAX_MONITOR_RATIO, '结果乘数不能超过 1000000'),
})

const customMetricSchema = z.object({
  source: z.enum(['fixed', 'http']),
  fixedValue: z.coerce.number().finite('固定值必须是有效数字'),
  request: customRequestSchema,
  result: customResultSchema,
})

const customUpstreamConfigSchema = z.object({
  version: z.literal(1),
  ratio: customMetricSchema,
  balance: customMetricSchema,
  balanceReuseRatioRequest: z.boolean(),
})

type CustomMetricFormValue = z.infer<typeof customMetricSchema>

function validateCustomEntries(
  entries: z.infer<typeof customKeyValueSchema>[],
  path: (string | number)[],
  label: string,
  context: z.RefinementCtx
) {
  const keys = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    const key = entry.key.trim()
    if (!key) {
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'key'],
        message: `${label}名称不能为空`,
      })
      continue
    }
    const normalizedKey = key.toLowerCase()
    if (keys.has(normalizedKey)) {
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'key'],
        message: `${label}名称不能重复`,
      })
    }
    keys.add(normalizedKey)
    if (entry.secret && !entry.value && !entry.hasValue) {
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'value'],
        message: `敏感${label}的值不能为空`,
      })
    }
  }
}

function validateCustomMetric(
  metric: CustomMetricFormValue,
  metricName: 'ratio' | 'balance',
  reuseRequest: boolean,
  context: z.RefinementCtx
) {
  const pathPrefix = ['customConfig', metricName]
  if (metric.source === 'fixed') {
    if (metricName === 'ratio') {
      if (metric.fixedValue < 0 || metric.fixedValue > MAX_MONITOR_RATIO) {
        context.addIssue({
          code: 'custom',
          path: [...pathPrefix, 'fixedValue'],
          message: '固定倍率必须在 0 到 1000000 之间',
        })
      }
    } else if (Math.abs(metric.fixedValue) > MAX_CUSTOM_UPSTREAM_BALANCE) {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'fixedValue'],
        message: '固定余额绝对值不能超过 1000000000000000',
      })
    }
    return
  }

  if (!reuseRequest) {
    if (!metric.request.path.trim()) {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'request', 'path'],
        message: '请输入接口路径',
      })
    }
    let decodedPath = metric.request.path
    try {
      decodedPath = decodeURIComponent(metric.request.path)
    } catch {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'request', 'path'],
        message: '接口路径格式无效',
      })
    }
    if (
      decodedPath.includes('?') ||
      decodedPath.includes('#') ||
      /^https?:\/\//i.test(metric.request.path)
    ) {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'request', 'path'],
        message: '接口路径请填写不含查询参数的相对路径',
      })
    }
    if (metric.request.method === 'GET' && metric.request.bodyType !== 'none') {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, 'request', 'bodyType'],
        message: 'GET 请求不能配置请求体',
      })
    }
    validateCustomEntries(
      metric.request.query,
      [...pathPrefix, 'request', 'query'],
      '查询参数',
      context
    )
    validateCustomEntries(
      metric.request.headers,
      [...pathPrefix, 'request', 'headers'],
      '请求头',
      context
    )
    if (metric.request.bodyType === 'json') {
      const preservesSavedBody =
        metric.request.bodySecret && metric.request.hasBody
      if (!metric.request.body && !preservesSavedBody) {
        context.addIssue({
          code: 'custom',
          path: [...pathPrefix, 'request', 'body'],
          message: 'JSON 请求体不能为空',
        })
      } else if (metric.request.body) {
        try {
          JSON.parse(metric.request.body)
        } catch {
          context.addIssue({
            code: 'custom',
            path: [...pathPrefix, 'request', 'body'],
            message: 'JSON 请求体格式无效',
          })
        }
      }
    }
    if (metric.request.bodyType === 'form') {
      validateCustomEntries(
        metric.request.form,
        [...pathPrefix, 'request', 'form'],
        '表单参数',
        context
      )
    }
  }

  if (
    metric.result.responseType === 'json' &&
    !metric.result.valuePath.trim()
  ) {
    context.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'result', 'valuePath'],
      message: '请输入 JSON 取值路径',
    })
  }
  if (metric.result.multiplier <= 0) {
    context.addIssue({
      code: 'custom',
      path: [...pathPrefix, 'result', 'multiplier'],
      message: '结果乘数必须大于 0',
    })
  }
}

export function createUpstreamConfigSchema(
  savedCredential: SavedUpstreamCredential
) {
  return z
    .object({
      upstreamType: z.enum(['new_api', 'sub2api', 'custom']),
      baseUrl: z
        .string()
        .trim()
        .min(1, '请输入上游地址')
        .max(2048, '上游地址过长')
        .url({ error: '请输入有效的上游地址' }),
      group: z.string().trim().max(64, '上游分组不能超过 64 个字符'),
      authType: z.enum([
        'public',
        'user',
        'api_key',
        'account',
        'token',
        'custom',
      ]),
      userId: z.coerce.number().int().min(0, '上游用户 ID 必须大于 0'),
      accessToken: z.string().trim().max(4096, '访问令牌过长'),
      account: z
        .string()
        .trim()
        .max(320, 'Sub2API 登录邮箱过长')
        .email('请输入有效的 Sub2API 登录邮箱')
        .or(z.literal('')),
      password: z.string().max(4096, 'Sub2API 登录密码过长'),
      singleChannelAction: z.enum(channelMonitorPolicyActions),
      multipleChannelsAction: z.enum(channelMonitorPolicyActions),
      ratioSyncEnabled: z.boolean(),
      balanceSyncEnabled: z.boolean(),
      balanceWarningThreshold: z
        .number()
        .finite('余额预警值必须是有效数字')
        .min(0, '余额预警值不能小于 0')
        .max(MAX_BALANCE_THRESHOLD, '余额预警值不能超过 1000000000000')
        .nullable(),
      balanceAutoDisableThreshold: z
        .number()
        .finite('余额自动禁用阈值必须是有效数字')
        .min(0, '余额自动禁用阈值不能小于 0')
        .max(MAX_BALANCE_THRESHOLD, '余额自动禁用阈值不能超过 1000000000000')
        .nullable(),
      costConversionMode: z.enum(['none', 'recharge', 'subscription']),
      rechargePaidCny: z.coerce
        .number()
        .finite('实付人民币金额必须是有效数字')
        .min(0, '实付人民币金额不能小于 0')
        .max(
          MAX_COST_CONVERSION_AMOUNT,
          '实付人民币金额不能超过 1000000000000'
        ),
      rechargeCreditedUsd: z.coerce
        .number()
        .finite('到账美元额度必须是有效数字')
        .min(0, '到账美元额度不能小于 0')
        .max(MAX_COST_CONVERSION_AMOUNT, '到账美元额度不能超过 1000000000000'),
      subscriptionPeriod: z.enum(['day', 'week', 'month']),
      subscriptionPriceCny: z.coerce
        .number()
        .finite('订阅价格必须是有效数字')
        .min(0, '订阅价格不能小于 0')
        .max(MAX_COST_CONVERSION_AMOUNT, '订阅价格不能超过 1000000000000'),
      subscriptionDailyUsd: z.coerce
        .number()
        .finite('每日美元额度必须是有效数字')
        .min(0, '每日美元额度不能小于 0')
        .max(MAX_COST_CONVERSION_AMOUNT, '每日美元额度不能超过 1000000000000'),
      customConfig: customUpstreamConfigSchema,
    })
    .superRefine((values, context) => {
      if (values.costConversionMode === 'recharge') {
        if (values.rechargePaidCny <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['rechargePaidCny'],
            message: '实付人民币金额必须大于 0',
          })
        }
        if (values.rechargeCreditedUsd <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['rechargeCreditedUsd'],
            message: '到账美元额度必须大于 0',
          })
        }
        const factor = values.rechargePaidCny / values.rechargeCreditedUsd
        if (Number.isFinite(factor) && factor > MAX_MONITOR_RATIO) {
          context.addIssue({
            code: 'custom',
            path: ['rechargePaidCny'],
            message: '倍率换算系数不能超过 1000000',
          })
        }
      }
      if (values.costConversionMode === 'subscription') {
        if (values.subscriptionPriceCny <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['subscriptionPriceCny'],
            message: '订阅价格必须大于 0',
          })
        }
        if (values.subscriptionDailyUsd <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['subscriptionDailyUsd'],
            message: '每日美元额度必须大于 0',
          })
        }
        const factor =
          values.subscriptionPriceCny /
          (values.subscriptionDailyUsd *
            CHANNEL_MONITOR_SUBSCRIPTION_DAYS[values.subscriptionPeriod])
        if (Number.isFinite(factor) && factor > MAX_MONITOR_RATIO) {
          context.addIssue({
            code: 'custom',
            path: ['subscriptionPriceCny'],
            message: '倍率换算系数不能超过 1000000',
          })
        }
      }
      if (values.upstreamType === 'custom') {
        if (values.authType !== 'custom') {
          context.addIssue({
            code: 'custom',
            path: ['authType'],
            message: '自定义上游认证方式无效',
          })
        }
        if (
          values.customConfig.balanceReuseRatioRequest &&
          (values.customConfig.ratio.source !== 'http' ||
            values.customConfig.balance.source !== 'http')
        ) {
          context.addIssue({
            code: 'custom',
            path: ['customConfig', 'balanceReuseRatioRequest'],
            message: '只有倍率和余额都使用接口查询时才能复用倍率接口',
          })
        }
        validateCustomMetric(values.customConfig.ratio, 'ratio', false, context)
        validateCustomMetric(
          values.customConfig.balance,
          'balance',
          values.customConfig.balanceReuseRatioRequest,
          context
        )
        return
      }
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
      if (values.authType === 'account') {
        if (!values.account) {
          context.addIssue({
            code: 'custom',
            path: ['account'],
            message: '请输入 Sub2API 登录邮箱',
          })
        }
        const hasSavedPassword =
          hasSavedCredential &&
          savedCredential?.hasPassword === true &&
          savedCredential.baseUrl === values.baseUrl &&
          savedCredential.account === values.account
        if (!values.password && !hasSavedPassword) {
          context.addIssue({
            code: 'custom',
            path: ['password'],
            message: '请输入 Sub2API 登录密码',
          })
        }
        return
      }
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
