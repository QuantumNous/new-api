import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
  type ContentBlock,
  type ToolCall,
  type BaseMessage,
  type BaseMessageChunk,
  type ToolCallChunk,
} from '@langchain/core/messages';
import type {
  UIMessageChunk,
  ToolResultPart,
  AssistantContent,
  UserContent,
  ProviderMetadata,
  JSONValue,
} from 'ai';

import type {
  LangGraphEventState,
  LangGraphMessageSeen,
  ReasoningContentBlock,
  ThinkingContentBlock,
  GPT5ReasoningOutput,
  ImageGenerationOutput,
  NormalizedCitation,
} from './types';

/**
 * Parses a LangGraph event tuple into [type, data].
 * Handles both 2-element [type, data] and 3-element [namespace, type, data] formats.
 *
 * @param event - The raw LangGraph event array.
 * @returns A tuple of [type, data].
 */
export function parseLangGraphEvent(
  event: unknown[],
): [type: unknown, data: unknown] {
  return event.length === 3 ? [event[1], event[2]] : [event[0], event[1]];
}

/**
 * Converts a ToolResultPart to a LangChain ToolMessage
 * @param block - The ToolResultPart to convert.
 * @returns The converted ToolMessage.
 */
export function convertToolResultPart(block: ToolResultPart): ToolMessage {
  const content = (() => {
    if (block.output.type === 'text' || block.output.type === 'error-text') {
      return block.output.value;
    }

    if (block.output.type === 'json' || block.output.type === 'error-json') {
      return JSON.stringify(block.output.value);
    }

    if (block.output.type === 'content') {
      return block.output.value
        .map(outputBlock => {
          if (outputBlock.type === 'text') {
            return outputBlock.text;
          }
          return '';
        })
        .join('');
    }

    return '';
  })();

  return new ToolMessage({
    tool_call_id: block.toolCallId,
    content,
  });
}

/**
 * Converts AssistantContent to LangChain AIMessage
 * @param content - The AssistantContent to convert.
 * @returns The converted AIMessage.
 */
export function convertAssistantContent(content: AssistantContent): AIMessage {
  if (typeof content === 'string') {
    return new AIMessage({ content });
  }

  const textParts: string[] = [];
  const toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }> = [];

  for (const part of content) {
    if (part.type === 'text') {
      textParts.push(part.text);
    } else if (part.type === 'tool-call') {
      toolCalls.push({
        id: part.toolCallId,
        name: part.toolName,
        args: part.input as Record<string, unknown>,
      });
    }
  }

  return new AIMessage({
    content: textParts.join(''),
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  });
}

/**
 * Helper to generate a default filename from mediaType
 */
function getDefaultFilename(
  mediaType: string,
  prefix: string = 'file',
): string {
  const fileExtension = mediaType.split('/')[1] || 'bin';
  return `${prefix}.${fileExtension}`;
}

/**
 * OpenAI-native content block type for images.
 * This format is passed through directly by ChatOpenAI to OpenAI's API.
 */
type OpenAIImageBlock = {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
};

/**
 * Content block type for HumanMessage that supports both text and OpenAI images.
 */
type HumanMessageContentBlock =
  | { type: 'text'; text: string }
  | OpenAIImageBlock
  | ContentBlock;

/**
 * Converts UserContent to LangChain HumanMessage
 * @param content - The UserContent to convert.
 * @returns The converted HumanMessage.
 */
export function convertUserContent(content: UserContent): HumanMessage {
  if (typeof content === 'string') {
    return new HumanMessage({ content });
  }

  const contentBlocks: HumanMessageContentBlock[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      contentBlocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'image') {
      const imagePart = part as {
        type: 'image';
        image: string | Uint8Array | URL | ArrayBuffer;
        mediaType?: string;
      };

      /**
       * Use OpenAI's native image_url format which is passed through directly
       * handle URL objects
       */
      if (imagePart.image instanceof URL) {
        contentBlocks.push({
          type: 'image_url',
          image_url: { url: imagePart.image.toString() },
        });
      } else if (typeof imagePart.image === 'string') {
        /**
         * Handle string (could be URL or base64)
         */
        /**
         * Check if it's a URL (including data: URLs)
         */
        if (
          imagePart.image.startsWith('http://') ||
          imagePart.image.startsWith('https://') ||
          imagePart.image.startsWith('data:')
        ) {
          /**
           * OpenAI accepts both http URLs and data URLs directly
           */
          contentBlocks.push({
            type: 'image_url',
            image_url: { url: imagePart.image },
          });
        } else {
          /**
           * Assume base64 encoded data - wrap in data URL
           */
          const mimeType = imagePart.mediaType || 'image/png';
          contentBlocks.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imagePart.image}` },
          });
        }
      } else if (
        /**
         * Handle Uint8Array or ArrayBuffer (binary data)
         */
        imagePart.image instanceof Uint8Array ||
        imagePart.image instanceof ArrayBuffer
      ) {
        const bytes =
          imagePart.image instanceof ArrayBuffer
            ? new Uint8Array(imagePart.image)
            : imagePart.image;
        /**
         * Convert to base64 data URL
         */
        const base64 = btoa(String.fromCharCode(...bytes));
        const mimeType = imagePart.mediaType || 'image/png';
        contentBlocks.push({
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}` },
        });
      }
    } else if (part.type === 'file') {
      const rawFilePart = part as {
        type: 'file';
        data:
          | string
          | Uint8Array
          | URL
          | ArrayBuffer
          | { type: 'data'; data: string | Uint8Array | ArrayBuffer }
          | { type: 'url'; url: URL }
          | { type: 'reference'; reference: Record<string, string> }
          | { type: 'text'; text: string };
        mediaType: string;
        filename?: string;
      };

      // Normalize tagged data shape into the legacy bare value this code expects.
      const normalizedData: string | Uint8Array | URL | ArrayBuffer = (() => {
        const data = rawFilePart.data;
        if (
          typeof data === 'object' &&
          data !== null &&
          !(data instanceof URL) &&
          !(data instanceof Uint8Array) &&
          !(data instanceof ArrayBuffer) &&
          'type' in data
        ) {
          switch (data.type) {
            case 'data':
              return data.data;
            case 'url':
              return data.url;
            case 'text':
              return data.text;
            default:
              return '';
          }
        }
        return data as string | Uint8Array | URL | ArrayBuffer;
      })();

      const filePart = {
        type: 'file' as const,
        data: normalizedData,
        mediaType: rawFilePart.mediaType,
        filename: rawFilePart.filename,
      };

      /**
       * Check if this is an image file - if so, use OpenAI's image_url format
       */
      const isImage = filePart.mediaType?.startsWith('image/');

      if (isImage) {
        /**
         * Handle image files using OpenAI's native image_url format
         */
        if (filePart.data instanceof URL) {
          contentBlocks.push({
            type: 'image_url',
            image_url: { url: filePart.data.toString() },
          });
        } else if (typeof filePart.data === 'string') {
          /**
           * URLs (including data URLs) can be passed directly
           */
          if (
            filePart.data.startsWith('http://') ||
            filePart.data.startsWith('https://') ||
            filePart.data.startsWith('data:')
          ) {
            contentBlocks.push({
              type: 'image_url',
              image_url: { url: filePart.data },
            });
          } else {
            /**
             * Assume base64 - wrap in data URL
             */
            contentBlocks.push({
              type: 'image_url',
              image_url: {
                url: `data:${filePart.mediaType};base64,${filePart.data}`,
              },
            });
          }
        } else if (
          filePart.data instanceof Uint8Array ||
          filePart.data instanceof ArrayBuffer
        ) {
          const bytes =
            filePart.data instanceof ArrayBuffer
              ? new Uint8Array(filePart.data)
              : filePart.data;
          const base64 = btoa(String.fromCharCode(...bytes));
          contentBlocks.push({
            type: 'image_url',
            image_url: { url: `data:${filePart.mediaType};base64,${base64}` },
          });
        }
      } else {
        // Handle non-image files using LangChain's ContentBlock format
        const filename =
          filePart.filename || getDefaultFilename(filePart.mediaType, 'file');

        if (filePart.data instanceof URL) {
          contentBlocks.push({
            type: 'file',
            url: filePart.data.toString(),
            mimeType: filePart.mediaType,
            filename,
          });
        } else if (typeof filePart.data === 'string') {
          if (
            filePart.data.startsWith('http://') ||
            filePart.data.startsWith('https://')
          ) {
            contentBlocks.push({
              type: 'file',
              url: filePart.data,
              mimeType: filePart.mediaType,
              filename,
            });
          } else if (filePart.data.startsWith('data:')) {
            const matches = filePart.data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              contentBlocks.push({
                type: 'file',
                data: matches[2],
                mimeType: matches[1],
                filename,
              });
            } else {
              contentBlocks.push({
                type: 'file',
                url: filePart.data,
                mimeType: filePart.mediaType,
                filename,
              });
            }
          } else {
            contentBlocks.push({
              type: 'file',
              data: filePart.data,
              mimeType: filePart.mediaType,
              filename,
            });
          }
        } else if (
          filePart.data instanceof Uint8Array ||
          filePart.data instanceof ArrayBuffer
        ) {
          const bytes =
            filePart.data instanceof ArrayBuffer
              ? new Uint8Array(filePart.data)
              : filePart.data;
          const base64 = btoa(String.fromCharCode(...bytes));
          contentBlocks.push({
            type: 'file',
            data: base64,
            mimeType: filePart.mediaType,
            filename,
          });
        }
      }
    }
  }

  /**
   * If we only have text parts, join them as a simple string for efficiency
   */
  if (contentBlocks.every(block => block.type === 'text')) {
    return new HumanMessage({
      content: contentBlocks
        .map(block => (block as unknown as { text: string }).text)
        .join(''),
    });
  }

  return new HumanMessage({ content: contentBlocks });
}

/**
 * Helper to check if a content item is a ToolResultPart
 * @param item - The item to check.
 * @returns True if the item is a ToolResultPart, false otherwise.
 */
export function isToolResultPart(item: unknown): item is ToolResultPart {
  return (
    item != null &&
    typeof item === 'object' &&
    'type' in item &&
    (item as { type: string }).type === 'tool-result'
  );
}

/**
 * Processes a model stream chunk and emits UI message chunks.
 * @param chunk - The AIMessageChunk to process.
 * @param state - The state of the model stream.
 * @param controller - The controller to use to emit the UI message chunks.
 */
export function processModelChunk(
  chunk: AIMessageChunk,
  state: {
    started: boolean;
    messageId: string;
    reasoningStarted?: boolean;
    textStarted?: boolean;
    /** Track the ID used for reasoning-start to ensure reasoning-end uses the same ID */
    reasoningMessageId?: string | null;
    /** Track the ID used for text-start to ensure text-end uses the same ID */
    textMessageId?: string | null;
    emittedImages?: Set<string>;
    emittedSourceIds?: Set<string>;
  },
  controller: ReadableStreamDefaultController<UIMessageChunk>,
): void {
  /**
   * Initialize emittedImages set if not present
   */
  if (!state.emittedImages) {
    state.emittedImages = new Set<string>();
  }

  if (!state.emittedSourceIds) {
    state.emittedSourceIds = new Set<string>();
  }

  /**
   * Get the message ID from the chunk if available
   */
  if (chunk.id) {
    state.messageId = chunk.id;
  }

  /**
   * Handle image generation outputs from additional_kwargs.tool_outputs
   */
  const chunkObj = chunk as unknown as Record<string, unknown>;
  const additionalKwargs = chunkObj.additional_kwargs as
    | Record<string, unknown>
    | undefined;
  const imageOutputs = extractImageOutputs(additionalKwargs);

  for (const imageOutput of imageOutputs) {
    /**
     * Only emit if we have image data and haven't emitted this image yet
     */
    if (imageOutput.result && !state.emittedImages.has(imageOutput.id)) {
      state.emittedImages.add(imageOutput.id);

      /**
       * Emit as a file part using proper AI SDK multimodal format
       */
      const mediaType = `image/${imageOutput.output_format || 'png'}`;
      controller.enqueue({
        type: 'file',
        mediaType,
        url: `data:${mediaType};base64,${imageOutput.result}`,
      });
      state.started = true;
    }
  }

  /**
   * Handle reasoning content from contentBlocks or response_metadata.output
   * For direct model streams, we check both sources since there's no values event
   * that would cause duplication (unlike LangGraph streams)
   */
  const reasoning =
    extractReasoningFromContentBlocks(chunk) ||
    extractReasoningFromValuesMessage(chunk);
  if (reasoning) {
    if (!state.reasoningStarted) {
      // Track the ID used for reasoning-start to ensure subsequent chunks use the same ID
      state.reasoningMessageId = state.messageId;
      controller.enqueue({ type: 'reasoning-start', id: state.messageId });
      state.reasoningStarted = true;
      state.started = true;
    }
    controller.enqueue({
      type: 'reasoning-delta',
      delta: reasoning,
      id: state.reasoningMessageId ?? state.messageId,
    });
  }

  /**
   * Extract text content from AIMessageChunk
   */
  const text =
    typeof chunk.content === 'string'
      ? chunk.content
      : Array.isArray(chunk.content)
        ? chunk.content
            .filter(
              (c): c is { type: 'text'; text: string } =>
                typeof c === 'object' &&
                c !== null &&
                'type' in c &&
                c.type === 'text',
            )
            .map(c => c.text)
            .join('')
        : '';

  if (text) {
    /**
     * If reasoning was streamed before text, close reasoning first
     */
    if (state.reasoningStarted && !state.textStarted) {
      controller.enqueue({
        type: 'reasoning-end',
        id: state.reasoningMessageId ?? state.messageId,
      });
      state.reasoningStarted = false;
    }

    if (!state.textStarted) {
      // Track the ID used for text-start to ensure subsequent chunks use the same ID
      state.textMessageId = state.messageId;
      controller.enqueue({ type: 'text-start', id: state.messageId });
      state.textStarted = true;
      state.started = true;
    }
    controller.enqueue({
      type: 'text-delta',
      delta: text,
      id: state.textMessageId ?? state.messageId,
    });
  }

  const citations = extractCitationsFromContentBlocks(chunk);
  if (citations.length > 0) {
    emitSourceChunks(
      citations,
      state.messageId,
      state.emittedSourceIds,
      controller,
    );
  }
}

/**
 * Checks if a message is a plain object (not a LangChain class instance).
 * LangChain class instances have a _getType method.
 *
 * @param msg - The message to check.
 * @returns True if the message is a plain object, false otherwise.
 */
export function isPlainMessageObject(msg: unknown): boolean {
  if (msg == null || typeof msg !== 'object') return false;
  /**
   * LangChain class instances have _getType method
   */
  return typeof (msg as { _getType?: unknown })._getType !== 'function';
}

/**
 * Extracts the actual message ID from a message.
 * Handles both class instances (msg.id) and serialized LangChain messages (msg.kwargs.id).
 *
 * @param msg - The message to extract the ID from.
 * @returns The message ID string, or undefined if not found.
 */
export function getMessageId(msg: unknown): string | undefined {
  if (msg == null || typeof msg !== 'object') return undefined;

  const msgObj = msg as Record<string, unknown>;

  /**
   * For class instances, id is directly on the object
   */
  if (typeof msgObj.id === 'string') {
    return msgObj.id;
  }

  /**
   * For serialized LangChain messages, id is in kwargs
   */
  if (
    msgObj.type === 'constructor' &&
    msgObj.kwargs &&
    typeof msgObj.kwargs === 'object'
  ) {
    const kwargs = msgObj.kwargs as Record<string, unknown>;
    if (typeof kwargs.id === 'string') {
      return kwargs.id;
    }
  }

  return undefined;
}

/**
 * Checks if a message is an AI message chunk (works for both class instances and plain objects).
 * For class instances, only AIMessageChunk is matched (not AIMessage).
 * For plain objects from RemoteGraph API, matches type === 'ai' (TypeScript langchain-core)
 * or type === 'AIMessageChunk' (Python langchain-core).
 * For serialized LangChain messages, matches type === 'constructor' with AIMessageChunk in id path.
 *
 * @param msg - The message to check.
 * @returns True if the message is an AI message chunk, false otherwise.
 */
export function isAIMessageChunk(
  msg: unknown,
): msg is AIMessageChunk & { type?: string; content?: string } {
  /**
   * Actual AIMessageChunk class instance
   */
  if (AIMessageChunk.isInstance(msg)) return true;
  /**
   * Plain object from RemoteGraph API (not a LangChain class instance)
   */
  if (isPlainMessageObject(msg)) {
    const messageRecord = msg as Record<string, unknown>;
    /**
     * Direct type from RemoteGraph format. TypeScript langchain-core emits
     * type === 'ai'; Python langchain-core emits type === 'AIMessageChunk'.
     */
    if (
      'type' in messageRecord &&
      (messageRecord.type === 'ai' || messageRecord.type === 'AIMessageChunk')
    ) {
      return true;
    }
    /**
     * Serialized LangChain message format: { lc: 1, type: "constructor", id: ["...", "AIMessageChunk"], kwargs: {...} }
     */
    if (
      messageRecord.type === 'constructor' &&
      Array.isArray(messageRecord.id) &&
      (messageRecord.id.includes('AIMessageChunk') ||
        messageRecord.id.includes('AIMessage'))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a message is a Tool message (works for both class instances and plain objects).
 *
 * @param msg - The message to check.
 * @returns True if the message is a Tool message, false otherwise.
 */
export function isToolMessageType(
  msg: unknown,
): msg is ToolMessage & { type?: string; tool_call_id?: string } {
  if (ToolMessage.isInstance(msg)) return true;
  /**
   * Plain object from RemoteGraph API (not a LangChain class instance)
   */
  if (isPlainMessageObject(msg)) {
    const messageRecord = msg as Record<string, unknown>;
    /**
     * Direct type === 'tool' (RemoteGraph format)
     */
    if ('type' in messageRecord && messageRecord.type === 'tool') return true;
    /**
     * Serialized LangChain message format
     */
    if (
      messageRecord.type === 'constructor' &&
      Array.isArray(messageRecord.id) &&
      messageRecord.id.includes('ToolMessage')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Gets text content from a message (works for both class instances and plain objects).
 *
 * @param msg - The message to get the text from.
 * @returns The text content of the message.
 */
export function getMessageText(msg: unknown): string {
  if (AIMessageChunk.isInstance(msg)) {
    return msg.text ?? '';
  }

  if (msg == null || typeof msg !== 'object') return '';

  const msgObj = msg as Record<string, unknown>;

  // For serialized LangChain messages, content is in kwargs
  const dataSource =
    msgObj.type === 'constructor' &&
    msgObj.kwargs &&
    typeof msgObj.kwargs === 'object'
      ? (msgObj.kwargs as Record<string, unknown>)
      : msgObj;

  if ('content' in dataSource) {
    const content = dataSource.content;
    /**
     * Handle string content
     */
    if (typeof content === 'string') {
      return content;
    }
    /**
     * Handle array of content blocks (e.g., [{ type: 'text', text: 'The', index: 0 }])
     */
    if (Array.isArray(content)) {
      return content
        .filter(
          (block): block is { type: 'text'; text: string } =>
            block != null &&
            typeof block === 'object' &&
            block.type === 'text' &&
            typeof block.text === 'string',
        )
        .map(block => block.text)
        .join('');
    }
    return '';
  }
  return '';
}

/**
 * Checks if an object is a reasoning content block
 *
 * @param obj - The object to check.
 * @returns True if the object is a reasoning content block, false otherwise.
 */
export function isReasoningContentBlock(
  obj: unknown,
): obj is ReasoningContentBlock {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj as { type: string }).type === 'reasoning' &&
    'reasoning' in obj &&
    typeof (obj as { reasoning: unknown }).reasoning === 'string'
  );
}

/**
 * Checks if an object is a thinking content block (Anthropic-style)
 *
 * @param obj - The object to check.
 * @returns True if the object is a thinking content block, false otherwise.
 */
export function isThinkingContentBlock(
  obj: unknown,
): obj is ThinkingContentBlock {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj as { type: string }).type === 'thinking' &&
    'thinking' in obj &&
    typeof (obj as { thinking: unknown }).thinking === 'string'
  );
}

/**
 * Checks if an object is a GPT-5 reasoning output block
 */
function isGPT5ReasoningOutput(obj: unknown): obj is GPT5ReasoningOutput {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj as { type: string }).type === 'reasoning' &&
    'summary' in obj &&
    Array.isArray((obj as { summary: unknown }).summary)
  );
}

/**
 * Extracts the reasoning block ID from a message (GPT-5 format).
 * This ID is consistent across streaming and values events.
 * Handles both class instances and serialized LangChain message objects.
 *
 * @param msg - The message to extract the reasoning ID from.
 * @returns The reasoning block ID if found, undefined otherwise.
 */
export function extractReasoningId(msg: unknown): string | undefined {
  if (msg == null || typeof msg !== 'object') return undefined;

  // For serialized LangChain messages, the data is in kwargs
  const msgObj = msg as Record<string, unknown>;
  const kwargs =
    msgObj.kwargs && typeof msgObj.kwargs === 'object'
      ? (msgObj.kwargs as Record<string, unknown>)
      : msgObj;

  // Check additional_kwargs.reasoning.id (GPT-5 streaming format)
  const additionalKwargs = (
    kwargs as { additional_kwargs?: { reasoning?: { id?: string } } }
  ).additional_kwargs;
  if (additionalKwargs?.reasoning?.id) {
    return additionalKwargs.reasoning.id;
  }

  // Check response_metadata.output for reasoning block ID (GPT-5 final format)
  const responseMetadata = (
    kwargs as { response_metadata?: { output?: unknown[] } }
  ).response_metadata;
  if (responseMetadata && Array.isArray(responseMetadata.output)) {
    for (const item of responseMetadata.output) {
      if (isGPT5ReasoningOutput(item)) {
        return item.id;
      }
    }
  }

  return undefined;
}

/**
 * Extracts reasoning content from contentBlocks or additional_kwargs.reasoning.summary
 *
 * IMPORTANT: This function is designed for STREAMING chunks where content is delta-based.
 * It does NOT extract from response_metadata.output because that contains accumulated
 * content (not deltas) and would cause duplication during streaming.
 *
 * For non-streaming/values events, use extractReasoningFromValuesMessage instead.
 *
 * Handles both class instances and serialized LangChain message objects.
 *
 * @param msg - The message to extract reasoning from.
 * @returns The reasoning text if found, undefined otherwise.
 */
export function extractReasoningFromContentBlocks(
  msg: unknown,
): string | undefined {
  if (msg == null || typeof msg !== 'object') return undefined;

  // For serialized LangChain messages, the data is in kwargs
  const msgObj = msg as Record<string, unknown>;
  const kwargs =
    msgObj.kwargs && typeof msgObj.kwargs === 'object'
      ? (msgObj.kwargs as Record<string, unknown>)
      : msgObj;

  // Check contentBlocks (Anthropic-style) - highest priority
  const contentBlocks = (kwargs as { contentBlocks?: unknown[] }).contentBlocks;
  if (Array.isArray(contentBlocks)) {
    const reasoningParts: string[] = [];
    for (const block of contentBlocks) {
      if (isReasoningContentBlock(block)) {
        reasoningParts.push(block.reasoning);
      } else if (isThinkingContentBlock(block)) {
        reasoningParts.push(block.thinking);
      }
    }
    if (reasoningParts.length > 0) {
      return reasoningParts.join('');
    }
  }

  // Check additional_kwargs.reasoning.summary (GPT-5 streaming format)
  // This contains DELTA content during streaming, not accumulated content
  // Format can be either { type: "summary_text", text: "..." } or just { text: "..." }
  const additionalKwargs = (
    kwargs as { additional_kwargs?: { reasoning?: { summary?: unknown[] } } }
  ).additional_kwargs;
  if (
    additionalKwargs?.reasoning &&
    Array.isArray(additionalKwargs.reasoning.summary)
  ) {
    const reasoningParts: string[] = [];
    for (const summaryItem of additionalKwargs.reasoning.summary) {
      if (
        typeof summaryItem === 'object' &&
        summaryItem !== null &&
        'text' in summaryItem &&
        typeof (summaryItem as { text: unknown }).text === 'string'
      ) {
        reasoningParts.push((summaryItem as { text: string }).text);
      }
    }
    if (reasoningParts.length > 0) {
      return reasoningParts.join('');
    }
  }

  return undefined;
}

/**
 * Extracts reasoning content from a values event message.
 * This checks response_metadata.output which contains the full accumulated reasoning.
 *
 * @param msg - The message to extract reasoning from.
 * @returns The reasoning text if found, undefined otherwise.
 */
export function extractReasoningFromValuesMessage(
  msg: unknown,
): string | undefined {
  if (msg == null || typeof msg !== 'object') return undefined;

  // For serialized LangChain messages, the data is in kwargs
  const msgObj = msg as Record<string, unknown>;
  const kwargs =
    msgObj.kwargs && typeof msgObj.kwargs === 'object'
      ? (msgObj.kwargs as Record<string, unknown>)
      : msgObj;

  // Check response_metadata.output (GPT-5 final style) - for values events
  const responseMetadata = (
    kwargs as { response_metadata?: { output?: unknown[] } }
  ).response_metadata;
  if (responseMetadata && Array.isArray(responseMetadata.output)) {
    const reasoningParts: string[] = [];
    for (const item of responseMetadata.output) {
      if (isGPT5ReasoningOutput(item)) {
        // Extract text from summary array - handles both { type: "summary_text", text } and { text } formats
        for (const summaryItem of item.summary) {
          if (typeof summaryItem === 'object' && summaryItem !== null) {
            const text = (summaryItem as { text?: string }).text;
            if (typeof text === 'string' && text) {
              reasoningParts.push(text);
            }
          }
        }
      }
    }
    if (reasoningParts.length > 0) {
      return reasoningParts.join('');
    }
  }

  // Also check additional_kwargs.reasoning.summary as fallback
  const additionalKwargs = (
    kwargs as { additional_kwargs?: { reasoning?: { summary?: unknown[] } } }
  ).additional_kwargs;
  if (
    additionalKwargs?.reasoning &&
    Array.isArray(additionalKwargs.reasoning.summary)
  ) {
    const reasoningParts: string[] = [];
    for (const summaryItem of additionalKwargs.reasoning.summary) {
      if (
        typeof summaryItem === 'object' &&
        summaryItem !== null &&
        'text' in summaryItem &&
        typeof (summaryItem as { text: unknown }).text === 'string'
      ) {
        reasoningParts.push((summaryItem as { text: string }).text);
      }
    }
    if (reasoningParts.length > 0) {
      return reasoningParts.join('');
    }
  }

  return undefined;
}

export function isCitationContentBlock(
  obj: unknown,
): obj is ContentBlock.Citation {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj as { type: unknown }).type === 'citation'
  );
}

/**
 * LangChain Core standardizes citations as `{ type: 'citation', ... }` entries in
 * the `annotations` array of a text content block. The text extractors elsewhere
 * in this file only read the `text` field, so without this the citations would be
 * dropped instead of surfaced as AI SDK source parts.
 *
 * Handles both class instances and serialized LangChain message objects.
 */
export function extractCitationsFromContentBlocks(
  msg: unknown,
): NormalizedCitation[] {
  if (msg == null || typeof msg !== 'object') return [];

  const msgObj = msg as Record<string, unknown>;
  const kwargs =
    msgObj.kwargs && typeof msgObj.kwargs === 'object'
      ? (msgObj.kwargs as Record<string, unknown>)
      : msgObj;

  // `contentBlocks` is the normalized view derived from `content`; reading both
  // would double-count annotations, so prefer it and only fall back to `content`.
  const contentBlocks = (kwargs as { contentBlocks?: unknown }).contentBlocks;
  const content = (kwargs as { content?: unknown }).content;
  const blockSources: unknown[] = Array.isArray(contentBlocks)
    ? contentBlocks
    : Array.isArray(content)
      ? content
      : [];

  const citations: NormalizedCitation[] = [];

  for (const block of blockSources) {
    if (block == null || typeof block !== 'object') continue;

    const annotations = (block as { annotations?: unknown }).annotations;
    if (!Array.isArray(annotations)) continue;

    for (const annotation of annotations) {
      if (!isCitationContentBlock(annotation)) continue;

      citations.push({
        url: annotation.url,
        title: annotation.title,
        source: annotation.source,
        citedText: annotation.citedText,
        startIndex: annotation.startIndex,
        endIndex: annotation.endIndex,
      });
    }
  }

  return citations;
}

function buildSourceProviderMetadata(
  citation: NormalizedCitation,
): ProviderMetadata | undefined {
  const langchain: Record<string, JSONValue> = {};

  if (typeof citation.citedText === 'string') {
    langchain.citedText = citation.citedText;
  }
  if (typeof citation.startIndex === 'number') {
    langchain.startIndex = citation.startIndex;
  }
  if (typeof citation.endIndex === 'number') {
    langchain.endIndex = citation.endIndex;
  }
  if (typeof citation.source === 'string') {
    langchain.source = citation.source;
  }

  if (Object.keys(langchain).length === 0) {
    return undefined;
  }

  return { langchain };
}

/**
 * Emits AI SDK source chunks (`source-url` / `source-document`) for the given
 * citations.
 *
 * Citations with a `url` become `source-url` parts keyed by that url; the rest
 * become `source-document` parts. Citation metadata that the source parts cannot
 * represent natively (`citedText`, `startIndex`, `endIndex`, `source`) is preserved
 * under `providerMetadata.langchain`.
 *
 * `emittedSourceIds` dedupes across the LangGraph messages and values events, which
 * can each surface the same citation. URL-less citations are keyed by their content
 * rather than position, so a differing citation subset/order between those two events
 * does not cause an id collision.
 */
export function emitSourceChunks(
  citations: NormalizedCitation[],
  messageId: string,
  emittedSourceIds: Set<string>,
  controller: ReadableStreamDefaultController<UIMessageChunk>,
): void {
  for (const citation of citations) {
    if (citation.url) {
      if (emittedSourceIds.has(citation.url)) continue;
      emittedSourceIds.add(citation.url);

      const providerMetadata = buildSourceProviderMetadata(citation);
      controller.enqueue({
        type: 'source-url',
        sourceId: citation.url,
        url: citation.url,
        ...(citation.title ? { title: citation.title } : {}),
        ...(providerMetadata ? { providerMetadata } : {}),
      });
      continue;
    }

    // A citation with no url and no human-readable label carries no information a
    // UI could render, so skip it rather than emit a placeholder source.
    const title = citation.title ?? citation.source;
    if (!title) continue;

    const sourceId = `${messageId}:${title}:${citation.citedText ?? ''}:${citation.startIndex ?? ''}:${citation.endIndex ?? ''}`;
    if (emittedSourceIds.has(sourceId)) continue;
    emittedSourceIds.add(sourceId);

    const providerMetadata = buildSourceProviderMetadata(citation);
    controller.enqueue({
      type: 'source-document',
      sourceId,
      mediaType: 'text/plain',
      title,
      ...(providerMetadata ? { providerMetadata } : {}),
    });
  }
}

/**
 * Checks if an object is an image generation output
 *
 * @param obj - The object to check.
 * @returns True if the object is an image generation output, false otherwise.
 */
export function isImageGenerationOutput(
  obj: unknown,
): obj is ImageGenerationOutput {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj as { type: string }).type === 'image_generation_call'
  );
}

/**
 * Extracts image generation outputs from `additional_kwargs`
 *
 * @param additionalKwargs - The additional kwargs to extract the image generation outputs from.
 * @returns The image generation outputs.
 */
export function extractImageOutputs(
  additionalKwargs: Record<string, unknown> | undefined,
): ImageGenerationOutput[] {
  if (!additionalKwargs) return [];

  const toolOutputs = additionalKwargs.tool_outputs;
  if (!Array.isArray(toolOutputs)) return [];

  return toolOutputs.filter(isImageGenerationOutput);
}

function formatToolError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    const serialized = JSON.stringify(error);
    return serialized ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Returns per-message bookkeeping, creating it on first use.
 * Map keys keep remote-controlled message IDs like "__proto__" from touching Object.prototype.
 */
function getOrCreateMessageSeen(
  messageSeen: LangGraphEventState['messageSeen'],
  msgId: string,
): LangGraphMessageSeen {
  let seen = messageSeen.get(msgId);
  if (!seen) {
    seen = {};
    messageSeen.set(msgId, seen);
  }
  return seen;
}

/**
 * Returns the per-index tool call metadata for a message, creating it on first use.
 * Later streamed chunks use this to recover tool call IDs/names from earlier chunks.
 */
function getOrCreateToolCallInfoByIndex(
  toolCallInfoByIndex: LangGraphEventState['toolCallInfoByIndex'],
  msgId: string,
): Map<number, { id: string; name: string }> {
  let toolCallInfo = toolCallInfoByIndex.get(msgId);
  if (!toolCallInfo) {
    toolCallInfo = new Map();
    toolCallInfoByIndex.set(msgId, toolCallInfo);
  }
  return toolCallInfo;
}

/**
 * Processes a LangGraph event and emits UI message chunks.
 *
 * @param event - The event to process.
 * @param state - The state of the LangGraph event.
 * @param controller - The controller to use to emit the UI message chunks.
 */
export function processLangGraphEvent(
  event: unknown[],
  state: LangGraphEventState,
  controller: ReadableStreamDefaultController<UIMessageChunk>,
): void {
  const {
    messageSeen,
    messageConcat,
    emittedToolCalls,
    emittedImages,
    emittedReasoningIds,
    messageReasoningIds,
    toolCallInfoByIndex,
    emittedToolCallsByKey,
    emittedToolInputs,
  } = state;
  const [type, data] = parseLangGraphEvent(event);

  switch (type) {
    case 'custom': {
      /**
       * Extract custom event type from the data's 'type' field if present.
       * This allows users to emit custom events like:
       *   writer({ type: 'progress', value: 50 })  -> { type: 'data-progress', data: {...} }
       *   writer({ type: 'status', message: '...' }) -> { type: 'data-status', data: {...} }
       *   writer({ key: 'value' })                  -> { type: 'data-custom', data: {...} } (fallback)
       *
       * The 'id' field can be used to make parts persistent and updateable.
       * Parts with an 'id' are NOT transient (added to message.parts).
       * Parts without an 'id' are transient (only passed to onData callback).
       */
      let customTypeName = 'custom';
      let partId: string | undefined;

      if (data != null && typeof data === 'object' && !Array.isArray(data)) {
        const dataObj = data as Record<string, unknown>;
        if (typeof dataObj.type === 'string' && dataObj.type) {
          customTypeName = dataObj.type;
        }
        if (typeof dataObj.id === 'string' && dataObj.id) {
          partId = dataObj.id;
        }
      }

      controller.enqueue({
        type: `data-${customTypeName}` as `data-${string}`,
        id: partId,
        transient: partId == null,
        data,
      });
      break;
    }

    case 'messages': {
      const [rawMsg, metadata] = data as [
        BaseMessageChunk | BaseMessage | undefined,
        Record<string, unknown> | undefined,
      ];

      const msg = rawMsg;
      const msgId = getMessageId(msg);

      if (!msgId) return;

      /**
       * Track LangGraph step changes and emit start-step/finish-step events.
       * Before emitting finish-step, close any open text/reasoning parts so
       * the client does not receive orphaned deltas after its
       * activeReasoningParts / activeTextParts have been cleared.
       */
      const langgraphStep =
        typeof metadata?.langgraph_step === 'number'
          ? metadata.langgraph_step
          : null;
      if (langgraphStep !== null && langgraphStep !== state.currentStep) {
        if (state.currentStep !== null) {
          for (const [id, seen] of messageSeen) {
            if (seen.text) {
              controller.enqueue({ type: 'text-end', id });
            }
            if (seen.reasoning) {
              controller.enqueue({ type: 'reasoning-end', id });
            }
            messageSeen.delete(id);
            messageConcat.delete(id);
            messageReasoningIds.delete(id);
          }
          controller.enqueue({ type: 'finish-step' });
        }
        controller.enqueue({ type: 'start-step' });
        state.currentStep = langgraphStep;
      }

      /**
       * Accumulate message chunks for later reference
       * Note: Only works for actual class instances, not serialized messages
       */
      if (AIMessageChunk.isInstance(msg)) {
        const existingMessage = messageConcat.get(msgId);
        if (existingMessage) {
          messageConcat.set(
            msgId,
            existingMessage.concat(msg) as AIMessageChunk,
          );
        } else {
          messageConcat.set(msgId, msg);
        }
      }

      if (isAIMessageChunk(msg)) {
        const concatChunk = messageConcat.get(msgId);

        /**
         * Handle image generation outputs from additional_kwargs.tool_outputs
         * Handle both direct properties and serialized messages (kwargs)
         */
        const msgObj = msg as unknown as Record<string, unknown>;
        const dataSource =
          msgObj.type === 'constructor' &&
          msgObj.kwargs &&
          typeof msgObj.kwargs === 'object'
            ? (msgObj.kwargs as Record<string, unknown>)
            : msgObj;
        const additionalKwargs = dataSource.additional_kwargs as
          | Record<string, unknown>
          | undefined;
        const imageOutputs = extractImageOutputs(additionalKwargs);

        for (const imageOutput of imageOutputs) {
          /**
           * Only emit if we have image data and haven't emitted this image yet
           */
          if (imageOutput.result && !emittedImages.has(imageOutput.id)) {
            emittedImages.add(imageOutput.id);

            /**
             * Emit as a file part using proper AI SDK multimodal format
             */
            const mediaType = `image/${imageOutput.output_format || 'png'}`;
            controller.enqueue({
              type: 'file',
              mediaType,
              url: `data:${mediaType};base64,${imageOutput.result}`,
            });
          }
        }

        /**
         * Handle tool call chunks for streaming tool calls
         * Access from dataSource to handle both direct and serialized messages
         *
         * Tool call chunks are streamed as follows:
         * 1. First chunk: has name, id, but often empty args
         * 2. Subsequent chunks: have args but NO id or name
         *
         * We store tool call info by index when we first see it, then look it up
         * for subsequent chunks that don't include the id.
         */
        const toolCallChunks = dataSource.tool_call_chunks as
          | ToolCallChunk[]
          | undefined;
        if (toolCallChunks?.length) {
          for (const toolCallChunk of toolCallChunks) {
            const toolCallIndex = toolCallChunk.index ?? 0;

            /**
             * If this chunk has an id, store it for future lookups by index
             */
            if (toolCallChunk.id) {
              getOrCreateToolCallInfoByIndex(toolCallInfoByIndex, msgId).set(
                toolCallIndex,
                {
                  id: toolCallChunk.id,
                  name:
                    toolCallChunk.name ||
                    concatChunk?.tool_call_chunks?.[toolCallIndex]?.name ||
                    'unknown',
                },
              );
            }

            /**
             * Get the tool call ID from the chunk, stored info, or accumulated chunks
             */
            const storedToolCallInfo = toolCallInfoByIndex
              .get(msgId)
              ?.get(toolCallIndex);
            const toolCallId =
              toolCallChunk.id ||
              storedToolCallInfo?.id ||
              concatChunk?.tool_call_chunks?.[toolCallIndex]?.id;

            /**
             * Skip if we don't have a proper tool call ID - we'll handle it in values
             */
            if (!toolCallId) {
              continue;
            }

            const toolName =
              toolCallChunk.name ||
              storedToolCallInfo?.name ||
              concatChunk?.tool_call_chunks?.[toolCallIndex]?.name ||
              'unknown';

            /**
             * Emit tool-input-start when we first see this tool call
             * (even if args is empty - the first chunk often has empty args)
             * Set dynamic: true to enable HITL approval requests
             */
            const seen = messageSeen.get(msgId);
            if (!seen?.tool?.has(toolCallId)) {
              const updatedSeen = getOrCreateMessageSeen(messageSeen, msgId);
              updatedSeen.tool ??= new Set();
              updatedSeen.tool.add(toolCallId);

              if (!emittedToolCalls.has(toolCallId)) {
                emittedToolCalls.add(toolCallId);
                controller.enqueue({
                  type: 'tool-input-start',
                  toolCallId: toolCallId,
                  toolName: toolName,
                  dynamic: true,
                });
              }
            }

            /**
             * Only emit tool-input-delta when args is non-empty
             */
            if (toolCallChunk.args) {
              controller.enqueue({
                type: 'tool-input-delta',
                toolCallId: toolCallId,
                inputTextDelta: toolCallChunk.args,
              });
            }
          }

          return;
        }

        /**
         * Handle reasoning content from contentBlocks
         * Streaming chunks contain DELTA text (not accumulated), so emit directly.
         * Use reasoning block ID for deduplication as it's consistent across streaming and values events.
         *
         * Important: Early chunks may have reasoning ID but no content, later chunks may
         * have content but no reasoning ID. We capture the ID when first seen and reuse it.
         * We also immediately add to emittedReasoningIds to prevent values events from
         * emitting the same reasoning (values events can arrive between streaming chunks).
         */
        // Capture reasoning ID when we first see it (even if no content yet)
        const chunkReasoningId = extractReasoningId(msg);
        if (chunkReasoningId) {
          if (!messageReasoningIds.has(msgId)) {
            messageReasoningIds.set(msgId, chunkReasoningId);
          }
          // Immediately mark as emitted to prevent values from duplicating
          // This must happen as soon as we see the ID, before content arrives
          emittedReasoningIds.add(chunkReasoningId);
        }

        const reasoning = extractReasoningFromContentBlocks(msg);
        if (reasoning) {
          // Use stored reasoning ID, or current chunk's ID, or fall back to message ID
          const reasoningId =
            messageReasoningIds.get(msgId) ?? chunkReasoningId ?? msgId;

          const seen = messageSeen.get(msgId);
          if (!seen?.reasoning) {
            controller.enqueue({ type: 'reasoning-start', id: msgId });
            getOrCreateMessageSeen(messageSeen, msgId).reasoning = true;
          }

          // Streaming chunks have delta text, emit directly without slicing
          controller.enqueue({
            type: 'reasoning-delta',
            delta: reasoning,
            id: msgId,
          });
          // Also ensure the reasoning ID is marked (handles case where ID wasn't in first chunk)
          emittedReasoningIds.add(reasoningId);
        }

        /**
         * Handle text content
         */
        const text = getMessageText(msg);
        if (text) {
          const seen = messageSeen.get(msgId);
          if (!seen?.text) {
            controller.enqueue({ type: 'text-start', id: msgId });
            getOrCreateMessageSeen(messageSeen, msgId).text = true;
          }

          controller.enqueue({
            type: 'text-delta',
            delta: text,
            id: msgId,
          });
        }

        const citations = extractCitationsFromContentBlocks(msg);
        if (citations.length > 0) {
          emitSourceChunks(
            citations,
            msgId,
            state.emittedSourceIds,
            controller,
          );
        }
      } else if (isToolMessageType(msg)) {
        // Handle both direct properties and serialized messages (kwargs)
        const msgObj = msg as unknown as Record<string, unknown>;
        const dataSource =
          msgObj.type === 'constructor' &&
          msgObj.kwargs &&
          typeof msgObj.kwargs === 'object'
            ? (msgObj.kwargs as Record<string, unknown>)
            : msgObj;

        const toolCallId = dataSource.tool_call_id as string | undefined;
        const status = dataSource.status as string | undefined;

        if (toolCallId) {
          if (status === 'error') {
            // Tool execution failed
            controller.enqueue({
              type: 'tool-output-error',
              toolCallId,
              errorText:
                typeof dataSource.content === 'string'
                  ? dataSource.content
                  : 'Tool execution failed',
            });
          } else {
            // Tool execution succeeded
            controller.enqueue({
              type: 'tool-output-available',
              toolCallId,
              output: dataSource.content,
            });
          }
        }
      }

      return;
    }

    case 'tools': {
      if (data == null || typeof data !== 'object' || Array.isArray(data)) {
        return;
      }

      const payload = data as {
        event?: unknown;
        name?: unknown;
        input?: unknown;
        data?: unknown;
        output?: unknown;
        error?: unknown;
        toolCallId?: unknown;
      };
      const toolCallId =
        typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;
      const toolName =
        typeof payload.name === 'string' ? payload.name : 'unknown';

      if (!toolCallId) return;

      const ensureToolInputLifecycle = () => {
        if (!emittedToolCalls.has(toolCallId)) {
          emittedToolCalls.add(toolCallId);
          controller.enqueue({
            type: 'tool-input-start',
            toolCallId,
            toolName,
            dynamic: true,
          });
        }

        if (!emittedToolInputs.has(toolCallId)) {
          emittedToolInputs.add(toolCallId);
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName,
            input: payload.input,
            dynamic: true,
          });
        }
      };

      switch (payload.event) {
        case 'on_tool_start': {
          const toolCallKey = `${toolName}:${JSON.stringify(payload.input)}`;
          emittedToolCallsByKey.set(toolCallKey, toolCallId);

          ensureToolInputLifecycle();
          break;
        }

        case 'on_tool_event': {
          ensureToolInputLifecycle();
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: payload.data,
            preliminary: true,
          });
          break;
        }

        case 'on_tool_end': {
          ensureToolInputLifecycle();
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: payload.output,
          });
          break;
        }

        case 'on_tool_error': {
          ensureToolInputLifecycle();
          controller.enqueue({
            type: 'tool-output-error',
            toolCallId,
            errorText: formatToolError(payload.error),
          });
          break;
        }
      }

      return;
    }

    case 'values': {
      /**
       * Finalize all pending message chunks
       */
      for (const [id, seen] of messageSeen) {
        if (seen.text) controller.enqueue({ type: 'text-end', id });
        if (seen.tool) {
          for (const toolCallId of seen.tool) {
            const concatMsg = messageConcat.get(id);
            const toolCall = concatMsg?.tool_calls?.find(
              call => call.id === toolCallId,
            );

            if (toolCall) {
              emittedToolCalls.add(toolCallId);
              // Store mapping for HITL interrupt lookup
              const toolCallKey = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
              emittedToolCallsByKey.set(toolCallKey, toolCallId);
              if (!emittedToolInputs.has(toolCallId)) {
                emittedToolInputs.add(toolCallId);
                controller.enqueue({
                  type: 'tool-input-available',
                  toolCallId,
                  toolName: toolCall.name,
                  input: toolCall.args,
                  dynamic: true,
                });
              }
            }
          }
        }

        if (seen.reasoning) {
          controller.enqueue({ type: 'reasoning-end', id });
        }

        messageSeen.delete(id);
        messageConcat.delete(id);
        messageReasoningIds.delete(id);
      }

      /**
       * Also check for tool calls in the final state that weren't streamed
       * This handles cases where tool calls appear directly in values without being in messages events
       */
      if (data != null && typeof data === 'object' && 'messages' in data) {
        const messages = (data as { messages?: unknown[] }).messages;
        if (Array.isArray(messages)) {
          /**
           * First pass: Collect all tool call IDs that have been responded to by ToolMessages.
           * These are historical tool calls that are already complete.
           */
          const completedToolCallIds = new Set<string>();
          for (const msg of messages) {
            if (!msg || typeof msg !== 'object') continue;

            if (isToolMessageType(msg)) {
              // Handle both direct properties and serialized messages (kwargs)
              const msgObj = msg as unknown as Record<string, unknown>;
              const dataSource =
                msgObj.type === 'constructor' &&
                msgObj.kwargs &&
                typeof msgObj.kwargs === 'object'
                  ? (msgObj.kwargs as Record<string, unknown>)
                  : msgObj;

              const toolCallId = dataSource.tool_call_id as string | undefined;
              if (toolCallId) {
                completedToolCallIds.add(toolCallId);
              }
            }
          }

          /**
           * Second pass: Process messages and emit tool events only for NEW tool calls
           * (those not already completed by a ToolMessage in the history)
           */
          for (const msg of messages) {
            if (!msg || typeof msg !== 'object') continue;

            // Use getMessageId to handle both class instances and serialized messages
            const msgId = getMessageId(msg);
            if (!msgId) continue;

            /**
             * Check if this is an AI message with tool calls
             */
            let toolCalls: ToolCall[] | undefined;

            /**
             * For class instances
             */
            if (AIMessageChunk.isInstance(msg) || AIMessage.isInstance(msg)) {
              toolCalls = msg.tool_calls;
            } else if (isPlainMessageObject(msg)) {
              /**
               * For plain objects from RemoteGraph API or serialized LangChain messages
               */
              const messageRecord = msg as Record<string, unknown>;

              /**
               * Determine the data source (handle both direct and serialized formats)
               */
              const isSerializedFormat =
                messageRecord.type === 'constructor' &&
                Array.isArray(messageRecord.id) &&
                ((messageRecord.id as string[]).includes('AIMessageChunk') ||
                  (messageRecord.id as string[]).includes('AIMessage'));
              const dataSource = isSerializedFormat
                ? (messageRecord.kwargs as Record<string, unknown>)
                : messageRecord;

              if (
                messageRecord.type === 'ai' ||
                messageRecord.type === 'AIMessageChunk' ||
                isSerializedFormat
              ) {
                /**
                 * Try tool_calls first (normalized format)
                 */
                if (Array.isArray(dataSource?.tool_calls)) {
                  toolCalls = dataSource.tool_calls as ToolCall[];
                } else if (
                  /**
                   * Fall back to additional_kwargs.tool_calls (OpenAI format)
                   */
                  dataSource?.additional_kwargs &&
                  typeof dataSource.additional_kwargs === 'object'
                ) {
                  const additionalKwargs =
                    dataSource.additional_kwargs as Record<string, unknown>;
                  if (Array.isArray(additionalKwargs.tool_calls)) {
                    /**
                     * Convert OpenAI format to normalized format
                     */
                    toolCalls = (
                      additionalKwargs.tool_calls as Array<{
                        id?: string;
                        function?: { name?: string; arguments?: string };
                      }>
                    ).map((tc, idx) => {
                      const functionData = tc.function;
                      let args: unknown;
                      try {
                        args = functionData?.arguments
                          ? JSON.parse(functionData.arguments)
                          : {};
                      } catch {
                        args = {};
                      }
                      return {
                        id: tc.id || `call_${idx}`,
                        name: functionData?.name || 'unknown',
                        args,
                      } as ToolCall;
                    });
                  }
                }
              }
            }

            if (toolCalls && toolCalls.length > 0) {
              for (const toolCall of toolCalls) {
                /**
                 * Only emit if we haven't already processed this tool call
                 * AND if it's not a historical tool call that already has a ToolMessage response.
                 * Historical completed tool calls should not be re-emitted as this would create
                 * orphaned tool parts in the UI without corresponding outputs.
                 */
                if (
                  toolCall.id &&
                  !emittedToolCalls.has(toolCall.id) &&
                  !completedToolCallIds.has(toolCall.id)
                ) {
                  emittedToolCalls.add(toolCall.id);
                  // Store mapping for HITL interrupt lookup
                  const toolCallKey = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
                  emittedToolCallsByKey.set(toolCallKey, toolCall.id);
                  /**
                   * Emit tool-input-start first to ensure proper lifecycle.
                   * Tool calls that weren't streamed (no tool_call_chunks) need
                   * the start event before tool-input-available.
                   */
                  controller.enqueue({
                    type: 'tool-input-start',
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    dynamic: true,
                  });
                  emittedToolInputs.add(toolCall.id);
                  controller.enqueue({
                    type: 'tool-input-available',
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    input: toolCall.args,
                    dynamic: true,
                  });
                } else if (toolCall.id && emittedToolCalls.has(toolCall.id)) {
                  // Register key mapping for tool calls already emitted via messages mode
                  // so that __interrupt__ handling can match them by key
                  const toolCallKey = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
                  emittedToolCallsByKey.set(toolCallKey, toolCall.id);
                }
              }
            }

            /**
             * Check for reasoning content that wasn't streamed
             * Use reasoning block ID for deduplication as it's consistent across streaming and values.
             *
             * IMPORTANT: Handle two cases differently:
             * 1. Message has reasoning WITHOUT tool_calls → emit reasoning (pure reasoning case)
             * 2. Message has reasoning WITH tool_calls → only emit if streamed this request
             *    (When resuming from HITL interrupt, historical messages have both reasoning
             *    AND tool_calls. We skip those to avoid duplicate reasoning entries.)
             */
            const reasoningId = extractReasoningId(msg);
            const wasStreamedThisRequest = messageSeen.has(msgId);
            const hasToolCalls = toolCalls && toolCalls.length > 0;

            /**
             * Determine if we should emit reasoning:
             * - If we already emitted this reasoning ID, skip
             * - If the message was streamed this request, emit (normal flow)
             * - If NOT streamed but has NO tool_calls, emit (pure reasoning in values case)
             * - If NOT streamed but HAS tool_calls, skip (historical HITL message)
             */
            const shouldEmitReasoning =
              reasoningId &&
              !emittedReasoningIds.has(reasoningId) &&
              (wasStreamedThisRequest || !hasToolCalls);

            if (shouldEmitReasoning) {
              /**
               * Use extractReasoningFromValuesMessage which extracts from response_metadata.output
               * This is the full accumulated reasoning, not deltas
               */
              const reasoning = extractReasoningFromValuesMessage(msg);

              if (reasoning) {
                controller.enqueue({ type: 'reasoning-start', id: msgId });
                controller.enqueue({
                  type: 'reasoning-delta',
                  delta: reasoning,
                  id: msgId,
                });
                controller.enqueue({ type: 'reasoning-end', id: msgId });
                emittedReasoningIds.add(reasoningId);
              }
            }

            const valuesCitations = extractCitationsFromContentBlocks(msg);
            if (valuesCitations.length > 0) {
              emitSourceChunks(
                valuesCitations,
                msgId,
                state.emittedSourceIds,
                controller,
              );
            }
          }
        }
      }

      /**
       * Handle Human-in-the-Loop interrupts
       * When HITL middleware pauses execution, the interrupt data is in __interrupt__
       * Note: This is outside the 'messages' check because interrupt can come as a separate event
       */
      if (data != null && typeof data === 'object') {
        const interrupt = (data as Record<string, unknown>).__interrupt__;
        if (Array.isArray(interrupt) && interrupt.length > 0) {
          for (const interruptItem of interrupt) {
            const interruptValue = (interruptItem as { value?: unknown })
              ?.value as Record<string, unknown> | undefined;

            if (!interruptValue) continue;

            /**
             * Support both camelCase (JS SDK) and snake_case (Python SDK)
             */
            const actionRequests = (interruptValue.actionRequests ||
              interruptValue.action_requests) as
              | Array<{
                  name: string;
                  args?: Record<string, unknown>; // JS SDK uses 'args'
                  arguments?: Record<string, unknown>; // Python SDK uses 'arguments'
                  id?: string;
                }>
              | undefined;

            if (!Array.isArray(actionRequests)) continue;

            for (const actionRequest of actionRequests) {
              const toolName = actionRequest.name;
              /**
               * Support both 'args' (JS SDK) and 'arguments' (Python SDK)
               */
              const input = actionRequest.args || actionRequest.arguments;

              /**
               * Look up the original tool call ID using the name+args key
               * Fall back to action request ID or generate one if not found
               */
              const toolCallKey = `${toolName}:${JSON.stringify(input)}`;
              const toolCallId =
                emittedToolCallsByKey.get(toolCallKey) ||
                actionRequest.id ||
                `hitl-${toolName}-${Date.now()}`;

              /**
               * First emit tool-input-start then tool-input-available
               * so the UI knows what tool is being called with proper lifecycle
               */
              if (!emittedToolCalls.has(toolCallId)) {
                emittedToolCalls.add(toolCallId);
                emittedToolCallsByKey.set(toolCallKey, toolCallId);
                controller.enqueue({
                  type: 'tool-input-start',
                  toolCallId,
                  toolName,
                  dynamic: true,
                });
                emittedToolInputs.add(toolCallId);
                controller.enqueue({
                  type: 'tool-input-available',
                  toolCallId,
                  toolName,
                  input,
                  dynamic: true,
                });
              }

              /**
               * Then emit tool-approval-request to mark it as awaiting approval
               */
              controller.enqueue({
                type: 'tool-approval-request',
                approvalId: toolCallId,
                toolCallId,
              });
            }
          }
        }
      }

      break;
    }
  }
}
