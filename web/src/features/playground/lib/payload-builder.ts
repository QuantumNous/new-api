import type {
  ChatCompletionRequest,
  Message,
  PlaygroundConfig,
  ParameterEnabled,
} from '../types'
import { formatMessageForAPI, isValidMessage } from './message-utils'

/**
 * Build API request payload from messages and config
 */
export function buildChatCompletionPayload(
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled
): ChatCompletionRequest {
  // Filter and format valid messages
  const processedMessages = messages
    .filter(isValidMessage)
    .map(formatMessageForAPI)

  const payload: ChatCompletionRequest = {
    model: config.model,
    group: config.group,
    messages: processedMessages,
    stream: config.stream,
  }

  // Add enabled parameters
  const parameterMappings: Array<{
    key: keyof ParameterEnabled
    apiKey: keyof ChatCompletionRequest
  }> = [
    { key: 'temperature', apiKey: 'temperature' },
    { key: 'top_p', apiKey: 'top_p' },
    { key: 'max_tokens', apiKey: 'max_tokens' },
    { key: 'frequency_penalty', apiKey: 'frequency_penalty' },
    { key: 'presence_penalty', apiKey: 'presence_penalty' },
    { key: 'seed', apiKey: 'seed' },
  ]

  for (const { key, apiKey } of parameterMappings) {
    if (parameterEnabled[key]) {
      const value = config[apiKey as keyof PlaygroundConfig]
      if (value !== undefined && value !== null) {
        ;(payload as any)[apiKey] = value
      }
    }
  }

  return payload
}
