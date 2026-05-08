import type { PlaygroundEndpoint, PlaygroundImage } from '../types'

interface NormalizedPlaygroundResponse {
  content: string
  reasoning?: string
  images?: PlaygroundImage[]
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const record = part as Record<string, unknown>
      if (typeof record.text === 'string') return record.text
      if (typeof record.content === 'string') return record.content
      if (record.type === 'text' && typeof record.value === 'string') {
        return record.value
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function extractImages(value: unknown): PlaygroundImage[] {
  const images: PlaygroundImage[] = []

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return

    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    const record = node as Record<string, unknown>
    const maybeImage: PlaygroundImage = {}

    if (typeof record.url === 'string') maybeImage.url = record.url
    if (typeof record.image_url === 'string') maybeImage.url = record.image_url
    if (typeof record.b64_json === 'string') maybeImage.b64_json = record.b64_json
    if (typeof record.result === 'string') maybeImage.b64_json = record.result
    if (typeof record.mime_type === 'string') maybeImage.mime_type = record.mime_type

    if (maybeImage.url || maybeImage.b64_json) {
      images.push(maybeImage)
    }

    Object.values(record).forEach(visit)
  }

  visit(value)
  return images
}

function normalizeChatCompletionResponse(response: unknown): NormalizedPlaygroundResponse {
  const record = response as {
    choices?: Array<{
      message?: { content?: string; reasoning_content?: string }
    }>
  }
  const choice = record.choices?.[0]
  return {
    content: choice?.message?.content || '',
    reasoning: choice?.message?.reasoning_content,
  }
}

function normalizeResponsesResponse(response: unknown): NormalizedPlaygroundResponse {
  const record = response as Record<string, unknown>
  const images = extractImages(record.output)
  const outputText = typeof record.output_text === 'string' ? record.output_text : ''

  if (outputText) {
    return { content: outputText, images }
  }

  const output = Array.isArray(record.output) ? record.output : []
  const content = output
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const itemRecord = item as Record<string, unknown>
      return extractTextFromContent(itemRecord.content)
    })
    .filter(Boolean)
    .join('\n')

  return { content, images }
}

function normalizeClaudeResponse(response: unknown): NormalizedPlaygroundResponse {
  const record = response as Record<string, unknown>
  const content = extractTextFromContent(record.content)
  const reasoning = Array.isArray(record.content)
    ? record.content
        .map((part) => {
          if (!part || typeof part !== 'object') return ''
          const partRecord = part as Record<string, unknown>
          if (
            (partRecord.type === 'thinking' || partRecord.type === 'reasoning') &&
            typeof partRecord.thinking === 'string'
          ) {
            return partRecord.thinking
          }
          if (
            (partRecord.type === 'thinking' || partRecord.type === 'reasoning') &&
            typeof partRecord.text === 'string'
          ) {
            return partRecord.text
          }
          return ''
        })
        .filter(Boolean)
        .join('\n')
    : ''

  return { content, reasoning }
}

function normalizeImageGenerationResponse(response: unknown): NormalizedPlaygroundResponse {
  const record = response as Record<string, unknown>
  return {
    content: '',
    images: extractImages(record.data),
  }
}

export function normalizePlaygroundResponse(
  endpoint: PlaygroundEndpoint,
  response: unknown
): NormalizedPlaygroundResponse {
  switch (endpoint) {
    case 'responses':
      return normalizeResponsesResponse(response)
    case 'claude-messages':
      return normalizeClaudeResponse(response)
    case 'image-generations':
      return normalizeImageGenerationResponse(response)
    default:
      return normalizeChatCompletionResponse(response)
  }
}

export function normalizePlaygroundError(error: unknown): {
  message: string
  code?: string
} {
  const err = error as {
    response?: {
      status?: number
      statusText?: string
      data?:
        | string
        | {
            message?: string
            error?: { message?: string; code?: string }
          }
    }
    message?: string
  }

  const status = err?.response?.status
  const responseData = err?.response?.data

  if (status === 504) {
    return {
      message: 'Gateway timeout. The image generation request took too long. Please try again later.',
      code: undefined,
    }
  }

  if (typeof responseData === 'string') {
    return {
      message: status
        ? `HTTP error ${status}${err?.response?.statusText ? `: ${err.response.statusText}` : ''}`
        : err?.message || 'Request error occurred',
      code: undefined,
    }
  }

  return {
    message:
      responseData?.error?.message ||
      responseData?.message ||
      err?.message ||
      'Request error occurred',
    code: responseData?.error?.code || undefined,
  }
}
