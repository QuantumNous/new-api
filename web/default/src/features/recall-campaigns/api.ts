import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  ApiResponse,
  RecallCampaignAction,
  RecallCampaignDetail,
  RecallCampaignDraft,
  RecallCampaignMetrics,
  RecallCampaignPreview,
  RecallCampaignSearch,
  RecallCampaignSummary,
  RecallEmailPreviewRequest,
  RecallEmailPreviewResponse,
  RecallEvent,
  RecallPage,
  RecallAudienceUserOption,
  RecallRecipient,
  RecallSubscriptionProductRecord,
  RecallStripePreview,
  RecallTopUpProductConfiguration,
} from './types'

export const recallCampaignKeys = {
  all: ['recall-campaigns'] as const,
  list: (search: RecallCampaignSearch) =>
    ['recall-campaigns', 'list', search] as const,
  detail: (id: number) => ['recall-campaigns', 'detail', id] as const,
  recipients: (id: number, page: number) =>
    ['recall-campaigns', id, 'recipients', page] as const,
  events: (id: number, page: number) =>
    ['recall-campaigns', id, 'events', page] as const,
  metrics: (id: number) => ['recall-campaigns', id, 'metrics'] as const,
  topUpProductConfiguration: [
    'recall-campaigns',
    'product-options',
    'top-up',
  ] as const,
  subscriptionProductConfiguration: [
    'recall-campaigns',
    'product-options',
    'subscription',
  ] as const,
  userGroups: ['recall-campaigns', 'audience-options', 'user-groups'] as const,
  audienceUsers: (params: { keyword?: string; ids?: number[] }) =>
    ['recall-campaigns', 'audience-options', 'users', params] as const,
}

function requireRecallSuccess<T>(response: ApiResponse<T>): ApiResponse<T> {
  if (response?.success !== true) {
    throw new Error(response?.message || 'Recall campaign request failed')
  }
  return response
}

export async function listRecallCampaigns(
  search: RecallCampaignSearch
): Promise<ApiResponse<RecallPage<RecallCampaignSummary>>> {
  const response = await api.get('/api/recall-campaigns/', { params: search })
  return requireRecallSuccess(response.data)
}

export async function createRecallCampaign(
  draft: RecallCampaignDraft
): Promise<ApiResponse<RecallCampaignSummary>> {
  const response = await api.post('/api/recall-campaigns/', draft)
  return requireRecallSuccess(response.data)
}

export async function getRecallCampaign(
  id: number
): Promise<ApiResponse<RecallCampaignDetail>> {
  const response = await api.get(`/api/recall-campaigns/${id}`)
  return requireRecallSuccess(response.data)
}

export async function updateRecallCampaign(
  id: number,
  draft: RecallCampaignDraft
): Promise<ApiResponse<RecallCampaignSummary>> {
  const response = await api.put(`/api/recall-campaigns/${id}`, draft)
  return requireRecallSuccess(response.data)
}

export async function previewRecallCampaign(
  id: number,
  sampleSize = 20
): Promise<ApiResponse<RecallCampaignPreview>> {
  const response = await api.post(`/api/recall-campaigns/${id}/preview`, null, {
    params: { sample_size: sampleSize },
  })
  return requireRecallSuccess(response.data)
}

export async function previewRecallEmail(
  request: RecallEmailPreviewRequest
): Promise<ApiResponse<RecallEmailPreviewResponse>> {
  const response = await api.post(
    '/api/recall-campaigns/email-preview',
    request
  )
  return requireRecallSuccess(response.data)
}

export async function validateRecallStripeConfig(
  draft: RecallCampaignDraft
): Promise<ApiResponse<RecallStripePreview>> {
  const response = await api.post(
    '/api/recall-campaigns/stripe/validate',
    draft
  )
  return requireRecallSuccess(response.data)
}

export async function getRecallTopUpProductConfiguration(): Promise<
  ApiResponse<RecallTopUpProductConfiguration>
> {
  const response = await api.get('/api/user/topup/info')
  return requireRecallSuccess(response.data)
}

export async function getRecallSubscriptionProductConfiguration(): Promise<
  ApiResponse<RecallSubscriptionProductRecord[]>
> {
  const response = await api.get('/api/subscription/admin/plans')
  return requireRecallSuccess(response.data)
}

export async function getRecallUserGroups(): Promise<ApiResponse<string[]>> {
  const response = await api.get('/api/group/', { params: { type: 'user' } })
  return requireRecallSuccess(response.data)
}

export async function listRecallAudienceUsers(params: {
  keyword?: string
  ids?: number[]
}): Promise<ApiResponse<RecallAudienceUserOption[]>> {
  const keyword = params.keyword?.trim()
  const requestParams: Record<string, string | number> = {}

  if (keyword) {
    requestParams.keyword = keyword
    requestParams.page_size = 50
  } else if (params.ids?.length) {
    requestParams.ids = params.ids.join(',')
  }

  const response = await api.get('/api/recall-campaigns/audience-users', {
    params: requestParams,
  })
  return requireRecallSuccess(response.data)
}

export async function runRecallCampaignAction(
  id: number,
  action: RecallCampaignAction
): Promise<ApiResponse> {
  const response = await api.post(`/api/recall-campaigns/${id}/${action}`)
  return requireRecallSuccess(response.data)
}

export async function listRecallRecipients(
  id: number,
  page: number,
  pageSize = 20,
  state = ''
): Promise<ApiResponse<RecallPage<RecallRecipient>>> {
  const response = await api.get(`/api/recall-campaigns/${id}/recipients`, {
    params: { p: page, ps: pageSize, state },
  })
  return requireRecallSuccess(response.data)
}

export async function listRecallEvents(
  id: number,
  page: number,
  pageSize = 20
): Promise<ApiResponse<RecallPage<RecallEvent>>> {
  const response = await api.get(`/api/recall-campaigns/${id}/events`, {
    params: { p: page, ps: pageSize },
  })
  return requireRecallSuccess(response.data)
}

export async function getRecallCampaignMetrics(
  id: number
): Promise<ApiResponse<RecallCampaignMetrics>> {
  const response = await api.get(`/api/recall-campaigns/${id}/metrics`)
  return requireRecallSuccess(response.data)
}

export async function retryRecallRecipient(
  campaignId: number,
  recipientId: number,
  acknowledgeUncertain: boolean
): Promise<ApiResponse> {
  const response = await api.post(
    `/api/recall-campaigns/${campaignId}/recipients/${recipientId}/retry`,
    { acknowledge_uncertain: acknowledgeUncertain }
  )
  return requireRecallSuccess(response.data)
}

export async function exportRecallCampaign(id: number): Promise<Blob> {
  const response = await api.get(`/api/recall-campaigns/${id}/export`, {
    responseType: 'blob',
    disableDuplicate: true,
  })
  const blob = response.data as Blob
  if (blob.type.toLowerCase().includes('json')) {
    let payload: ApiResponse
    try {
      payload = JSON.parse(await blob.text()) as ApiResponse
    } catch {
      throw new Error('Recall campaign export returned invalid JSON')
    }
    requireRecallSuccess(payload)
    throw new Error('Recall campaign export returned JSON instead of CSV')
  }
  return blob
}

export function useRecallCampaignMutations(id?: number) {
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: recallCampaignKeys.all })
  }

  const create = useMutation({
    mutationFn: createRecallCampaign,
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: (draft: RecallCampaignDraft) => {
      if (!id) throw new Error('Recall campaign ID is required')
      return updateRecallCampaign(id, draft)
    },
    onSuccess: invalidate,
  })
  const action = useMutation({
    mutationFn: (value: RecallCampaignAction) => {
      if (!id) throw new Error('Recall campaign ID is required')
      return runRecallCampaignAction(id, value)
    },
    onSuccess: invalidate,
  })
  const retry = useMutation({
    mutationFn: (value: {
      recipientId: number
      acknowledgeUncertain: boolean
    }) => {
      if (!id) throw new Error('Recall campaign ID is required')
      return retryRecallRecipient(
        id,
        value.recipientId,
        value.acknowledgeUncertain
      )
    },
    onSuccess: invalidate,
  })

  return { create, update, action, retry }
}
