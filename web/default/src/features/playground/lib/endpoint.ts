import { t } from 'i18next'
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
      return t('playground.endpoint.label.responses')
    case 'claude-messages':
      return t('playground.endpoint.label.claude-messages')
    case 'image-generations':
      return t('playground.endpoint.label.image-generations')
    case 'chat-completions':
      return t('playground.endpoint.label.chat-completions')
    default: {
      const exhaustiveCheck: never = endpoint
      return exhaustiveCheck
    }
  }
}

export function getEndpointDescription(endpoint: PlaygroundEndpoint): string {
  switch (endpoint) {
    case 'responses':
      return t('playground.endpoint.description.responses')
    case 'claude-messages':
      return t('playground.endpoint.description.claude-messages')
    case 'image-generations':
      return t('playground.endpoint.description.image-generations')
    case 'chat-completions':
      return t('playground.endpoint.description.chat-completions')
    default: {
      const exhaustiveCheck: never = endpoint
      return exhaustiveCheck
    }
  }
}
