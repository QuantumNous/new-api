import { describe, it, expect } from 'vitest';
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type {
  ToolResultPart,
  AssistantContent,
  UserContent,
  UIMessageChunk,
} from 'ai';
import {
  convertToolResultPart,
  convertAssistantContent,
  convertUserContent,
  isToolResultPart,
  processModelChunk,
  isPlainMessageObject,
  isAIMessageChunk,
  isToolMessageType,
  getMessageText,
  isImageGenerationOutput,
  extractImageOutputs,
  processLangGraphEvent,
  isCitationContentBlock,
  extractCitationsFromContentBlocks,
  emitSourceChunks,
} from './utils';
import type { LangGraphEventState, NormalizedCitation } from './types';

/**
 * Creates a mock ReadableStreamDefaultController for testing
 */
function createMockController(
  chunks: unknown[],
): ReadableStreamDefaultController<UIMessageChunk> {
  return {
    enqueue: (c: unknown) => {
      chunks.push(c);
    },
    close: () => {},
    error: () => {},
    desiredSize: 1,
  } as ReadableStreamDefaultController<UIMessageChunk>;
}

const objectPrototypeProperties = ['text', 'reasoning', 'tool', '0'] as const;

function clearObjectPrototypeProperties() {
  for (const property of objectPrototypeProperties) {
    delete (Object.prototype as Record<string, unknown>)[property];
  }
}

function expectObjectPrototypeNotPolluted() {
  const object = {} as Record<string, unknown>;
  for (const property of objectPrototypeProperties) {
    expect(object[property]).toBeUndefined();
  }
}

describe('convertToolResultPart', () => {
  it('should convert text output', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      output: { type: 'text', value: 'Sunny, 72°F' },
    };

    const result = convertToolResultPart(part);

    expect(result).toBeInstanceOf(ToolMessage);
    expect(result.tool_call_id).toBe('call-1');
    expect(result.content).toBe('Sunny, 72°F');
  });

  it('should convert error-text output', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'failing_tool',
      output: { type: 'error-text', value: 'Something went wrong' },
    };

    const result = convertToolResultPart(part);

    expect(result.content).toBe('Something went wrong');
  });

  it('should convert json output', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'get_data',
      output: { type: 'json', value: { temperature: 72 } },
    };

    const result = convertToolResultPart(part);

    expect(result.content).toBe('{"temperature":72}');
  });

  it('should convert error-json output', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'failing_tool',
      output: { type: 'error-json', value: { error: 'Failed' } },
    };

    const result = convertToolResultPart(part);

    expect(result.content).toBe('{"error":"Failed"}');
  });

  it('should convert content output with text blocks', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'multi_output',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: 'First part ' },
          { type: 'text', text: 'Second part' },
        ],
      },
    };

    const result = convertToolResultPart(part);

    expect(result.content).toBe('First part Second part');
  });

  it('should handle content output with non-text blocks', () => {
    const part: ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'mixed_output',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: 'Hello' },
          { type: 'file-data', data: 'base64data', mediaType: 'image/png' },
        ],
      },
    };

    const result = convertToolResultPart(part);

    expect(result.content).toBe('Hello');
  });
});

describe('convertAssistantContent', () => {
  it('should convert string content', () => {
    const content: AssistantContent = 'Hello, how can I help?';

    const result = convertAssistantContent(content);

    expect(result).toBeInstanceOf(AIMessage);
    expect(result.content).toBe('Hello, how can I help?');
  });

  it('should convert array content with text parts', () => {
    const content: AssistantContent = [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'World' },
    ];

    const result = convertAssistantContent(content);

    expect(result.content).toBe('Hello World');
  });

  it('should convert array content with tool calls', () => {
    const content: AssistantContent = [
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: { location: 'NYC' },
      },
    ];

    const result = convertAssistantContent(content);

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls?.[0]).toEqual({
      id: 'call-1',
      name: 'get_weather',
      args: { location: 'NYC' },
    });
  });

  it('should handle mixed text and tool calls', () => {
    const content: AssistantContent = [
      { type: 'text', text: "I'll check the weather" },
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'get_weather',
        input: { location: 'NYC' },
      },
    ];

    const result = convertAssistantContent(content);

    expect(result.content).toBe("I'll check the weather");
    expect(result.tool_calls).toHaveLength(1);
  });

  it('should have no tool_calls when none present', () => {
    const content: AssistantContent = [{ type: 'text', text: 'Just text' }];

    const result = convertAssistantContent(content);

    // AIMessage normalizes undefined to empty array
    expect(result.tool_calls).toHaveLength(0);
  });
});

describe('convertUserContent', () => {
  it('should convert string content', () => {
    const content: UserContent = 'Hello!';

    const result = convertUserContent(content);

    expect(result).toBeInstanceOf(HumanMessage);
    expect(result.content).toBe('Hello!');
  });

  it('should convert array content with text parts', () => {
    const content: UserContent = [
      { type: 'text', text: 'Part 1 ' },
      { type: 'text', text: 'Part 2' },
    ];

    const result = convertUserContent(content);

    expect(result.content).toBe('Part 1 Part 2');
  });

  it('should include image parts with binary data using OpenAI image_url format', () => {
    const content: UserContent = [
      { type: 'text', text: 'Describe this image' },
      {
        type: 'image',
        image: new Uint8Array([1, 2, 3]),
        mediaType: 'image/png',
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'Describe this image' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,AQID' }, // base64 of [1, 2, 3]
      },
    ]);
  });

  it('should include image parts with URL using OpenAI image_url format', () => {
    const content: UserContent = [
      { type: 'text', text: 'What is in this image?' },
      {
        type: 'image',
        image: 'https://example.com/image.jpg',
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'What is in this image?' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/image.jpg' },
      },
    ]);
  });

  it('should include non-image file parts using file format', () => {
    const content: UserContent = [
      { type: 'text', text: 'Summarize this document' },
      {
        type: 'file',
        data: 'https://example.com/doc.pdf',
        mediaType: 'application/pdf',
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'Summarize this document' },
      {
        type: 'file',
        url: 'https://example.com/doc.pdf',
        mimeType: 'application/pdf',
        filename: 'file.pdf',
      },
    ]);
  });

  it('should handle URL objects for images using OpenAI image_url format', () => {
    const content: UserContent = [
      { type: 'text', text: 'Describe' },
      {
        type: 'image',
        image: new URL('https://example.com/photo.png'),
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'Describe' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/photo.png' },
      },
    ]);
  });

  it('should handle data URLs for images using OpenAI image_url format', () => {
    const content: UserContent = [
      { type: 'text', text: 'Analyze' },
      {
        type: 'image',
        image: 'data:image/png;base64,abc123',
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'Analyze' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      },
    ]);
  });

  it('should handle image files (file type with image mediaType) using OpenAI image_url format', () => {
    const content: UserContent = [
      { type: 'text', text: 'What is this?' },
      {
        type: 'file',
        data: 'https://example.com/photo.jpg',
        mediaType: 'image/jpeg',
      },
    ];

    const result = convertUserContent(content);

    expect(result.content).toEqual([
      { type: 'text', text: 'What is this?' },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/photo.jpg' },
      },
    ]);
  });
});

describe('isToolResultPart', () => {
  it('should return true for valid tool result parts', () => {
    const part = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'test',
      output: { type: 'text', value: 'result' },
    };

    expect(isToolResultPart(part)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isToolResultPart(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isToolResultPart(undefined)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isToolResultPart('string')).toBe(false);
    expect(isToolResultPart(123)).toBe(false);
  });

  it('should return false for objects without type', () => {
    expect(isToolResultPart({ toolCallId: 'call-1' })).toBe(false);
  });

  it('should return false for objects with wrong type', () => {
    expect(isToolResultPart({ type: 'text' })).toBe(false);
  });
});

describe('processModelChunk', () => {
  it('should emit text-start and text-delta for first chunk', () => {
    const chunk = new AIMessageChunk({
      content: 'Hello',
      id: 'msg-1',
    });
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(state.started).toBe(true);
    expect(state.textStarted).toBe(true);
    expect(state.messageId).toBe('msg-1');
    expect(chunks).toEqual([
      { type: 'text-start', id: 'msg-1' },
      { type: 'text-delta', delta: 'Hello', id: 'msg-1' },
    ]);
  });

  it('should emit only text-delta for subsequent chunks', () => {
    const chunk = new AIMessageChunk({
      content: ' World',
      id: 'msg-1',
    });
    const state = {
      started: true,
      messageId: 'msg-1',
      reasoningStarted: false,
      textStarted: true,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(chunks).toEqual([
      { type: 'text-delta', delta: ' World', id: 'msg-1' },
    ]);
  });

  it('should handle array content with text parts', () => {
    const chunk = new AIMessageChunk({
      content: [{ type: 'text', text: 'Array content' }],
      id: 'msg-1',
    });
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(chunks).toContainEqual({
      type: 'text-delta',
      delta: 'Array content',
      id: 'msg-1',
    });
  });

  it('should not emit for empty content', () => {
    const chunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
    });
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(chunks).toHaveLength(0);
    expect(state.started).toBe(false);
  });

  it('should handle reasoning content from contentBlocks', () => {
    const chunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
    });
    Object.defineProperty(chunk, 'contentBlocks', {
      get: () => [{ type: 'reasoning', reasoning: 'Let me think...' }],
    });

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(state.reasoningStarted).toBe(true);
    expect(state.started).toBe(true);
    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'msg-1' },
      { type: 'reasoning-delta', delta: 'Let me think...', id: 'msg-1' },
    ]);
  });

  it('should handle thinking content from contentBlocks (Anthropic-style)', () => {
    const chunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
    });
    Object.defineProperty(chunk, 'contentBlocks', {
      get: () => [{ type: 'thinking', thinking: 'Analyzing...' }],
    });

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'msg-1' },
      { type: 'reasoning-delta', delta: 'Analyzing...', id: 'msg-1' },
    ]);
  });

  it('should handle GPT-5 reasoning from response_metadata.output', () => {
    const chunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
    });
    Object.defineProperty(chunk, 'response_metadata', {
      get: () => ({
        output: [
          {
            id: 'rs_123',
            type: 'reasoning',
            summary: [
              {
                type: 'summary_text',
                text: 'I need to analyze this question carefully...',
              },
            ],
          },
        ],
      }),
    });

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(state.reasoningStarted).toBe(true);
    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'msg-1' },
      {
        type: 'reasoning-delta',
        delta: 'I need to analyze this question carefully...',
        id: 'msg-1',
      },
    ]);
  });

  it('should handle GPT-5 reasoning from additional_kwargs.reasoning.summary', () => {
    const chunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
      additional_kwargs: {
        reasoning: {
          id: 'rs_456',
          type: 'reasoning',
          summary: [
            {
              type: 'summary_text',
              text: 'Breaking down the problem into parts...',
            },
          ],
        },
      },
    });

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(state.reasoningStarted).toBe(true);
    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'msg-1' },
      {
        type: 'reasoning-delta',
        delta: 'Breaking down the problem into parts...',
        id: 'msg-1',
      },
    ]);
  });

  it('should close reasoning when text starts', () => {
    // First send reasoning
    const reasoningChunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
    });
    Object.defineProperty(reasoningChunk, 'contentBlocks', {
      get: () => [{ type: 'reasoning', reasoning: 'Thinking...' }],
    });

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(reasoningChunk, state, controller);

    // Now send text
    const textChunk = new AIMessageChunk({
      content: 'Here is my answer',
      id: 'msg-1',
    });

    processModelChunk(textChunk, state, controller);

    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'msg-1' },
      { type: 'reasoning-delta', delta: 'Thinking...', id: 'msg-1' },
      { type: 'reasoning-end', id: 'msg-1' },
      { type: 'text-start', id: 'msg-1' },
      { type: 'text-delta', delta: 'Here is my answer', id: 'msg-1' },
    ]);
    expect(state.reasoningStarted).toBe(false);
    expect(state.textStarted).toBe(true);
  });

  it('should maintain consistent IDs when chunk.id changes during reasoning-to-text transition', () => {
    // This test reproduces the bug where the message ID changes between chunks,
    // which would cause the client to fail to look up activeReasoningParts or activeTextParts
    // because the ID used for *-start doesn't match the ID used for *-delta and *-end.
    //
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
      reasoningMessageId: null as string | null,
      textMessageId: null as string | null,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    // First reasoning chunk arrives with id "run-abc123"
    const reasoningChunk1 = new AIMessageChunk({
      content: '',
      id: 'run-abc123',
    });
    Object.defineProperty(reasoningChunk1, 'contentBlocks', {
      get: () => [{ type: 'reasoning', reasoning: 'Let me think...' }],
    });
    processModelChunk(reasoningChunk1, state, controller);

    const reasoningChunk2 = new AIMessageChunk({
      content: '',
      id: 'msg-xyz789',
    });
    Object.defineProperty(reasoningChunk2, 'contentBlocks', {
      get: () => [{ type: 'reasoning', reasoning: ' about this.' }],
    });
    processModelChunk(reasoningChunk2, state, controller);

    // Text chunk arrives with the new id "msg-xyz789"
    const textChunk = new AIMessageChunk({
      content: 'Here is my answer.',
      id: 'msg-xyz789',
    });
    processModelChunk(textChunk, state, controller);

    // Verify all reasoning chunks use the same id that was used for reasoning-start
    // and all text chunks use the same id that was used for text-start
    expect(chunks).toEqual([
      { type: 'reasoning-start', id: 'run-abc123' },
      { type: 'reasoning-delta', delta: 'Let me think...', id: 'run-abc123' },
      { type: 'reasoning-delta', delta: ' about this.', id: 'run-abc123' },
      { type: 'reasoning-end', id: 'run-abc123' },
      { type: 'text-start', id: 'msg-xyz789' },
      { type: 'text-delta', delta: 'Here is my answer.', id: 'msg-xyz789' },
    ]);

    expect(state.reasoningMessageId).toBe('run-abc123');
    expect(state.textMessageId).toBe('msg-xyz789');
    expect(state.messageId).toBe('msg-xyz789');
  });

  it('should maintain consistent text IDs when chunk.id changes during text streaming', () => {
    // Similar bug can occur with text-only streaming if the ID changes between chunks

    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
      reasoningMessageId: null as string | null,
      textMessageId: null as string | null,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    // First text chunk arrives with id "run-abc123"
    const textChunk1 = new AIMessageChunk({
      content: 'Hello',
      id: 'run-abc123',
    });
    processModelChunk(textChunk1, state, controller);

    const textChunk2 = new AIMessageChunk({
      content: ' world!',
      id: 'msg-xyz789',
    });
    processModelChunk(textChunk2, state, controller);

    // Verify all text chunks use the same id that was used for text-start
    expect(chunks).toEqual([
      { type: 'text-start', id: 'run-abc123' },
      { type: 'text-delta', delta: 'Hello', id: 'run-abc123' },
      { type: 'text-delta', delta: ' world!', id: 'run-abc123' },
    ]);

    expect(state.textMessageId).toBe('run-abc123');
    expect(state.messageId).toBe('msg-xyz789');
  });
});

describe('isPlainMessageObject', () => {
  it('should return true for plain objects', () => {
    expect(isPlainMessageObject({ type: 'ai', content: 'Hello' })).toBe(true);
  });

  it('should return false for LangChain class instances', () => {
    const aiChunk = new AIMessageChunk({ content: 'Hello' });
    expect(isPlainMessageObject(aiChunk)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPlainMessageObject(null)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isPlainMessageObject('string')).toBe(false);
    expect(isPlainMessageObject(123)).toBe(false);
  });
});

describe('isAIMessageChunk', () => {
  it('should return true for AIMessageChunk instances', () => {
    const chunk = new AIMessageChunk({ content: 'Hello' });
    expect(isAIMessageChunk(chunk)).toBe(true);
  });

  it('should return true for plain objects with type: ai', () => {
    const plainObj = { type: 'ai', content: 'Hello', id: 'msg-1' };
    expect(isAIMessageChunk(plainObj)).toBe(true);
  });

  it('should return true for plain objects with type: AIMessageChunk (Python langchain-core RemoteGraph)', () => {
    const plainObj = {
      type: 'AIMessageChunk',
      content: 'Hello',
      id: 'msg-1',
    };
    expect(isAIMessageChunk(plainObj)).toBe(true);
  });

  it('should return false for AIMessage instances (not chunks)', () => {
    const msg = new AIMessage({ content: 'Hello' });
    // AIMessage is not AIMessageChunk, but it extends BaseMessage
    // The function should return false for AIMessage if it's checking specifically for chunks
    expect(isAIMessageChunk(msg)).toBe(false);
  });

  it('should return false for plain objects with other types', () => {
    expect(isAIMessageChunk({ type: 'tool', content: 'Hello' })).toBe(false);
    expect(isAIMessageChunk({ type: 'human', content: 'Hello' })).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isAIMessageChunk(null)).toBe(false);
    expect(isAIMessageChunk(undefined)).toBe(false);
  });
});

describe('isToolMessageType', () => {
  it('should return true for ToolMessage instances', () => {
    const toolMsg = new ToolMessage({
      tool_call_id: 'call-1',
      content: 'Result',
    });
    expect(isToolMessageType(toolMsg)).toBe(true);
  });

  it('should return true for plain objects with type: tool', () => {
    const plainObj = {
      type: 'tool',
      content: 'Result',
      tool_call_id: 'call-1',
    };
    expect(isToolMessageType(plainObj)).toBe(true);
  });

  it('should return false for other types', () => {
    expect(isToolMessageType({ type: 'ai', content: 'Hello' })).toBe(false);
    expect(isToolMessageType({ type: 'human', content: 'Hello' })).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isToolMessageType(null)).toBe(false);
    expect(isToolMessageType(undefined)).toBe(false);
  });
});

describe('getMessageText', () => {
  it('should extract text from AIMessageChunk', () => {
    const chunk = new AIMessageChunk({ content: 'Hello World' });
    expect(getMessageText(chunk)).toBe('Hello World');
  });

  it('should extract text from plain objects with content', () => {
    const plainObj = { content: 'Plain text' };
    expect(getMessageText(plainObj)).toBe('Plain text');
  });

  it('should extract text from content array with text blocks', () => {
    const plainObj = { content: [{ type: 'text', text: 'Array' }] };
    expect(getMessageText(plainObj)).toBe('Array');
  });

  it('should return empty string for non-text content blocks', () => {
    const plainObj = {
      content: [{ type: 'image', url: 'http://example.com' }],
    };
    expect(getMessageText(plainObj)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(getMessageText(null)).toBe('');
  });

  it('should return empty string for objects without content', () => {
    expect(getMessageText({ type: 'ai' })).toBe('');
  });
});

describe('isImageGenerationOutput', () => {
  it('should return true for valid image generation outputs', () => {
    const output = {
      id: 'img-1',
      type: 'image_generation_call',
      status: 'completed',
      result: 'base64data',
    };
    expect(isImageGenerationOutput(output)).toBe(true);
  });

  it('should return false for other types', () => {
    expect(isImageGenerationOutput({ type: 'tool_call' })).toBe(false);
    expect(isImageGenerationOutput({ type: 'text' })).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isImageGenerationOutput(null)).toBe(false);
    expect(isImageGenerationOutput(undefined)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isImageGenerationOutput('string')).toBe(false);
    expect(isImageGenerationOutput(123)).toBe(false);
  });
});

describe('extractImageOutputs', () => {
  it('should extract image generation outputs from additional_kwargs', () => {
    const additionalKwargs = {
      tool_outputs: [
        {
          id: 'img-1',
          type: 'image_generation_call',
          status: 'completed',
          result: 'base64data',
        },
        {
          id: 'tool-1',
          type: 'tool_call',
          status: 'completed',
        },
      ],
    };

    const result = extractImageOutputs(additionalKwargs);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('img-1');
  });

  it('should return empty array for undefined additional_kwargs', () => {
    expect(extractImageOutputs(undefined)).toEqual([]);
  });

  it('should return empty array when tool_outputs is not an array', () => {
    expect(extractImageOutputs({ tool_outputs: 'not-array' })).toEqual([]);
    expect(extractImageOutputs({})).toEqual([]);
  });
});

describe('processLangGraphEvent', () => {
  const createMockState = (): LangGraphEventState => ({
    messageSeen: new Map(),
    messageConcat: new Map(),
    emittedToolCalls: new Set<string>(),
    emittedToolInputs: new Set<string>(),
    emittedImages: new Set<string>(),
    emittedReasoningIds: new Set<string>(),
    messageReasoningIds: new Map(),
    toolCallInfoByIndex: new Map(),
    currentStep: null as number | null,
    emittedToolCallsByKey: new Map<string, string>(),
    emittedSourceIds: new Set<string>(),
  });

  it('should handle custom events without type field (fallback to data-custom)', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(['custom', { data: 'value' }], state, controller);

    expect(chunks).toEqual([
      {
        type: 'data-custom',
        id: undefined,
        transient: true,
        data: { data: 'value' },
      },
    ]);
  });

  it('should handle custom events with type field (data-{type})', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      ['custom', { type: 'progress', value: 50, message: 'Processing...' }],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-progress',
        id: undefined,
        transient: true,
        data: { type: 'progress', value: 50, message: 'Processing...' },
      },
    ]);
  });

  it('should handle custom events with id field (persistent, not transient)', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'custom',
        { type: 'progress', id: 'progress-1', value: 50, message: 'Half done' },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-progress',
        id: 'progress-1',
        transient: false, // Has id, so NOT transient
        data: {
          type: 'progress',
          id: 'progress-1',
          value: 50,
          message: 'Half done',
        },
      },
    ]);
  });

  it('should handle custom events with different type names', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    // Test status event
    processLangGraphEvent(
      ['custom', { type: 'status', step: 'fetching', complete: false }],
      state,
      controller,
    );

    // Test analytics event
    processLangGraphEvent(
      ['custom', { type: 'analytics', event: 'tool_called', tool: 'weather' }],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-status',
        id: undefined,
        transient: true,
        data: { type: 'status', step: 'fetching', complete: false },
      },
      {
        type: 'data-analytics',
        id: undefined,
        transient: true,
        data: { type: 'analytics', event: 'tool_called', tool: 'weather' },
      },
    ]);
  });

  it('should handle three-element arrays with namespace', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      ['namespace', 'custom', { data: 'value' }],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-custom',
        id: undefined,
        transient: true,
        data: { data: 'value' },
      },
    ]);
  });

  it('should handle three-element arrays with namespace and type field', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      ['namespace', 'custom', { type: 'progress', value: 75 }],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-progress',
        id: undefined,
        transient: true,
        data: { type: 'progress', value: 75 },
      },
    ]);
  });

  it('should handle custom events with string data (fallback to data-custom)', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(['custom', 'simple string data'], state, controller);

    expect(chunks).toEqual([
      {
        type: 'data-custom',
        id: undefined,
        transient: true,
        data: 'simple string data',
      },
    ]);
  });

  it('should handle custom events with array data (fallback to data-custom)', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      ['custom', [1, 2, 3, { type: 'ignored' }]],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-custom',
        id: undefined,
        transient: true,
        data: [1, 2, 3, { type: 'ignored' }],
      },
    ]);
  });

  it('should handle tools stream on_tool_start with input chunks', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_start',
          toolCallId: 'call-weather',
          name: 'get_weather',
          input: { city: 'SF' },
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: { city: 'SF' },
        dynamic: true,
      },
    ]);
  });

  it('should handle tools stream preliminary on_tool_event', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_event',
          toolCallId: 'call-weather',
          name: 'get_weather',
          data: { status: 'loading', message: 'Fetching weather' },
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: undefined,
        dynamic: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-weather',
        output: { status: 'loading', message: 'Fetching weather' },
        preliminary: true,
      },
    ]);
  });

  it('should handle tools stream multiple preliminary chunks', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_event',
          toolCallId: 'call-weather',
          name: 'get_weather',
          data: { status: 'loading' },
        },
      ],
      state,
      controller,
    );
    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_event',
          toolCallId: 'call-weather',
          name: 'get_weather',
          data: { status: 'success', temperature: 72 },
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: undefined,
        dynamic: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-weather',
        output: { status: 'loading' },
        preliminary: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-weather',
        output: { status: 'success', temperature: 72 },
        preliminary: true,
      },
    ]);
  });

  it('should handle tools stream final on_tool_end without preliminary chunks', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_end',
          toolCallId: 'call-weather',
          name: 'get_weather',
          output: { temperature: 72 },
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: undefined,
        dynamic: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-weather',
        output: { temperature: 72 },
      },
    ]);
  });

  it('should handle tools stream on_tool_error', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        'tools',
        {
          event: 'on_tool_error',
          toolCallId: 'call-weather',
          name: 'get_weather',
          error: new Error('Weather API failed'),
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: undefined,
        dynamic: true,
      },
      {
        type: 'tool-output-error',
        toolCallId: 'call-weather',
        errorText: 'Weather API failed',
      },
    ]);
  });

  it('should handle tools stream namespace tuple form', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      [
        ['agent:run-1', 'tools:run-2'],
        'tools',
        {
          event: 'on_tool_end',
          toolCallId: 'call-weather',
          name: 'get_weather',
          output: 'Sunny',
        },
      ],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'tool-input-start',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        dynamic: true,
      },
      {
        type: 'tool-input-available',
        toolCallId: 'call-weather',
        toolName: 'get_weather',
        input: undefined,
        dynamic: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-weather',
        output: 'Sunny',
      },
    ]);
  });

  it('should keep custom events as data-* chunks when tools events are supported', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(
      ['custom', { type: 'progress', step: 'tools', complete: false }],
      state,
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'data-progress',
        id: undefined,
        transient: true,
        data: { type: 'progress', step: 'tools', complete: false },
      },
    ]);
  });

  it('should handle AI message chunks with text content', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: 'Hello', id: 'msg-1' });
    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    expect(chunks).toContainEqual({ type: 'text-start', id: 'msg-1' });
    expect(chunks).toContainEqual({
      type: 'text-delta',
      delta: 'Hello',
      id: 'msg-1',
    });
  });

  it('should skip messages without id', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: 'Hello' });
    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    expect(chunks).toHaveLength(0);
  });

  it('should handle tool message output', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const toolMsg = new ToolMessage({
      tool_call_id: 'call-1',
      content: 'Tool result',
    });
    toolMsg.id = 'msg-1';
    processLangGraphEvent(['messages', [toolMsg]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-output-available',
      toolCallId: 'call-1',
      output: 'Tool result',
    });
  });

  it('should handle plain AI message objects from RemoteGraph', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const plainMsg = { type: 'ai', content: 'Hello', id: 'msg-1' };
    processLangGraphEvent(['messages', [plainMsg]], state, controller);

    expect(chunks).toContainEqual({ type: 'text-start', id: 'msg-1' });
    expect(chunks).toContainEqual({
      type: 'text-delta',
      delta: 'Hello',
      id: 'msg-1',
    });
  });

  it('should handle plain AI message objects with type: AIMessageChunk from Python RemoteGraph', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    /**
     * Python langchain-core serializes streaming chunks with
     * type === 'AIMessageChunk' instead of TypeScript's type === 'ai'.
     * Regression test for issue #14341.
     */
    const plainMsg = {
      type: 'AIMessageChunk',
      content: 'Hello',
      id: 'msg-1',
    };
    processLangGraphEvent(['messages', [plainMsg]], state, controller);

    expect(chunks).toContainEqual({ type: 'text-start', id: 'msg-1' });
    expect(chunks).toContainEqual({
      type: 'text-delta',
      delta: 'Hello',
      id: 'msg-1',
    });
  });

  it('should not pollute Object.prototype from remote text message ids', () => {
    clearObjectPrototypeProperties();
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    try {
      const plainMsg = { type: 'ai', content: 'Hello', id: '__proto__' };
      processLangGraphEvent(['messages', [plainMsg]], state, controller);

      expect(chunks).toContainEqual({ type: 'text-start', id: '__proto__' });
      expect(chunks).toContainEqual({
        type: 'text-delta',
        delta: 'Hello',
        id: '__proto__',
      });
      expect(state.messageSeen.get('__proto__')).toEqual({ text: true });
      expectObjectPrototypeNotPolluted();
    } finally {
      clearObjectPrototypeProperties();
    }
  });

  it('should not pollute Object.prototype from remote reasoning message ids', () => {
    clearObjectPrototypeProperties();
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    try {
      const plainMsg = {
        type: 'ai',
        content: '',
        contentBlocks: [{ type: 'reasoning', reasoning: 'Thinking...' }],
        id: '__proto__',
      };
      processLangGraphEvent(['messages', [plainMsg]], state, controller);

      expect(chunks).toContainEqual({
        type: 'reasoning-start',
        id: '__proto__',
      });
      expect(chunks).toContainEqual({
        type: 'reasoning-delta',
        delta: 'Thinking...',
        id: '__proto__',
      });
      expect(state.messageSeen.get('__proto__')).toEqual({ reasoning: true });
      expectObjectPrototypeNotPolluted();
    } finally {
      clearObjectPrototypeProperties();
    }
  });

  it('should not pollute Object.prototype from remote tool call message ids', () => {
    clearObjectPrototypeProperties();
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    try {
      const plainMsg = {
        type: 'ai',
        content: '',
        id: '__proto__',
        tool_call_chunks: [
          { id: 'call-1', name: 'test_tool', args: '{"value":', index: 0 },
        ],
      };
      processLangGraphEvent(['messages', [plainMsg]], state, controller);

      expect(chunks).toContainEqual({
        type: 'tool-input-start',
        toolCallId: 'call-1',
        toolName: 'test_tool',
        dynamic: true,
      });
      expect(chunks).toContainEqual({
        type: 'tool-input-delta',
        toolCallId: 'call-1',
        inputTextDelta: '{"value":',
      });
      expect(state.messageSeen.get('__proto__')?.tool?.has('call-1')).toBe(
        true,
      );
      expect(state.toolCallInfoByIndex.get('__proto__')?.get(0)).toEqual({
        id: 'call-1',
        name: 'test_tool',
      });
      expectObjectPrototypeNotPolluted();
    } finally {
      clearObjectPrototypeProperties();
    }
  });

  it('should handle plain tool message objects from RemoteGraph', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const plainToolMsg = {
      type: 'tool',
      content: 'Result',
      id: 'msg-1',
      tool_call_id: 'call-1',
    };
    processLangGraphEvent(['messages', [plainToolMsg]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-output-available',
      toolCallId: 'call-1',
      output: 'Result',
    });
  });

  it('should handle values event and finalize pending messages', () => {
    const state = createMockState();
    state.messageSeen.set('msg-1', { text: true });
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processLangGraphEvent(['values', {}], state, controller);

    expect(chunks).toContainEqual({ type: 'text-end', id: 'msg-1' });
    expect(state.messageSeen.has('msg-1')).toBe(false);
  });

  it('should handle tool calls in values event', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'ai',
          tool_calls: [
            { id: 'call-1', name: 'get_weather', args: { city: 'NYC' } },
          ],
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    // Should emit tool-input-start before tool-input-available for non-streamed tool calls
    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      dynamic: true,
    });
    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      input: { city: 'NYC' },
      dynamic: true,
    });
  });

  it('should handle tool calls in values event for Python type: AIMessageChunk', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    /**
     * Regression test for issue #14341. Python langchain-core uses
     * type === 'AIMessageChunk' for plain message objects from RemoteGraph;
     * tool_calls in values events should be extracted in that case too.
     */
    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'AIMessageChunk',
          tool_calls: [
            { id: 'call-1', name: 'get_weather', args: { city: 'NYC' } },
          ],
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      dynamic: true,
    });
    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      input: { city: 'NYC' },
      dynamic: true,
    });
  });

  it('should not duplicate already emitted tool calls', () => {
    const state = createMockState();
    state.emittedToolCalls.add('call-1');
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'ai',
          tool_calls: [
            { id: 'call-1', name: 'get_weather', args: { city: 'NYC' } },
          ],
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    const toolInputEvents = chunks.filter(
      (c: unknown) =>
        (c as { type: string }).type === 'tool-input-available' ||
        (c as { type: string }).type === 'tool-input-start',
    );
    expect(toolInputEvents).toHaveLength(0);
  });

  it('should emit GPT-5 reasoning from values event when not streamed', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'ai',
          content: '',
          response_metadata: {
            output: [
              {
                id: 'rs_123',
                type: 'reasoning',
                summary: [
                  {
                    type: 'summary_text',
                    text: 'Analyzing the user request step by step...',
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    expect(chunks).toContainEqual({ type: 'reasoning-start', id: 'msg-1' });
    expect(chunks).toContainEqual({
      type: 'reasoning-delta',
      delta: 'Analyzing the user request step by step...',
      id: 'msg-1',
    });
    expect(chunks).toContainEqual({ type: 'reasoning-end', id: 'msg-1' });
  });

  it('should not duplicate reasoning already emitted during streaming', () => {
    const state = createMockState();
    // Mark reasoning ID as already emitted (simulates streaming having already emitted this reasoning)
    state.emittedReasoningIds.add('rs_123');
    state.messageSeen.set('msg-1', { reasoning: true });
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'ai',
          content: '',
          response_metadata: {
            output: [
              {
                id: 'rs_123',
                type: 'reasoning',
                summary: [
                  {
                    type: 'summary_text',
                    text: 'This should not be emitted again...',
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    // Should only emit reasoning-end (for finalization), not start/delta
    // because we already emitted reasoning with ID 'rs_123' during streaming
    const reasoningStartEvents = chunks.filter(
      (c: unknown) => (c as { type: string }).type === 'reasoning-start',
    );
    const reasoningDeltaEvents = chunks.filter(
      (c: unknown) => (c as { type: string }).type === 'reasoning-delta',
    );
    expect(reasoningStartEvents).toHaveLength(0);
    expect(reasoningDeltaEvents).toHaveLength(0);
  });

  it('should handle tool calls in additional_kwargs format', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesData = {
      messages: [
        {
          id: 'msg-1',
          type: 'ai',
          additional_kwargs: {
            tool_calls: [
              {
                id: 'call-1',
                function: {
                  name: 'get_weather',
                  arguments: '{"city":"NYC"}',
                },
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesData], state, controller);

    // Should emit tool-input-start before tool-input-available for non-streamed tool calls
    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      dynamic: true,
    });
    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      input: { city: 'NYC' },
      dynamic: true,
    });
  });

  it('should handle image generation outputs', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: '', id: 'msg-1' });
    (
      aiChunk as unknown as { additional_kwargs: Record<string, unknown> }
    ).additional_kwargs = {
      tool_outputs: [
        {
          id: 'img-1',
          type: 'image_generation_call',
          status: 'completed',
          result: 'base64imagedata',
          output_format: 'png',
        },
      ],
    };

    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    expect(chunks).toContainEqual({
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,base64imagedata',
    });
    expect(state.emittedImages.has('img-1')).toBe(true);
  });

  it('should not emit duplicate images', () => {
    const state = createMockState();
    state.emittedImages.add('img-1');
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: '', id: 'msg-1' });
    (
      aiChunk as unknown as { additional_kwargs: Record<string, unknown> }
    ).additional_kwargs = {
      tool_outputs: [
        {
          id: 'img-1',
          type: 'image_generation_call',
          status: 'completed',
          result: 'base64imagedata',
        },
      ],
    };

    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    const fileEvents = chunks.filter(
      (c: unknown) => (c as { type: string }).type === 'file',
    );
    expect(fileEvents).toHaveLength(0);
  });

  it('should handle tool call chunks with streaming', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
      tool_call_chunks: [
        {
          id: 'call-1',
          name: 'get_weather',
          args: '{"city":',
          index: 0,
        },
      ],
    });

    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      dynamic: true,
    });
    expect(chunks).toContainEqual({
      type: 'tool-input-delta',
      toolCallId: 'call-1',
      inputTextDelta: '{"city":',
    });
    expect(state.emittedToolCalls.has('call-1')).toBe(true);
  });

  it('should skip tool call chunks without id', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({
      content: '',
      id: 'msg-1',
      tool_call_chunks: [
        {
          // No id
          name: 'get_weather',
          args: '{"city":',
          index: 0,
        },
      ],
    });

    processLangGraphEvent(['messages', [aiChunk]], state, controller);

    const toolEvents = chunks.filter(
      (c: unknown) =>
        (c as { type: string }).type === 'tool-input-start' ||
        (c as { type: string }).type === 'tool-input-delta',
    );
    expect(toolEvents).toHaveLength(0);
  });

  it('should emit start-step on first message with langgraph_step', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: 'Hello', id: 'msg-1' });
    const metadata = { langgraph_step: 1, langgraph_node: 'model' };

    processLangGraphEvent(['messages', [aiChunk, metadata]], state, controller);

    expect(chunks).toContainEqual({ type: 'start-step' });
    expect(state.currentStep).toBe(1);
  });

  it('should emit finish-step and start-step on step change', () => {
    const state = createMockState();
    state.currentStep = 1;
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({ content: 'Hello', id: 'msg-1' });
    const metadata = { langgraph_step: 2, langgraph_node: 'tools' };

    processLangGraphEvent(['messages', [aiChunk, metadata]], state, controller);

    expect(chunks[0]).toEqual({ type: 'finish-step' });
    expect(chunks[1]).toEqual({ type: 'start-step' });
    expect(state.currentStep).toBe(2);
  });

  it('should not emit step events when step unchanged', () => {
    const state = createMockState();
    state.currentStep = 1;
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const aiChunk = new AIMessageChunk({
      content: 'More content',
      id: 'msg-1',
    });
    const metadata = { langgraph_step: 1, langgraph_node: 'model' };

    processLangGraphEvent(['messages', [aiChunk, metadata]], state, controller);

    const stepEvents = chunks.filter(
      (c: unknown) =>
        (c as { type: string }).type === 'start-step' ||
        (c as { type: string }).type === 'finish-step',
    );
    expect(stepEvents).toHaveLength(0);
  });

  it('should emit tool-output-error for ToolMessage with status error', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const toolMsg = new ToolMessage({
      tool_call_id: 'call-1',
      content: 'Connection timeout',
    });
    toolMsg.id = 'msg-1';
    // Simulate error status (not directly settable via constructor)
    (toolMsg as unknown as { status: string }).status = 'error';

    processLangGraphEvent(['messages', [toolMsg]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-output-error',
      toolCallId: 'call-1',
      errorText: 'Connection timeout',
    });
  });

  it('should emit tool-output-available for ToolMessage with status success', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const toolMsg = new ToolMessage({
      tool_call_id: 'call-1',
      content: 'Result data',
    });
    toolMsg.id = 'msg-1';
    (toolMsg as unknown as { status: string }).status = 'success';

    processLangGraphEvent(['messages', [toolMsg]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-output-available',
      toolCallId: 'call-1',
      output: 'Result data',
    });
  });

  it('should handle plain tool message objects with error status', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const plainToolMsg = {
      type: 'tool',
      content: 'API rate limit exceeded',
      id: 'msg-1',
      tool_call_id: 'call-1',
      status: 'error',
    };

    processLangGraphEvent(['messages', [plainToolMsg]], state, controller);

    expect(chunks).toContainEqual({
      type: 'tool-output-error',
      toolCallId: 'call-1',
      errorText: 'API rate limit exceeded',
    });
  });

  it('should handle HITL interrupt in values event', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesWithInterrupt = {
      messages: [],
      __interrupt__: [
        {
          value: {
            action_requests: [
              {
                name: 'send_email',
                arguments: {
                  to: 'test@example.com',
                  subject: 'Hello',
                  body: 'Test message',
                },
                id: 'call-hitl-1',
              },
            ],
            review_configs: [
              {
                action_name: 'send_email',
                allowed_decisions: ['approve', 'edit', 'reject'],
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesWithInterrupt], state, controller);

    // Should emit tool-input-start before tool-input-available for HITL tools
    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-hitl-1',
      toolName: 'send_email',
      dynamic: true,
    });
    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-hitl-1',
      toolName: 'send_email',
      input: {
        to: 'test@example.com',
        subject: 'Hello',
        body: 'Test message',
      },
      dynamic: true,
    });

    expect(chunks).toContainEqual({
      type: 'tool-approval-request',
      approvalId: 'call-hitl-1',
      toolCallId: 'call-hitl-1',
    });
  });

  it('should handle multiple HITL interrupts in values event', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesWithMultipleInterrupts = {
      messages: [],
      __interrupt__: [
        {
          value: {
            action_requests: [
              {
                name: 'send_email',
                arguments: { to: 'user@example.com' },
                id: 'call-email-1',
              },
              {
                name: 'delete_file',
                arguments: { filename: 'temp.txt' },
                id: 'call-delete-1',
              },
            ],
            review_configs: [
              {
                action_name: 'send_email',
                allowed_decisions: ['approve', 'reject'],
              },
              {
                action_name: 'delete_file',
                allowed_decisions: ['approve', 'reject'],
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(
      ['values', valuesWithMultipleInterrupts],
      state,
      controller,
    );

    // Check both tool starts
    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-email-1',
      toolName: 'send_email',
      dynamic: true,
    });

    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call-delete-1',
      toolName: 'delete_file',
      dynamic: true,
    });

    // Check both tool inputs
    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-email-1',
      toolName: 'send_email',
      input: { to: 'user@example.com' },
      dynamic: true,
    });

    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: 'call-delete-1',
      toolName: 'delete_file',
      input: { filename: 'temp.txt' },
      dynamic: true,
    });

    // Check both approval requests
    expect(chunks).toContainEqual({
      type: 'tool-approval-request',
      approvalId: 'call-email-1',
      toolCallId: 'call-email-1',
    });

    expect(chunks).toContainEqual({
      type: 'tool-approval-request',
      approvalId: 'call-delete-1',
      toolCallId: 'call-delete-1',
    });
  });

  it('should generate fallback ID for HITL interrupt without id', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const valuesWithInterruptNoId = {
      messages: [],
      __interrupt__: [
        {
          value: {
            action_requests: [
              {
                name: 'send_email',
                arguments: { to: 'test@example.com' },
                // no id provided
              },
            ],
            review_configs: [],
          },
        },
      ],
    };

    processLangGraphEvent(
      ['values', valuesWithInterruptNoId],
      state,
      controller,
    );

    // Should have generated a fallback ID and emit tool-input-start first
    const toolStartChunk = chunks.find(
      (
        c,
      ): c is {
        type: 'tool-input-start';
        toolCallId: string;
        toolName: string;
      } => (c as { type: string }).type === 'tool-input-start',
    );
    expect(toolStartChunk).toBeDefined();
    expect(toolStartChunk?.toolCallId).toMatch(/^hitl-send_email-/);

    const toolInputChunk = chunks.find(
      (
        c,
      ): c is {
        type: 'tool-input-available';
        toolCallId: string;
        toolName: string;
        input: unknown;
      } => (c as { type: string }).type === 'tool-input-available',
    );
    expect(toolInputChunk).toBeDefined();
    expect(toolInputChunk?.toolCallId).toMatch(/^hitl-send_email-/);
    expect(toolInputChunk?.toolCallId).toBe(toolStartChunk?.toolCallId);

    const approvalChunk = chunks.find(
      (
        c,
      ): c is {
        type: 'tool-approval-request';
        approvalId: string;
        toolCallId: string;
      } => (c as { type: string }).type === 'tool-approval-request',
    );
    expect(approvalChunk).toBeDefined();
    expect(approvalChunk?.toolCallId).toBe(toolInputChunk?.toolCallId);
  });

  it('should handle JS SDK camelCase interrupt format (actionRequests, args)', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    // JS SDK uses camelCase: actionRequests with args instead of arguments
    const valuesWithInterrupt = {
      messages: [],
      __interrupt__: [
        {
          id: 'interrupt-123',
          value: {
            actionRequests: [
              {
                name: 'send_email',
                args: {
                  to: 'test@example.com',
                  subject: 'Hello',
                },
              },
            ],
            reviewConfigs: [
              {
                actionName: 'send_email',
                allowedDecisions: ['approve', 'edit', 'reject'],
              },
            ],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesWithInterrupt], state, controller);

    // Should emit tool-input-start before tool-input-available
    expect(chunks).toContainEqual({
      type: 'tool-input-start',
      toolCallId: expect.stringMatching(/^hitl-send_email-/),
      toolName: 'send_email',
      dynamic: true,
    });

    expect(chunks).toContainEqual({
      type: 'tool-input-available',
      toolCallId: expect.stringMatching(/^hitl-send_email-/),
      toolName: 'send_email',
      input: { to: 'test@example.com', subject: 'Hello' },
      dynamic: true,
    });

    const approvalChunk = chunks.find(
      (
        c,
      ): c is {
        type: 'tool-approval-request';
        approvalId: string;
        toolCallId: string;
      } => (c as { type: string }).type === 'tool-approval-request',
    );
    expect(approvalChunk).toBeDefined();
  });

  it('should reuse existing tool call ID when interrupt matches previously emitted tool call', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    // Simulate tool-input-available already emitted with specific ID
    const toolCallId = 'call_xAIvZJjC2JwEtTrHoiRaVBXs';
    const toolName = 'send_email';
    const input = { to: 'john@example.com', subject: 'Hello', body: 'Hello' };

    // Pre-populate the state as if tool was already emitted
    state.emittedToolCalls.add(toolCallId);
    state.emittedToolCallsByKey.set(
      `${toolName}:${JSON.stringify(input)}`,
      toolCallId,
    );

    // Now process interrupt with same tool name and args
    const valuesWithInterrupt = {
      __interrupt__: [
        {
          id: 'interrupt-456',
          value: {
            actionRequests: [
              {
                name: toolName,
                args: input,
                // Note: no id field in action request
              },
            ],
            reviewConfigs: [],
          },
        },
      ],
    };

    processLangGraphEvent(['values', valuesWithInterrupt], state, controller);

    // Should NOT emit tool-input-start or tool-input-available (already emitted)
    expect(
      chunks.filter(
        c =>
          (c as { type: string }).type === 'tool-input-start' ||
          (c as { type: string }).type === 'tool-input-available',
      ),
    ).toHaveLength(0);

    // Should emit tool-approval-request with the ORIGINAL tool call ID
    expect(chunks).toContainEqual({
      type: 'tool-approval-request',
      approvalId: toolCallId,
      toolCallId: toolCallId,
    });
  });
});

describe('isCitationContentBlock', () => {
  it('should return true for a citation block', () => {
    expect(isCitationContentBlock({ type: 'citation', url: 'x' })).toBe(true);
  });

  it('should return false for non-citation blocks', () => {
    expect(isCitationContentBlock({ type: 'text', text: 'hi' })).toBe(false);
    expect(isCitationContentBlock(null)).toBe(false);
    expect(isCitationContentBlock('citation')).toBe(false);
  });
});

describe('extractCitationsFromContentBlocks', () => {
  it('should extract citation annotations from text content blocks', () => {
    const msg = new AIMessageChunk({
      content: [
        {
          type: 'text',
          text: 'The sky is blue.',
          annotations: [
            {
              type: 'citation',
              url: 'https://example.com/sky',
              title: 'Why the sky is blue',
              citedText: 'Rayleigh scattering',
              startIndex: 0,
              endIndex: 16,
            },
          ],
        },
      ],
      id: 'msg-1',
    });

    const citations = extractCitationsFromContentBlocks(msg);

    expect(citations).toEqual([
      {
        url: 'https://example.com/sky',
        title: 'Why the sky is blue',
        source: undefined,
        citedText: 'Rayleigh scattering',
        startIndex: 0,
        endIndex: 16,
      },
    ]);
  });

  it('should return an empty array when annotations are empty', () => {
    const msg = new AIMessageChunk({
      content: [{ type: 'text', text: 'No sources.', annotations: [] }],
      id: 'msg-1',
    });

    expect(extractCitationsFromContentBlocks(msg)).toEqual([]);
  });

  it('should return an empty array for plain string content', () => {
    const msg = new AIMessageChunk({ content: 'just text', id: 'msg-1' });

    expect(extractCitationsFromContentBlocks(msg)).toEqual([]);
  });

  it('should ignore non-citation annotations', () => {
    const msg = new AIMessageChunk({
      content: [
        {
          type: 'text',
          text: 'Hi',
          annotations: [{ type: 'something-else', value: 1 }],
        },
      ],
      id: 'msg-1',
    });

    expect(extractCitationsFromContentBlocks(msg)).toEqual([]);
  });

  it('should extract from serialized LangChain messages (kwargs)', () => {
    const serialized = {
      lc: 1,
      type: 'constructor',
      id: ['langchain_core', 'messages', 'AIMessageChunk'],
      kwargs: {
        content: [
          {
            type: 'text',
            text: 'Hello',
            annotations: [{ type: 'citation', url: 'https://example.com' }],
          },
        ],
      },
    };

    expect(extractCitationsFromContentBlocks(serialized)).toEqual([
      {
        url: 'https://example.com',
        title: undefined,
        source: undefined,
        citedText: undefined,
        startIndex: undefined,
        endIndex: undefined,
      },
    ]);
  });
});

describe('emitSourceChunks', () => {
  it('should emit a source-url chunk for citations with a url', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);
    const citations: NormalizedCitation[] = [
      {
        url: 'https://example.com/doc',
        title: 'Doc Title',
        citedText: 'excerpt',
        startIndex: 5,
        endIndex: 12,
        source: 'web',
      },
    ];

    emitSourceChunks(citations, 'msg-1', new Set(), controller);

    expect(chunks).toEqual([
      {
        type: 'source-url',
        sourceId: 'https://example.com/doc',
        url: 'https://example.com/doc',
        title: 'Doc Title',
        providerMetadata: {
          langchain: {
            citedText: 'excerpt',
            startIndex: 5,
            endIndex: 12,
            source: 'web',
          },
        },
      },
    ]);
  });

  it('should emit a source-document chunk for url-less citations with a title', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);
    const citations: NormalizedCitation[] = [
      { title: 'Local Doc', citedText: 'quoted text' },
    ];

    emitSourceChunks(citations, 'msg-1', new Set(), controller);

    expect(chunks).toEqual([
      {
        type: 'source-document',
        sourceId: 'msg-1:Local Doc:quoted text::',
        mediaType: 'text/plain',
        title: 'Local Doc',
        providerMetadata: {
          langchain: { citedText: 'quoted text' },
        },
      },
    ]);
  });

  it('should skip url-less citations that have no title or source', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    emitSourceChunks(
      [{ citedText: 'orphan excerpt' }],
      'msg-1',
      new Set(),
      controller,
    );

    expect(chunks).toEqual([]);
  });

  it('should not collide url-less source ids across differing citation orders', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);
    const emittedSourceIds = new Set<string>();

    emitSourceChunks(
      [{ title: 'A' }, { title: 'B' }],
      'msg-1',
      emittedSourceIds,
      controller,
    );
    // 'B' alone, at index 0 this time: must still be deduped, 'A' must not reappear.
    emitSourceChunks([{ title: 'B' }], 'msg-1', emittedSourceIds, controller);

    const docs = chunks.filter(
      c => (c as { type: string }).type === 'source-document',
    ) as Array<{ title: string }>;
    expect(docs.map(d => d.title)).toEqual(['A', 'B']);
  });

  it('should omit providerMetadata when there are no extra fields', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    emitSourceChunks(
      [{ url: 'https://example.com' }],
      'msg-1',
      new Set(),
      controller,
    );

    expect(chunks).toEqual([
      {
        type: 'source-url',
        sourceId: 'https://example.com',
        url: 'https://example.com',
      },
    ]);
  });

  it('should dedupe by sourceId across calls', () => {
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);
    const emittedSourceIds = new Set<string>();
    const citation: NormalizedCitation = { url: 'https://example.com' };

    emitSourceChunks([citation], 'msg-1', emittedSourceIds, controller);
    emitSourceChunks([citation], 'msg-1', emittedSourceIds, controller);

    expect(
      chunks.filter(c => (c as { type: string }).type === 'source-url'),
    ).toHaveLength(1);
  });
});

describe('processModelChunk - sources', () => {
  it('should emit source-url after text for citation annotations', () => {
    const chunk = new AIMessageChunk({
      content: [
        {
          type: 'text',
          text: 'Answer',
          annotations: [
            { type: 'citation', url: 'https://example.com', title: 'Ex' },
          ],
        },
      ],
      id: 'msg-1',
    });
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(
      chunks.filter(c => (c as { type: string }).type.startsWith('source-')),
    ).toEqual([
      {
        type: 'source-url',
        sourceId: 'https://example.com',
        url: 'https://example.com',
        title: 'Ex',
      },
    ]);
    // source must come after the text-delta
    const textIdx = chunks.findIndex(
      c => (c as { type: string }).type === 'text-delta',
    );
    const sourceIdx = chunks.findIndex(
      c => (c as { type: string }).type === 'source-url',
    );
    expect(sourceIdx).toBeGreaterThan(textIdx);
  });

  it('should emit no source chunks when annotations are empty', () => {
    const chunk = new AIMessageChunk({
      content: [{ type: 'text', text: 'Answer', annotations: [] }],
      id: 'msg-1',
    });
    const state = {
      started: false,
      messageId: 'default',
      reasoningStarted: false,
      textStarted: false,
    };
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    processModelChunk(chunk, state, controller);

    expect(
      chunks.filter(c => (c as { type: string }).type.startsWith('source-')),
    ).toHaveLength(0);
  });
});

describe('processLangGraphEvent - sources', () => {
  const createMockState = (): LangGraphEventState => ({
    messageSeen: new Map(),
    messageConcat: new Map(),
    emittedToolCalls: new Set<string>(),
    emittedToolInputs: new Set<string>(),
    emittedImages: new Set<string>(),
    emittedReasoningIds: new Set<string>(),
    messageReasoningIds: new Map(),
    toolCallInfoByIndex: new Map(),
    currentStep: null as number | null,
    emittedToolCallsByKey: new Map<string, string>(),
    emittedSourceIds: new Set<string>(),
  });

  it('should emit source-url for citations in a messages event', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const msg = new AIMessageChunk({
      content: [
        {
          type: 'text',
          text: 'Hello',
          annotations: [{ type: 'citation', url: 'https://example.com' }],
        },
      ],
      id: 'msg-1',
    });

    processLangGraphEvent(['messages', [msg, {}]], state, controller);

    const sourceChunks = chunks.filter(c =>
      (c as { type: string }).type.startsWith('source-'),
    );
    expect(sourceChunks).toEqual([
      {
        type: 'source-url',
        sourceId: 'https://example.com',
        url: 'https://example.com',
      },
    ]);
  });

  it('should not double-emit a source seen in both messages and values', () => {
    const state = createMockState();
    const chunks: unknown[] = [];
    const controller = createMockController(chunks);

    const msg = new AIMessageChunk({
      content: [
        {
          type: 'text',
          text: 'Hello',
          annotations: [{ type: 'citation', url: 'https://example.com' }],
        },
      ],
      id: 'msg-1',
    });

    processLangGraphEvent(['messages', [msg, {}]], state, controller);
    processLangGraphEvent(['values', { messages: [msg] }], state, controller);

    expect(
      chunks.filter(c => (c as { type: string }).type === 'source-url'),
    ).toHaveLength(1);
  });
});
