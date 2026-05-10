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
import type {
  ChatCompletionRequest,
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ResponsesRequest,
  ClaudeMessagesRequest,
  ImageGenerationRequest,
  PlaygroundEndpoint,
  PlaygroundRequest,
} from '../types'
import {
  formatMessageForAPI,
  getCurrentVersion,
  isValidMessage,
} from './message-utils'

function getProcessedMessages(messages: Message[]) {
  return messages.filter(isValidMessage).map(formatMessageForAPI)
}

function getLastUserPrompt(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.from === 'user') {
      return getCurrentVersion(message).content
    }
  }
  return ''
}

function applyCommonTextParameters(
  payload: Record<string, unknown>,
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled,
  maxTokenKey: 'max_tokens' | 'max_output_tokens'
) {
  if (parameterEnabled.temperature) payload.temperature = config.temperature
  if (parameterEnabled.top_p) payload.top_p = config.top_p
  if (parameterEnabled.max_tokens) payload[maxTokenKey] =
    maxTokenKey === 'max_output_tokens'
      ? config.max_output_tokens
      : config.max_tokens
}

/**
 * Build API request payload from messages and config
 */
export function buildChatCompletionPayload(
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled
): ChatCompletionRequest {
  const payload: ChatCompletionRequest = {
    model: config.model,
    group: config.group,
    messages: getProcessedMessages(messages),
    stream: config.stream,
  }

  const parameterKeys: Array<keyof ParameterEnabled> = [
    'temperature',
    'top_p',
    'max_tokens',
    'frequency_penalty',
    'presence_penalty',
    'seed',
  ]

  parameterKeys.forEach((key) => {
    if (parameterEnabled[key]) {
      const value = config[key as keyof PlaygroundConfig]
      if (value !== undefined && value !== null) {
        ;(payload as unknown as Record<string, unknown>)[key] = value
      }
    }
  })

  return payload
}

export function buildResponsesPayload(
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled
): ResponsesRequest {
  const processedMessages = getProcessedMessages(messages)
  const systemMessages = processedMessages.filter((m) => m.role === 'system')
  const input = processedMessages.filter((m) => m.role !== 'system')
  const payload: ResponsesRequest = {
    model: config.model,
    group: config.group,
    input,
    stream: config.stream,
  }

  if (systemMessages.length > 0) {
    payload.instructions = systemMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean)
      .join('\n\n')
  }

  applyCommonTextParameters(
    payload as unknown as Record<string, unknown>,
    config,
    parameterEnabled,
    'max_output_tokens'
  )

  return payload
}

export function buildClaudeMessagesPayload(
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled
): ClaudeMessagesRequest {
  const processedMessages = getProcessedMessages(messages)
  const systemMessages = processedMessages.filter((m) => m.role === 'system')
  const payload: ClaudeMessagesRequest = {
    model: config.model,
    group: config.group,
    messages: processedMessages.filter((m) => m.role !== 'system'),
    stream: config.stream,
    max_tokens: config.max_tokens,
  }

  if (systemMessages.length > 0) {
    payload.system = systemMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean)
      .join('\n\n')
  }

  applyCommonTextParameters(
    payload as unknown as Record<string, unknown>,
    config,
    parameterEnabled,
    'max_tokens'
  )
  payload.max_tokens = config.max_tokens

  return payload
}

export function buildImageGenerationPayload(
  messages: Message[],
  config: PlaygroundConfig
): ImageGenerationRequest {
  const payload: ImageGenerationRequest = {
    model: config.model,
    group: config.group,
    prompt: getLastUserPrompt(messages),
    n: config.image_n,
    size: config.image_size,
    quality: config.image_quality,
    response_format: config.image_response_format,
  }

  return payload
}

export function buildPlaygroundPayload(
  endpoint: PlaygroundEndpoint,
  messages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled
): PlaygroundRequest {
  switch (endpoint) {
    case 'responses':
      return buildResponsesPayload(messages, config, parameterEnabled)
    case 'claude-messages':
      return buildClaudeMessagesPayload(messages, config, parameterEnabled)
    case 'image-generations':
      return buildImageGenerationPayload(messages, config)
    default:
      return buildChatCompletionPayload(messages, config, parameterEnabled)
  }
}
