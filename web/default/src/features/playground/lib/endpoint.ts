import type { PlaygroundEndpoint } from '../types'

const IMAGE_MODEL_PATTERNS = [
  'gpt-image',
  'dall-e',
  'imagen-',
  'flux-',
  'flux.1-',
]

export function inferPlaygroundEndpoint(model: string): PlaygroundEndpoint {
  const normalized = model.toLowerCase()

  if (IMAGE_MODEL_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'image-generations'
  }

  if (
    normalized.includes('claude') ||
    normalized.includes('haiku') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus')
  ) {
    return 'claude-messages'
  }

  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('chatgpt') ||
    /^o\d/.test(normalized)
  ) {
    return 'responses'
  }

  return 'chat-completions'
}

export function getEndpointLabel(endpoint: PlaygroundEndpoint): string {
  switch (endpoint) {
    case 'responses':
      return 'Responses (/v1/responses)'
    case 'claude-messages':
      return 'Claude Messages (/v1/messages)'
    case 'image-generations':
      return 'Images (/v1/images/generations)'
    default:
      return 'Chat Completions (/v1/chat/completions)'
  }
}

export function getEndpointDescription(endpoint: PlaygroundEndpoint): string {
  switch (endpoint) {
    case 'responses':
      return 'GPT text models, including Responses image_generation_call results.'
    case 'claude-messages':
      return 'Claude Haiku, Sonnet, and Opus models.'
    case 'image-generations':
      return 'Dedicated image models such as gpt-image and dall-e.'
    default:
      return 'Legacy OpenAI-compatible chat completion models.'
  }
}
