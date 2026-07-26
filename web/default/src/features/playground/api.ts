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
import { api, getCommonHeaders } from '@/lib/api'

import { API_ENDPOINTS } from './constants'
import type {
  InspirationCollection,
  InspirationEventType,
  InspirationLibrary,
  InspirationRecipe,
} from './inspiration/types'
import { parseRequestErrorDetails } from './lib/streaming/request-error-utils'
import { buildImageGenerationRequestBody } from './lib/studio/image-request-schema'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  GeneratedImage,
  StudioSettings,
  VideoSubmission,
} from './types'

export type ManagedToolAction =
  | 'chat'
  | 'generate_image'
  | 'generate_video'
  | 'web_search'

export type ManagedToolRunResponse = {
  run: {
    id: number
    action: ManagedToolAction
    status: string
    tool_model?: string
    task_id?: string
    error?: string
  }
  arguments: Record<string, unknown>
  execution: { endpoint: string; method: string; execution_token: string }
  sources?: {
    results?: Array<{
      title: string
      url: string
      snippet?: string
      domain?: string
      published_at?: string
    }>
  }
  result?: unknown
}

export type ManagedExecutionContract = {
  runId: number
  executionToken: string
}

export async function executeManagedSearch(
  runId: number,
  executionToken: string
): Promise<unknown> {
  const response = await api.post('/pg/responses', {}, {
    headers: {
      'X-Playground-Run-Id': String(runId),
      'X-Playground-Execution-Token': executionToken,
    },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return response.data
}

function requireManagedSuccess(response: {
  data?: { success?: boolean; message?: string; data?: unknown }
}): ManagedToolRunResponse {
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Managed tool request failed')
  }
  return response.data.data as ManagedToolRunResponse
}

export async function getManagedToolRun(
  runId: number
): Promise<ManagedToolRunResponse> {
  const response = await api.get(`/api/playground/chat/runs/${runId}`)
  return requireManagedSuccess(response)
}

export async function createManagedToolRun(input: {
  client_request_id: string
  model: string
  group: string
  user_text: string
  tool_policy: {
    mode: 'auto' | 'direct'
    enabled: Array<'generate_image' | 'generate_video' | 'web_search'>
    direct?: { name: string; args: Record<string, unknown> }
  }
}): Promise<ManagedToolRunResponse> {
  const response = await api.post('/api/playground/chat/runs', input)
  return requireManagedSuccess(response)
}

export async function importManagedToolRun(
  runId: number,
  input: {
    execution_token: string
    status: 'submitted' | 'completed' | 'failed'
    task_id?: string
    result?: unknown
    sources?: unknown
    error?: string
  }
): Promise<ManagedToolRunResponse> {
  const response = await api.post(
    `/api/playground/chat/runs/${runId}/import`,
    input
  )
  return requireManagedSuccess(response)
}

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

/**
 * Resolve media for upstream providers.
 * Relative auth-gated asset URLs cannot be fetched by providers — convert to data URLs.
 * Already-inline data: and absolute http(s) URLs are returned unchanged.
 */
export async function resolveMediaForUpstream(
  ref: string | null | undefined
): Promise<string | null> {
  if (!ref) return null
  const value = ref.trim()
  if (!value) return null
  if (value.startsWith('data:')) return value
  // same-origin auth-gated asset content (or other relative app paths)
  const isAppAsset =
    value.startsWith('/api/playground/assets/') ||
    value.includes('/api/playground/assets/') ||
    value.startsWith(`${window.location.origin}/api/playground/assets/`)
  if (isAppAsset || (value.startsWith('/') && !value.startsWith('//'))) {
    let fetchUrl = value
    if (!value.startsWith('http') && !value.startsWith('/')) {
      fetchUrl = `/${value}`
    }
    const headers = getCommonHeaders()
    delete headers['Content-Type']
    const res = await fetch(fetchUrl, {
      credentials: 'include',
      headers,
    })
    if (!res.ok) {
      throw new Error(`Failed to load reference media (${res.status})`)
    }
    const blob = await res.blob()
    return await blobToDataUrl(blob)
  }
  // absolute public URLs — pass through
  if (value.startsWith('https://') || value.startsWith('http://')) {
    return value
  }
  return value
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(String(reader.result ?? ''))
    })
    reader.addEventListener('error', () => {
      reject(new Error('Could not read media blob'))
    })
    reader.readAsDataURL(blob)
  })
}

export type ImageGenerateInput = {
  model: string
  group: string
  prompt: string
  settings: StudioSettings
  /** data URL or asset content URL — resolved to data URL before relay */
  referenceImage?: string | null
  /** extra references sent alongside the first one (multi-image edit) */
  referenceImages?: Array<string | null | undefined>
  /** when true with reference, use /pg/images/edits */
  editMode?: boolean
  execution?: ManagedExecutionContract
}

export async function generateImages(
  input: ImageGenerateInput
): Promise<GeneratedImage[]> {
  const ref = await resolveMediaForUpstream(input.referenceImage)
  const extraRefs = await Promise.all(
    (input.referenceImages ?? []).map((item) => resolveMediaForUpstream(item))
  )
  const body = buildImageGenerationRequestBody({
    model: input.model,
    group: input.group,
    prompt: input.prompt,
    settings: input.settings,
    referenceImage: ref,
    referenceImages: extraRefs,
  })
  const endpoint =
    input.editMode && ref
      ? API_ENDPOINTS.IMAGE_EDITS
      : API_ENDPOINTS.IMAGE_GENERATIONS
  try {
    const response = await api.post(endpoint, body, {
      headers: input.execution
        ? {
            'X-Playground-Run-Id': String(input.execution.runId),
            'X-Playground-Execution-Token': input.execution.executionToken,
          }
        : undefined,
      skipErrorHandler: true,
    } as Record<string, unknown>)
    const items = (response.data?.data ?? []) as Array<{
      url?: string
      b64_json?: string
      revised_prompt?: string
    }>
    return items
      .map((item) => ({
        url:
          item.url ??
          (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
        revisedPrompt: item.revised_prompt,
      }))
      .filter((item) => item.url)
  } catch (error) {
    const details = parseRequestErrorDetails(error)
    throw new Error(details.errorMessage)
  }
}

export type VideoSubmitInput = {
  model: string
  group: string
  prompt: string
  settings: StudioSettings
  firstFrame?: string | null
  lastFrame?: string | null
  inputReference?: string | null
  execution?: ManagedExecutionContract
}

export async function submitVideo(
  input: VideoSubmitInput
): Promise<VideoSubmission> {
  const body: Record<string, unknown> = {
    model: input.model,
    group: input.group,
    prompt: input.prompt,
    duration: input.settings.videoDuration,
    size: input.settings.videoSize,
  }
  const first = await resolveMediaForUpstream(
    input.firstFrame || input.inputReference
  )
  const last = await resolveMediaForUpstream(input.lastFrame)
  if (first) {
    body.first_frame = first
    body.input_reference = first
    body.image = first
    body.images = [first]
  }
  if (last) {
    body.last_frame = last
    const images = (body.images as string[] | undefined) ?? []
    if (!images.includes(last)) {
      body.images = [...images, last]
    }
  }
  const response = await api.post(API_ENDPOINTS.VIDEO_GENERATIONS, body, {
    headers: input.execution
      ? {
          'X-Playground-Run-Id': String(input.execution.runId),
          'X-Playground-Execution-Token': input.execution.executionToken,
        }
      : undefined,
  })
  const data = response.data?.data ?? response.data
  return {
    taskId: String(data?.task_id ?? data?.id ?? ''),
    status: data?.status,
  }
}

export async function generateSpeech(input: {
  model: string
  group: string
  text: string
  settings: StudioSettings
  voiceId?: string
}): Promise<Blob> {
  const response = await api.post(
    API_ENDPOINTS.AUDIO_SPEECH,
    {
      model: input.model,
      group: input.group,
      input: input.text,
      voice: input.voiceId || input.settings.voice,
      speed: input.settings.speed,
      response_format: input.settings.audioFormat,
    },
    { responseType: 'blob' }
  )
  return response.data as Blob
}

// ---- Estimate ----

export type PlaygroundEstimateInput = {
  modality: string
  model: string
  group: string
  n?: number
  size?: string
  duration?: number
  has_reference?: boolean
  max_tokens?: number
  /** Rough prompt token hint for token-mode estimates */
  prompt_tokens?: number
}

export type PlaygroundEstimateResult = {
  kind: string
  quota?: number
  amount?: number
  amount_label?: string
  group_ratio: number
  model_price?: number
  model_ratio?: number
  message?: string
}

export async function estimatePlaygroundCost(
  input: PlaygroundEstimateInput
): Promise<PlaygroundEstimateResult | null> {
  try {
    const res = await api.post(API_ENDPOINTS.ESTIMATE, input, {
      skipErrorHandler: true,
    } as Record<string, unknown>)
    if (!res.data?.success) return null
    return res.data.data as PlaygroundEstimateResult
  } catch {
    return null
  }
}

// ---- Assets ----

export type PlaygroundAsset = {
  id: number
  user_id: number
  kind: string
  name: string
  storage_key?: string
  url: string
  mime: string
  size: number
  created_at: number
}

export async function listPlaygroundAssets(params?: {
  kind?: string
  p?: number
  page_size?: number
}): Promise<{ items: PlaygroundAsset[]; total: number }> {
  const res = await api.get(API_ENDPOINTS.ASSETS, { params })
  if (!res.data?.success) return { items: [], total: 0 }
  const data = res.data.data
  return {
    items: (data?.items ?? []) as PlaygroundAsset[],
    total: Number(data?.total ?? 0),
  }
}

export async function uploadPlaygroundAsset(
  file: File,
  kind?: string
): Promise<PlaygroundAsset> {
  const form = new FormData()
  form.append('file', file)
  if (kind) form.append('kind', kind)
  const res = await api.post(API_ENDPOINTS.ASSETS, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Upload failed')
  }
  return res.data.data as PlaygroundAsset
}

export async function importPlaygroundAsset(
  sourceUrl: string,
  kind: 'image' | 'video' | 'audio'
): Promise<PlaygroundAsset> {
  const res = await api.post(`${API_ENDPOINTS.ASSETS}/import`, {
    source_url: sourceUrl,
    kind,
  })
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Import failed')
  }
  return res.data.data as PlaygroundAsset
}

export async function deletePlaygroundAsset(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.ASSETS}/${id}`)
}

export async function createUploadSession(kind?: string): Promise<{
  token: string
  expires_at: number
  upload_url: string
}> {
  const res = await api.post(API_ENDPOINTS.UPLOAD_SESSIONS, { kind })
  if (!res.data?.success) throw new Error(res.data?.message || 'Session failed')
  return res.data.data
}

export async function getUploadSession(token: string): Promise<{
  token: string
  expires_at: number
  asset_id: number
  asset?: PlaygroundAsset | null
}> {
  const res = await api.get(`${API_ENDPOINTS.UPLOAD_SESSIONS}/${token}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'Not found')
  return res.data.data
}

// ---- Conversations ----

export type ServerConversation = {
  id: number
  title: string
  model: string
  group: string
  kind?: string
  meta_json?: string
  created_at: number
  updated_at: number
}

export type ServerMessage = {
  id: number
  role: string
  content: string
  content_json?: string
  model?: string
  tool_json?: string
  client_key?: string
  seq: number
  created_at?: number
}

export type ServerConversationMessageInput = {
  role: string
  content: string
  content_json?: string
  model?: string
  tool_json?: string
  client_key?: string
  created_at?: number
}

export async function listConversations(params?: {
  p?: number
  page_size?: number
}): Promise<{ items: ServerConversation[]; total: number }> {
  const res = await api.get(API_ENDPOINTS.CONVERSATIONS, { params })
  if (!res.data?.success) return { items: [], total: 0 }
  return {
    items: (res.data.data?.items ?? []) as ServerConversation[],
    total: Number(res.data.data?.total ?? 0),
  }
}

export async function createConversation(input: {
  title?: string
  model?: string
  group?: string
  kind?: 'chat' | 'duo'
  meta_json?: string | Record<string, unknown>
}): Promise<ServerConversation> {
  const res = await api.post(API_ENDPOINTS.CONVERSATIONS, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'Create failed')
  return res.data.data as ServerConversation
}

export async function getConversation(id: number): Promise<{
  conversation: ServerConversation
  messages: ServerMessage[]
}> {
  const res = await api.get(`${API_ENDPOINTS.CONVERSATIONS}/${id}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'Not found')
  return res.data.data
}

export async function deleteConversation(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.CONVERSATIONS}/${id}`)
}

export async function updateConversation(
  id: number,
  input: {
    title?: string
    model?: string
    group?: string
    kind?: 'chat' | 'duo'
    meta_json?: string | Record<string, unknown>
  }
): Promise<ServerConversation> {
  const res = await api.patch(`${API_ENDPOINTS.CONVERSATIONS}/${id}`, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'Update failed')
  return res.data.data as ServerConversation
}

export async function putConversationMessages(
  id: number,
  messages: ServerConversationMessageInput[]
): Promise<void> {
  await api.put(`${API_ENDPOINTS.CONVERSATIONS}/${id}/messages`, { messages })
}

// ---- Studio projects ----

export type ServerProject = {
  id: number
  modality: string
  title: string
  model: string
  group: string
  client_key?: string
  last_prompt?: string
  preview_urls?: string
  created_at: number
  updated_at: number
}

export async function listProjects(params?: {
  p?: number
  page_size?: number
  modality?: string
}): Promise<{ items: ServerProject[]; total: number }> {
  const res = await api.get(API_ENDPOINTS.PROJECTS, { params })
  if (!res.data?.success) return { items: [], total: 0 }
  return {
    items: (res.data.data?.items ?? []) as ServerProject[],
    total: Number(res.data.data?.total ?? 0),
  }
}

export async function createProject(input: {
  modality: string
  title?: string
  model?: string
  group?: string
  client_key?: string
  last_prompt?: string
  preview_urls?: string[]
}): Promise<ServerProject> {
  const res = await api.post(API_ENDPOINTS.PROJECTS, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'Create failed')
  return res.data.data as ServerProject
}

export async function getProject(id: number): Promise<{
  project: ServerProject
  runs: PlaygroundRun[]
}> {
  const res = await api.get(`${API_ENDPOINTS.PROJECTS}/${id}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'Not found')
  return res.data.data
}

export async function updateProject(
  id: number,
  input: {
    title?: string
    model?: string
    group?: string
    last_prompt?: string
    preview_urls?: string[]
  }
): Promise<ServerProject> {
  const res = await api.patch(`${API_ENDPOINTS.PROJECTS}/${id}`, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'Update failed')
  return res.data.data as ServerProject
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.PROJECTS}/${id}`)
}

// ---- Personas ----

export type PlaygroundPersona = {
  id: number
  name: string
  system_prompt: string
  created_at: number
}

export async function listPersonas(): Promise<PlaygroundPersona[]> {
  const res = await api.get(API_ENDPOINTS.PERSONAS)
  if (!res.data?.success) return []
  return (res.data.data ?? []) as PlaygroundPersona[]
}

export async function createPersona(input: {
  name: string
  system_prompt: string
}): Promise<PlaygroundPersona> {
  const res = await api.post(API_ENDPOINTS.PERSONAS, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'Create failed')
  return res.data.data as PlaygroundPersona
}

export async function deletePersona(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.PERSONAS}/${id}`)
}

// ---- Runs / tasks ----

export type PlaygroundRun = {
  id: number
  modality: string
  model: string
  prompt: string
  result_url: string
  asset_id?: number
  project_id?: number
  quota: number
  task_id: string
  created_at: number
}

export async function listPlaygroundTasks(): Promise<{
  tasks: unknown[]
  runs: PlaygroundRun[]
}> {
  const res = await api.get(API_ENDPOINTS.PLAYGROUND_TASKS)
  if (!res.data?.success) return { tasks: [], runs: [] }
  return {
    tasks: res.data.data?.tasks ?? [],
    runs: (res.data.data?.runs ?? []) as PlaygroundRun[],
  }
}

export async function createPlaygroundRun(input: {
  modality: string
  model: string
  prompt: string
  result_url?: string
  asset_id?: number
  project_id?: number
  quota?: number
  task_id?: string
}): Promise<PlaygroundRun | null> {
  try {
    const res = await api.post(API_ENDPOINTS.PLAYGROUND_RUNS, input, {
      skipErrorHandler: true,
    } as Record<string, unknown>)
    if (!res.data?.success) return null
    return res.data.data as PlaygroundRun
  } catch {
    return null
  }
}

// ---- Multi-chat ----

export async function multiChat(input: {
  answer_models: string[]
  summarizer_model: string
  messages: Array<{ role: string; content: string }>
  group?: string
  timeout?: number
}): Promise<{
  legs: Array<{ model: string; content?: string; error?: string }>
  summary: string
  summary_error?: string
  partial?: boolean
}> {
  const res = await api.post(API_ENDPOINTS.CHAT_MULTI, input, {
    skipErrorHandler: true,
    // Align with backend max timeout (300s) so summary is not cut off after legs
    timeout: 310_000,
  } as Record<string, unknown>)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Multi-chat failed')
  }
  return res.data.data
}

// ---- Inspiration ----

export type ApiInspirationCategory = {
  id: number
  slug: string
  name: string
}

export async function listInspirationCategories(): Promise<
  ApiInspirationCategory[]
> {
  try {
    const res = await api.get(API_ENDPOINTS.INSPIRATION_CATEGORIES, {
      skipErrorHandler: true,
    } as Record<string, unknown>)
    if (!res.data?.success) return []
    return (res.data.data ?? []) as ApiInspirationCategory[]
  } catch {
    return []
  }
}

export async function listInspirationTemplates(params?: {
  category?: string
  modality?: string
  page_size?: number
}): Promise<InspirationRecipe[]> {
  const res = await api.get(API_ENDPOINTS.INSPIRATION_TEMPLATES, {
    params: { page_size: 50, ...params },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Could not load recipes')
  }
  return ((res.data.data?.items ?? []) as InspirationRecipe[]).map(
    normalizeInspirationRecipe
  )
}

export async function getInspirationTemplate(
  slug: string
): Promise<InspirationRecipe> {
  const res = await api.get(`${API_ENDPOINTS.INSPIRATION_TEMPLATES}/${slug}`, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Could not load recipe')
  }
  return normalizeInspirationRecipe(res.data.data as InspirationRecipe)
}

function normalizeInspirationRecipe(
  recipe: InspirationRecipe
): InspirationRecipe {
  return {
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    variables: Array.isArray(recipe.variables) ? recipe.variables : [],
    examples: Array.isArray(recipe.examples) ? recipe.examples : [],
    parameters:
      recipe.parameters && typeof recipe.parameters === 'object'
        ? recipe.parameters
        : {},
    model_policy: {
      recommended: Array.isArray(recipe.model_policy?.recommended)
        ? recipe.model_policy.recommended
        : [],
      compatible: Array.isArray(recipe.model_policy?.compatible)
        ? recipe.model_policy.compatible
        : [],
    },
    covers: recipe.covers ?? { small: '', medium: '', large: '' },
  }
}

export async function recordInspirationEvents(
  recipe: InspirationRecipe,
  type: InspirationEventType
): Promise<void> {
  try {
    await api.post(
      '/api/playground/inspiration/events',
      {
        events: [
          {
            event_id: crypto.randomUUID(),
            template_id: recipe.id,
            version_id: recipe.version_id,
            type,
          },
        ],
      },
      { skipErrorHandler: true } as Record<string, unknown>
    )
  } catch {
    /* analytics never blocks UX */
  }
}

export async function getInspirationLibrary(): Promise<InspirationLibrary> {
  const res = await api.get('/api/playground/inspiration/library')
  return res.data.data as InspirationLibrary
}

export async function setInspirationFavorite(
  templateId: number,
  favorite: boolean
): Promise<void> {
  const method = favorite ? api.put : api.delete
  await method(`/api/playground/inspiration/templates/${templateId}/favorite`)
}

export async function createInspirationCollection(
  name: string
): Promise<InspirationCollection> {
  const res = await api.post('/api/playground/inspiration/collections', {
    name,
  })
  return res.data.data as InspirationCollection
}

export async function setInspirationCollectionTemplate(
  collectionId: number,
  templateId: number,
  saved: boolean
): Promise<void> {
  const method = saved ? api.put : api.delete
  await method(
    `/api/playground/inspiration/collections/${collectionId}/templates/${templateId}`
  )
}

// ---- Skill ----

export function skillDownloadUrl(): string {
  return API_ENDPOINTS.SKILL_MD
}

// ---- Voices ----

export type PlaygroundVoice = {
  id: number
  name: string
  asset_id: number
  status: string
  provider_voice_id?: string
  created_at: number
}

export async function listVoices(): Promise<PlaygroundVoice[]> {
  const res = await api.get(API_ENDPOINTS.VOICES)
  if (!res.data?.success) return []
  return (res.data.data ?? []) as PlaygroundVoice[]
}

export async function createVoice(
  file: File,
  name: string
): Promise<PlaygroundVoice> {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  const res = await api.post(API_ENDPOINTS.VOICES, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (!res.data?.success) throw new Error(res.data?.message || 'Create failed')
  return (res.data.data?.voice ?? res.data.data) as PlaygroundVoice
}

export async function deleteVoice(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.VOICES}/${id}`)
}
