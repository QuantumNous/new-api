import { nanoid } from 'nanoid'
import { MESSAGE_ROLES, MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import type {
  Message,
  MessageVersion,
  ChatCompletionMessage,
  ContentPart,
} from '../types'

/**
 * Create a new message version
 */
export function createMessageVersion(content: string): MessageVersion {
  return {
    id: nanoid(),
    content,
  }
}

/**
 * Get current version from message (always returns the first version)
 */
export function getCurrentVersion(message: Message): MessageVersion {
  return message.versions[0] || { id: 'default', content: '' }
}

/**
 * Update current version content in message
 */
export function updateCurrentVersionContent(
  message: Message,
  content: string
): Message {
  const currentVersion = getCurrentVersion(message)
  return {
    ...message,
    versions: [{ ...currentVersion, content }],
  }
}

/**
 * Create a user message
 */
export function createUserMessage(content: string): Message {
  return {
    key: nanoid(),
    from: MESSAGE_ROLES.USER,
    versions: [createMessageVersion(content)],
  }
}

/**
 * Create a loading assistant message
 */
export function createLoadingAssistantMessage(): Message {
  return {
    key: nanoid(),
    from: MESSAGE_ROLES.ASSISTANT,
    versions: [createMessageVersion('')],
    reasoning: undefined,
    isReasoningComplete: false,
    isContentComplete: false,
    isReasoningStreaming: false,
    status: MESSAGE_STATUS.LOADING,
  }
}

/**
 * Build message content with optional images
 */
export function buildMessageContent(
  text: string,
  imageUrls: string[] = []
): string | ContentPart[] {
  const validImages = imageUrls.filter((url) => url.trim() !== '')

  if (validImages.length === 0) {
    return text
  }

  const parts: ContentPart[] = [
    {
      type: 'text',
      text: text || '',
    },
    ...validImages.map((url) => ({
      type: 'image_url' as const,
      image_url: { url: url.trim() },
    })),
  ]

  return parts
}

/**
 * Extract text content from message content
 */
export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const textPart = content.find((part) => part.type === 'text')
    return textPart?.text || ''
  }

  return ''
}

/**
 * Format message for API request
 */
export function formatMessageForAPI(message: Message): ChatCompletionMessage {
  const currentVersion = getCurrentVersion(message)
  return {
    role: message.from,
    content: currentVersion.content,
  }
}

/**
 * Check if message is valid for API request
 */
export function isValidMessage(message: Message): boolean {
  return (
    message &&
    message.from &&
    message.versions.length > 0 &&
    message.versions[0].content !== undefined
  )
}

/**
 * Extract and remove <think> tags from content
 * @param content - The content to process
 * @returns Object with cleaned content and extracted thinking content
 */
export function extractThinkTags(content: string): {
  cleanContent: string
  thinkingContent: string
} {
  if (!content.includes('<think>')) {
    return { cleanContent: content, thinkingContent: '' }
  }

  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  const thoughts: string[] = []

  // Extract all thinking content
  let match
  while ((match = thinkRegex.exec(content)) !== null) {
    thoughts.push(match[1].trim())
  }

  // Remove all think tags from content (create new regex to avoid state issues)
  const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  return {
    cleanContent,
    thinkingContent: thoughts.join('\n\n'),
  }
}

/**
 * Update the last assistant message with an error
 * @param messages - Current messages array
 * @param errorMessage - Error message to display
 * @returns Updated messages array
 */
export function updateAssistantMessageWithError(
  messages: Message[],
  errorMessage: string
): Message[] {
  return updateLastAssistantMessage(messages, (message) => {
    const updatedMessage = updateCurrentVersionContent(
      message,
      `${ERROR_MESSAGES.API_REQUEST_ERROR}: ${errorMessage}`
    )
    return {
      ...updatedMessage,
      status: MESSAGE_STATUS.ERROR,
      isReasoningStreaming: false,
    }
  })
}

/**
 * Helper function to update the last assistant message
 * @param messages - Current messages array
 * @param updater - Function to update the message
 * @returns Updated messages array or original if no assistant message found
 */
export function updateLastAssistantMessage(
  messages: Message[],
  updater: (message: Message) => Message
): Message[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  if (!last || last.from !== MESSAGE_ROLES.ASSISTANT) return messages

  const updated = [...messages]
  updated[updated.length - 1] = updater(last)
  return updated
}

/**
 * Merge reasoning content, combining existing and new content
 */
export function mergeReasoningContent(
  existingContent: string,
  newContent: string
): string {
  if (!existingContent) return newContent
  if (!newContent) return existingContent
  return `${existingContent}\n\n${newContent}`
}

/**
 * Process message content with think tags
 * Updates content and reasoning based on extracted think tags
 */
export function processMessageWithThinkTags(
  message: Message,
  newContentChunk?: string
): Message {
  const currentVersion = getCurrentVersion(message)
  const contentToProcess = newContentChunk
    ? currentVersion.content + newContentChunk
    : currentVersion.content

  // First, remove any fully paired <think>...</think> blocks
  const { cleanContent, thinkingContent } = extractThinkTags(contentToProcess)

  // Detect an unclosed <think> at the end (streaming case)
  const lastOpenThinkIndex = cleanContent.lastIndexOf('<think>')
  const lastCloseThinkIndex = cleanContent.lastIndexOf('</think>')

  // If there is an open <think> without a matching closing tag after it,
  // treat everything after it as streaming reasoning content and do not render it in the main message.
  if (lastOpenThinkIndex !== -1 && lastOpenThinkIndex > lastCloseThinkIndex) {
    const partialReasoning = cleanContent
      .substring(lastOpenThinkIndex + 7)
      .trim()
    const contentWithoutStreamingThink = cleanContent
      .substring(0, lastOpenThinkIndex)
      .trim()

    // Build updated message content without the streaming <think>
    let nextMessage = updateCurrentVersionContent(
      message,
      contentWithoutStreamingThink
    )

    // Merge partial reasoning with any existing reasoning
    const mergedReasoning = mergeReasoningContent(
      nextMessage.reasoning?.content || '',
      partialReasoning
    )

    return {
      ...nextMessage,
      reasoning: mergedReasoning
        ? {
            content: mergedReasoning,
            duration: nextMessage.reasoning?.duration || 0,
          }
        : nextMessage.reasoning,
      isReasoningStreaming: true,
    }
  }

  const updatedMessage = updateCurrentVersionContent(message, cleanContent)

  // Update reasoning if paired think content was extracted
  if (thinkingContent) {
    return {
      ...updatedMessage,
      reasoning: {
        content: thinkingContent,
        duration: message.reasoning?.duration || 0,
      },
      isReasoningStreaming: true,
    }
  }

  // Mark reasoning as complete when content starts (no more think tags)
  if (message.reasoning && message.isReasoningStreaming && cleanContent) {
    return {
      ...updatedMessage,
      isReasoningStreaming: false,
    }
  }

  return updatedMessage
}

/**
 * Finalize message with reasoning content
 * Extracts think tags and merges with existing reasoning
 */
export function finalizeMessageReasoning(
  message: Message,
  additionalReasoningContent?: string
): Message {
  // Extract any <think> tags from content
  const currentVersion = getCurrentVersion(message)
  const { cleanContent, thinkingContent } = extractThinkTags(
    currentVersion.content
  )

  // Merge thinking content with existing reasoning if any
  const existingReasoning = message.reasoning?.content || ''
  const combinedReasoning = mergeReasoningContent(
    existingReasoning,
    additionalReasoningContent || thinkingContent
  )

  return {
    ...updateCurrentVersionContent(message, cleanContent),
    reasoning: combinedReasoning
      ? {
          content: combinedReasoning,
          duration: message.reasoning?.duration || 0,
        }
      : message.reasoning,
    isReasoningStreaming: false,
  }
}

/**
 * Handle incomplete think tags during stream stop
 * Extracts content from unclosed tags
 */
export function handleIncompleteThinkTags(message: Message): Message {
  const currentVersion = getCurrentVersion(message)
  const currentContent = currentVersion.content
  const { cleanContent, thinkingContent } = extractThinkTags(currentContent)

  // Handle incomplete <think> tag
  const lastThinkIndex = currentContent.lastIndexOf('<think>')
  const hasUnclosedThink =
    lastThinkIndex !== -1 &&
    !currentContent.substring(lastThinkIndex).includes('</think>')

  const existingReasoning = message.reasoning?.content || ''
  let finalContent = cleanContent
  let finalReasoning = existingReasoning

  if (hasUnclosedThink) {
    // Extract content from unclosed think tag
    const unclosedContent = currentContent.substring(lastThinkIndex + 7).trim()
    finalReasoning = mergeReasoningContent(existingReasoning, unclosedContent)
    finalContent = currentContent.substring(0, lastThinkIndex).trim()
  } else if (thinkingContent) {
    // Merge extracted thinking content with existing reasoning
    finalReasoning = mergeReasoningContent(existingReasoning, thinkingContent)
  }

  return {
    ...updateCurrentVersionContent(message, finalContent),
    reasoning: finalReasoning
      ? {
          content: finalReasoning,
          duration: message.reasoning?.duration || 0,
        }
      : message.reasoning,
    isReasoningStreaming: false,
  }
}
