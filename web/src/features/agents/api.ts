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
import { z } from 'zod'

import { usageLogSchema } from '@/features/usage-logs/data/schema'
import { api, type ApiRequestConfig } from '@/lib/api'

import {
  adminAgentRefundRequestSchema,
  adminAgentSchema,
  agentCodeSchema,
  agentCodeStatusSchema,
  agentCreditAdjustmentRequestSchema,
  agentCreditAdjustmentResponseSchema,
  agentCreditLogSchema,
  agentCustomerLogStatsSchema,
  agentCustomerSchema,
  agentDailyLimitRequestSchema,
  agentOfferSchema,
  agentOfferUpsertRequestSchema,
  agentOrderSchema,
  agentOrderStatusSchema,
  agentOverviewSchema,
  agentPageSchema,
  agentPurchaseRequestSchema,
  agentPurchaseResponseSchema,
  agentPromotionSchema,
  agentReconciliationSchema,
  agentRefundRequestSchema,
  agentRefundResponseSchema,
  apiResponseSchema,
  typedRedemptionRequestSchema,
  typedRedemptionSchema,
  type AdminAgent,
  type AdminAgentParams,
  type AdminAgentRefundRequest,
  type AgentCode,
  type AgentCodeParams,
  type AgentCreditAdjustmentRequest,
  type AgentCreditAdjustmentResponse,
  type AgentCreditLog,
  type AgentCreditLogParams,
  type AgentCustomer,
  type AgentCustomerLog,
  type AgentCustomerLogParams,
  type AgentCustomerLogStats,
  type AgentCustomerParams,
  type AgentDailyLimitRequest,
  type AgentOffer,
  type AgentOfferUpsertRequest,
  type AgentOrder,
  type AgentOrderParams,
  type AgentOverview,
  type AgentPage,
  type AgentPurchaseRequest,
  type AgentPurchaseResponse,
  type AgentPromotion,
  type AgentReconciliation,
  type AgentRefundRequest,
  type AgentRefundResponse,
  type ApiResult,
  type TypedRedemption,
  type TypedRedemptionRequest,
} from './types'

const positiveIDSchema = z.number().int().positive()
const agentOverviewResponseSchema = apiResponseSchema(agentOverviewSchema)
const agentOffersResponseSchema = apiResponseSchema(z.array(agentOfferSchema))
const agentPurchaseEnvelopeSchema = apiResponseSchema(
  agentPurchaseResponseSchema
)
const agentOrdersResponseSchema = apiResponseSchema(
  agentPageSchema(agentOrderSchema)
)
const agentCodesResponseSchema = apiResponseSchema(
  agentPageSchema(agentCodeSchema)
)
const agentCreditLogsResponseSchema = apiResponseSchema(
  agentPageSchema(agentCreditLogSchema)
)
const agentPromotionResponseSchema = apiResponseSchema(agentPromotionSchema)
const agentCustomersResponseSchema = apiResponseSchema(
  agentPageSchema(agentCustomerSchema)
)
const agentCustomerLogsResponseSchema = apiResponseSchema(
  agentPageSchema(usageLogSchema)
)
const agentCustomerLogStatsResponseSchema = apiResponseSchema(
  agentCustomerLogStatsSchema
)
const agentRefundEnvelopeSchema = apiResponseSchema(agentRefundResponseSchema)
const adminAgentsResponseSchema = apiResponseSchema(
  agentPageSchema(adminAgentSchema)
)
const adminAgentResponseSchema = apiResponseSchema(adminAgentSchema)
const agentOfferResponseSchema = apiResponseSchema(agentOfferSchema)
const agentReconciliationResponseSchema = apiResponseSchema(
  agentReconciliationSchema
)
const agentCreditAdjustmentEnvelopeSchema = apiResponseSchema(
  agentCreditAdjustmentResponseSchema
)
const typedRedemptionResponseSchema = apiResponseSchema(typedRedemptionSchema)
const csvResponseSchema = z
  .object({
    blob: z.instanceof(Blob),
    contentType: z.string().refine((value) => value.startsWith('text/csv')),
  })
  .strict()
const fallbackAgentExportFilename = 'agent-codes.csv'

function safeAgentExportFilename(value: string): string | null {
  const filename = value.trim()
  const hasControlCharacter = [...filename].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
  if (
    filename.length === 0 ||
    filename.length > 180 ||
    filename.startsWith('.') ||
    !filename.toLowerCase().endsWith('.csv') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    hasControlCharacter
  ) {
    return null
  }
  return filename
}

export function parseAgentExportFilename(contentDisposition: unknown): string {
  if (typeof contentDisposition !== 'string') {
    return fallbackAgentExportFilename
  }

  const encoded = /(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i.exec(
    contentDisposition
  )
  if (encoded) {
    try {
      const decoded = decodeURIComponent(encoded[1].trim())
      const safe = safeAgentExportFilename(decoded)
      if (safe) return safe
    } catch {
      return fallbackAgentExportFilename
    }
  }

  const basic = /(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(
    contentDisposition
  )
  const safe = safeAgentExportFilename((basic?.[1] ?? basic?.[2] ?? '').trim())
  return safe ?? fallbackAgentExportFilename
}

const pageFilterFields = {
  p: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(100).optional(),
  start_timestamp: z.number().int().nonnegative().optional(),
  end_timestamp: z.number().int().nonnegative().optional(),
}
const selfOrderParamsSchema = z
  .object({
    ...pageFilterFields,
    plan_id: positiveIDSchema.optional(),
    status: agentOrderStatusSchema.optional(),
  })
  .strict()
const adminOrderParamsSchema = selfOrderParamsSchema.extend({
  agent_user_id: positiveIDSchema.optional(),
})
const selfCodeParamsSchema = z
  .object({
    ...pageFilterFields,
    plan_id: positiveIDSchema.optional(),
    order_id: positiveIDSchema.optional(),
    status: agentCodeStatusSchema.optional(),
  })
  .strict()
const adminCodeParamsSchema = selfCodeParamsSchema.extend({
  agent_user_id: positiveIDSchema.optional(),
})
const selfExportCodeParamsSchema = selfCodeParamsSchema.omit({
  p: true,
  page_size: true,
})
const selfCustomerParamsSchema = z
  .object({
    p: pageFilterFields.p,
    page_size: pageFilterFields.page_size,
    keyword: z.string().optional(),
    sort_by: z
      .enum(['status', 'remaining_quota', 'subscription_end_time', 'bound_at'])
      .optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  })
  .strict()
const selfCustomerLogParamsSchema = z
  .object({
    ...pageFilterFields,
    user_id: positiveIDSchema.optional(),
    username: z.string().optional(),
    type: z.number().int().min(0).max(7).optional(),
    model_name: z.string().optional(),
    token_name: z.string().optional(),
    group: z.string().optional(),
  })
  .strict()

type SelfOrderParams = z.infer<typeof selfOrderParamsSchema>
type SelfCodeParams = z.infer<typeof selfCodeParamsSchema>
type SelfExportCodeParams = z.infer<typeof selfExportCodeParamsSchema>
type SelfCustomerParams = z.infer<typeof selfCustomerParamsSchema>
type SelfCustomerLogParams = z.infer<typeof selfCustomerLogParamsSchema>

function selfOrderParams(
  params: Omit<AgentOrderParams, 'agent_user_id'>
): SelfOrderParams {
  return selfOrderParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    status: params.status,
  })
}

function selfCodeParams(
  params: Omit<AgentCodeParams, 'agent_user_id'>
): SelfCodeParams {
  return selfCodeParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    order_id: params.order_id,
    status: params.status,
  })
}

function selfExportCodeParams(
  params: Omit<AgentCodeParams, 'agent_user_id' | 'p' | 'page_size'>
): SelfExportCodeParams {
  return selfExportCodeParamsSchema.parse({
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
    plan_id: params.plan_id,
    order_id: params.order_id,
    status: params.status,
  })
}

function selfCustomerParams(params: AgentCustomerParams): SelfCustomerParams {
  return selfCustomerParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    keyword: params.keyword,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  })
}

function selfCustomerLogParams(
  params: AgentCustomerLogParams
): SelfCustomerLogParams {
  return selfCustomerLogParamsSchema.parse({
    p: params.p,
    page_size: params.page_size,
    user_id: params.user_id,
    username: params.username,
    type: params.type,
    model_name: params.model_name,
    token_name: params.token_name,
    group: params.group,
    start_timestamp: params.start_timestamp,
    end_timestamp: params.end_timestamp,
  })
}

export async function getAgentOverview(
  config: ApiRequestConfig = {}
): Promise<ApiResult<AgentOverview>> {
  const response = await api.get('/api/agent/overview', config)
  return agentOverviewResponseSchema.parse(response.data)
}

export async function getAgentAccessOverview(): Promise<
  ApiResult<AgentOverview>
> {
  return getAgentOverview({
    skipBusinessError: true,
    skipErrorHandler: true,
    disableDuplicate: true,
  })
}

export async function getAgentOffers(): Promise<ApiResult<AgentOffer[]>> {
  const response = await api.get('/api/agent/offers')
  return agentOffersResponseSchema.parse(response.data)
}

export async function purchaseAgentCodes(
  request: AgentPurchaseRequest
): Promise<ApiResult<AgentPurchaseResponse>> {
  const payload = agentPurchaseRequestSchema.parse(request)
  const response = await api.post('/api/agent/orders', payload)
  return agentPurchaseEnvelopeSchema.parse(response.data)
}

export async function getAgentOrders(
  params: Omit<AgentOrderParams, 'agent_user_id'> = {}
): Promise<ApiResult<AgentPage<AgentOrder>>> {
  const response = await api.get('/api/agent/orders', {
    params: selfOrderParams(params),
  })
  return agentOrdersResponseSchema.parse(response.data)
}

export async function getAgentCodes(
  params: Omit<AgentCodeParams, 'agent_user_id'> = {}
): Promise<ApiResult<AgentPage<AgentCode>>> {
  const response = await api.get('/api/agent/codes', {
    params: selfCodeParams(params),
  })
  return agentCodesResponseSchema.parse(response.data)
}

export async function exportAgentCodes(
  params: Omit<AgentCodeParams, 'agent_user_id' | 'p' | 'page_size'> = {}
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get('/api/agent/codes/export', {
    params: selfExportCodeParams(params),
    responseType: 'blob',
  })
  const result = csvResponseSchema.parse({
    blob: response.data,
    contentType: response.headers['content-type'],
  })
  return {
    blob: result.blob,
    filename: parseAgentExportFilename(response.headers['content-disposition']),
  }
}

export async function getAgentCreditLogs(
  params: AgentCreditLogParams = {}
): Promise<ApiResult<AgentPage<AgentCreditLog>>> {
  const response = await api.get('/api/agent/credit-logs', { params })
  return agentCreditLogsResponseSchema.parse(response.data)
}

export async function getAgentPromotion(): Promise<ApiResult<AgentPromotion>> {
  const response = await api.get('/api/agent/promotion')
  return agentPromotionResponseSchema.parse(response.data)
}

export async function getAgentCustomers(
  params: AgentCustomerParams = {}
): Promise<ApiResult<AgentPage<AgentCustomer>>> {
  const response = await api.get('/api/agent/customers', {
    params: selfCustomerParams(params),
  })
  return agentCustomersResponseSchema.parse(response.data)
}

export async function getAgentCustomerLogs(
  params: AgentCustomerLogParams = {}
): Promise<ApiResult<AgentPage<AgentCustomerLog>>> {
  const response = await api.get('/api/agent/logs', {
    params: selfCustomerLogParams(params),
  })
  return agentCustomerLogsResponseSchema.parse(response.data)
}

export async function getAgentCustomerLogStats(
  params: AgentCustomerLogParams = {}
): Promise<ApiResult<AgentCustomerLogStats>> {
  const response = await api.get('/api/agent/logs/stat', {
    params: selfCustomerLogParams({
      ...params,
      p: undefined,
      page_size: undefined,
    }),
  })
  return agentCustomerLogStatsResponseSchema.parse(response.data)
}

export async function refundAgentCodes(
  request: AgentRefundRequest
): Promise<ApiResult<AgentRefundResponse>> {
  const payload = agentRefundRequestSchema.parse(request)
  const response = await api.post('/api/agent/codes/refund', payload)
  return agentRefundEnvelopeSchema.parse(response.data)
}

export async function redeemTypedCode(
  request: TypedRedemptionRequest
): Promise<ApiResult<TypedRedemption>> {
  const payload = typedRedemptionRequestSchema.parse(request)
  const response = await api.post('/api/user/redeem', payload, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return typedRedemptionResponseSchema.parse(response.data)
}

export async function getAdminAgents(
  params: AdminAgentParams = {}
): Promise<ApiResult<AgentPage<AdminAgent>>> {
  const response = await api.get('/api/agent-admin/agents', { params })
  return adminAgentsResponseSchema.parse(response.data)
}

export async function getAdminAgentCreditLogs(
  userID: number,
  params: Pick<AgentCreditLogParams, 'p' | 'page_size'> = {}
): Promise<ApiResult<AgentPage<AgentCreditLog>>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.get(`/api/agent-admin/agents/${id}/credit-logs`, {
    params,
  })
  return agentCreditLogsResponseSchema.parse(response.data)
}

export async function getAdminAgentOffers(): Promise<ApiResult<AgentOffer[]>> {
  const response = await api.get('/api/agent-admin/offers')
  return agentOffersResponseSchema.parse(response.data)
}

export async function getAdminAgentOrders(
  params: AgentOrderParams = {}
): Promise<ApiResult<AgentPage<AgentOrder>>> {
  const response = await api.get('/api/agent-admin/orders', {
    params: adminOrderParamsSchema.parse(params),
  })
  return agentOrdersResponseSchema.parse(response.data)
}

export async function getAdminAgentCodes(
  params: AgentCodeParams = {}
): Promise<ApiResult<AgentPage<AgentCode>>> {
  const response = await api.get('/api/agent-admin/codes', {
    params: adminCodeParamsSchema.parse(params),
  })
  return agentCodesResponseSchema.parse(response.data)
}

export async function getAdminAgentReconciliation(
  userID: number
): Promise<ApiResult<AgentReconciliation>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.get(`/api/agent-admin/agents/${id}/reconciliation`)
  return agentReconciliationResponseSchema.parse(response.data)
}

export async function enableAgent(
  userID: number
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.post(`/api/agent-admin/agents/${id}/enable`)
  return adminAgentResponseSchema.parse(response.data)
}

export async function disableAgent(
  userID: number
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const response = await api.post(`/api/agent-admin/agents/${id}/disable`)
  return adminAgentResponseSchema.parse(response.data)
}

export async function updateAgentDailyLimit(
  userID: number,
  request: AgentDailyLimitRequest
): Promise<ApiResult<AdminAgent>> {
  const id = positiveIDSchema.parse(userID)
  const payload = agentDailyLimitRequestSchema.parse(request)
  const response = await api.patch(
    `/api/agent-admin/agents/${id}/limit`,
    payload
  )
  return adminAgentResponseSchema.parse(response.data)
}

export async function adjustAgentCredit(
  userID: number,
  request: AgentCreditAdjustmentRequest
): Promise<ApiResult<AgentCreditAdjustmentResponse>> {
  const id = positiveIDSchema.parse(userID)
  const payload = agentCreditAdjustmentRequestSchema.parse(request)
  const response = await api.post(
    `/api/agent-admin/agents/${id}/credit-adjustments`,
    payload
  )
  return agentCreditAdjustmentEnvelopeSchema.parse(response.data)
}

export async function upsertAgentOffer(
  planID: number,
  request: AgentOfferUpsertRequest
): Promise<ApiResult<AgentOffer>> {
  const id = positiveIDSchema.parse(planID)
  const payload = agentOfferUpsertRequestSchema.parse(request)
  const response = await api.put(`/api/agent-admin/offers/${id}`, payload)
  return agentOfferResponseSchema.parse(response.data)
}

export async function refundAdminAgentCodes(
  request: AdminAgentRefundRequest
): Promise<ApiResult<AgentRefundResponse>> {
  const payload = adminAgentRefundRequestSchema.parse(request)
  const response = await api.post('/api/agent-admin/codes/refund', payload)
  return agentRefundEnvelopeSchema.parse(response.data)
}
