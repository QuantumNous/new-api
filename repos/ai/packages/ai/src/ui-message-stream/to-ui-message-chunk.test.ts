import { dynamicTool, tool } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';
import type { GeneratedFile } from '../generate-text';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import type { ProviderMetadata } from '../types/provider-metadata';
import { toUIMessageChunk } from './to-ui-message-chunk';

const providerMetadata: ProviderMetadata = {
  testProvider: { signature: 'sig-1' },
};

const toolMetadata = { clientName: 'test-client' };

const tools = {
  staticTool: tool({
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.string(),
  }),
  dynamicTool: dynamicTool({
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
  }),
};

type Tools = typeof tools;

const file: GeneratedFile = {
  base64: 'SGVsbG8=',
  uint8Array: new Uint8Array([72, 101, 108, 108, 111]),
  mediaType: 'text/plain',
};

describe('toUIMessageChunk', () => {
  it('maps text parts and preserves provider metadata', () => {
    expect(
      toUIMessageChunk({
        type: 'text-start',
        id: 'text-1',
        providerMetadata,
      }),
    ).toEqual({
      type: 'text-start',
      id: 'text-1',
      providerMetadata,
    });

    expect(
      toUIMessageChunk({
        type: 'text-delta',
        id: 'text-1',
        text: 'hello',
        providerMetadata,
      }),
    ).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: 'hello',
      providerMetadata,
    });

    expect(
      toUIMessageChunk({
        type: 'text-end',
        id: 'text-1',
        providerMetadata,
      }),
    ).toEqual({
      type: 'text-end',
      id: 'text-1',
      providerMetadata,
    });
  });

  it('maps reasoning parts by default and suppresses them when disabled', () => {
    const reasoningParts = [
      {
        type: 'reasoning-start',
        id: 'reasoning-1',
        providerMetadata,
      },
      {
        type: 'reasoning-delta',
        id: 'reasoning-1',
        text: 'thinking',
        providerMetadata,
      },
      {
        type: 'reasoning-end',
        id: 'reasoning-1',
        providerMetadata,
      },
    ] satisfies TextStreamPart<{}>[];

    expect(reasoningParts.map(part => toUIMessageChunk(part)))
      .toMatchInlineSnapshot(`
        [
          {
            "id": "reasoning-1",
            "providerMetadata": {
              "testProvider": {
                "signature": "sig-1",
              },
            },
            "type": "reasoning-start",
          },
          {
            "delta": "thinking",
            "id": "reasoning-1",
            "providerMetadata": {
              "testProvider": {
                "signature": "sig-1",
              },
            },
            "type": "reasoning-delta",
          },
          {
            "id": "reasoning-1",
            "providerMetadata": {
              "testProvider": {
                "signature": "sig-1",
              },
            },
            "type": "reasoning-end",
          },
        ]
      `);

    expect(
      reasoningParts.map(part =>
        toUIMessageChunk(part, { sendReasoning: false }),
      ),
    ).toEqual([undefined, undefined, undefined]);
  });

  it('maps files and suppresses reasoning files when reasoning is disabled', () => {
    expect(
      toUIMessageChunk({
        type: 'file',
        file,
        providerMetadata,
      }),
    ).toEqual({
      type: 'file',
      mediaType: 'text/plain',
      url: 'data:text/plain;base64,SGVsbG8=',
      providerMetadata,
    });

    const reasoningFilePart = {
      type: 'reasoning-file',
      file,
      providerMetadata,
    } satisfies TextStreamPart<{}>;

    expect(toUIMessageChunk(reasoningFilePart)).toEqual({
      type: 'reasoning-file',
      mediaType: 'text/plain',
      url: 'data:text/plain;base64,SGVsbG8=',
      providerMetadata,
    });

    expect(
      toUIMessageChunk(reasoningFilePart, { sendReasoning: false }),
    ).toBeUndefined();
  });

  it('skips sources by default and sends them when enabled', () => {
    const urlSourcePart: TextStreamPart<{}> = {
      type: 'source',
      sourceType: 'url',
      id: 'source-1',
      url: 'https://example.com',
      title: 'Example',
      providerMetadata,
    };

    const documentSourcePart: TextStreamPart<{}> = {
      type: 'source',
      sourceType: 'document',
      id: 'source-2',
      mediaType: 'application/pdf',
      title: 'Document',
      filename: 'document.pdf',
      providerMetadata,
    };

    expect(toUIMessageChunk(urlSourcePart)).toBeUndefined();
    expect(toUIMessageChunk(documentSourcePart)).toBeUndefined();

    expect(toUIMessageChunk(urlSourcePart, { sendSources: true })).toEqual({
      type: 'source-url',
      sourceId: 'source-1',
      url: 'https://example.com',
      title: 'Example',
      providerMetadata,
    });

    expect(toUIMessageChunk(documentSourcePart, { sendSources: true })).toEqual(
      {
        type: 'source-document',
        sourceId: 'source-2',
        mediaType: 'application/pdf',
        title: 'Document',
        filename: 'document.pdf',
        providerMetadata,
      },
    );
  });

  it('maps custom and lifecycle parts', () => {
    expect(
      toUIMessageChunk({
        type: 'custom',
        kind: 'openai.compaction',
        providerMetadata,
      }),
    ).toEqual({
      type: 'custom',
      kind: 'openai.compaction',
      providerMetadata,
    });

    expect(
      toUIMessageChunk(
        { type: 'start' },
        {
          messageMetadata: { model: 'test-model' },
          responseMessageId: 'msg-1',
        },
      ),
    ).toEqual({
      type: 'start',
      messageId: 'msg-1',
      messageMetadata: { model: 'test-model' },
    });

    expect(
      toUIMessageChunk({ type: 'start' }, { sendStart: false }),
    ).toBeUndefined();

    expect(
      toUIMessageChunk(
        {
          type: 'finish',
          finishReason: 'stop',
          rawFinishReason: 'stop',
          totalUsage: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputTokenDetails: {
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
              noCacheTokens: undefined,
            },
            outputTokenDetails: {
              reasoningTokens: undefined,
              textTokens: undefined,
            },
          },
        },
        { messageMetadata: { model: 'test-model' } },
      ),
    ).toEqual({
      type: 'finish',
      finishReason: 'stop',
      messageMetadata: { model: 'test-model' },
    });

    expect(
      toUIMessageChunk(
        {
          type: 'finish',
          finishReason: 'stop',
          rawFinishReason: 'stop',
          totalUsage: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputTokenDetails: {
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
              noCacheTokens: undefined,
            },
            outputTokenDetails: {
              reasoningTokens: undefined,
              textTokens: undefined,
            },
          },
        },
        { sendFinish: false },
      ),
    ).toBeUndefined();

    expect(
      toUIMessageChunk({ type: 'start-step', request: {}, warnings: [] }),
    ).toEqual({ type: 'start-step' });

    expect(
      toUIMessageChunk({
        type: 'finish-step',
        response: {
          id: 'response-id',
          modelId: 'model-id',
          timestamp: new Date(0),
        },
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
          inputTokenDetails: {
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
            noCacheTokens: undefined,
          },
          outputTokenDetails: {
            reasoningTokens: undefined,
            textTokens: undefined,
          },
        },
        performance: {
          inputTokensPerSecond: 0,
          outputTokensPerSecond: 0,
          effectiveOutputTokensPerSecond: 0,
          effectiveTotalTokensPerSecond: 0,
          responseTimeMs: 0,
          stepTimeMs: 0,
          timeToFirstOutputMs: undefined,
          toolExecutionMs: {},
        },
        finishReason: 'stop',
        rawFinishReason: 'stop',
        providerMetadata,
      }),
    ).toEqual({ type: 'finish-step' });

    expect(toUIMessageChunk({ type: 'abort', reason: 'user' })).toEqual({
      type: 'abort',
      reason: 'user',
    });
  });

  it('maps tool input streaming parts', () => {
    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-input-start',
          id: 'call-1',
          toolName: 'dynamicTool',
          providerExecuted: true,
          providerMetadata,
          toolMetadata,
          title: 'Dynamic Tool',
        },
        { tools },
      ),
    ).toEqual({
      type: 'tool-input-start',
      toolCallId: 'call-1',
      toolName: 'dynamicTool',
      providerExecuted: true,
      providerMetadata,
      toolMetadata,
      dynamic: true,
      title: 'Dynamic Tool',
    });

    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-input-start',
          id: 'call-2',
          toolName: 'providerTool',
          dynamic: true,
        },
        { tools },
      ),
    ).toEqual({
      type: 'tool-input-start',
      toolCallId: 'call-2',
      toolName: 'providerTool',
      dynamic: true,
    });

    expect(
      toUIMessageChunk({
        type: 'tool-input-delta',
        id: 'call-1',
        delta: '{"value"',
      }),
    ).toEqual({
      type: 'tool-input-delta',
      toolCallId: 'call-1',
      inputTextDelta: '{"value"',
    });
  });

  it('maps valid and invalid tool call parts', () => {
    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'staticTool',
          input: { value: 'input' },
          providerExecuted: true,
          providerMetadata,
          toolMetadata,
          title: 'Static Tool',
        },
        { tools },
      ),
    ).toEqual({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'staticTool',
      input: { value: 'input' },
      providerExecuted: true,
      providerMetadata,
      toolMetadata,
      title: 'Static Tool',
    });

    expect(
      toUIMessageChunk<Tools>({
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'runtimeTool',
        input: { value: 'input' },
        dynamic: true,
      }),
    ).toEqual({
      type: 'tool-input-available',
      toolCallId: 'call-2',
      toolName: 'runtimeTool',
      input: { value: 'input' },
      dynamic: true,
    });

    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'runtimeTool',
          input: '{broken',
          dynamic: true,
          invalid: true,
          error: new Error('invalid input'),
          providerExecuted: true,
          providerMetadata,
          toolMetadata,
          title: 'Invalid Tool',
        },
        { onError: error => `handled: ${(error as Error).message}` },
      ),
    ).toEqual({
      type: 'tool-input-error',
      toolCallId: 'call-3',
      toolName: 'runtimeTool',
      input: '{broken',
      providerExecuted: true,
      providerMetadata,
      toolMetadata,
      dynamic: true,
      errorText: 'handled: invalid input',
      title: 'Invalid Tool',
    });
  });

  it('maps tool result, tool error, tool denial, and approval parts', () => {
    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'dynamicTool',
          input: { value: 'input' },
          output: { value: 'output' },
          providerExecuted: true,
          providerMetadata,
          toolMetadata,
          dynamic: true,
          preliminary: true,
        },
        { tools },
      ),
    ).toEqual({
      type: 'tool-output-available',
      toolCallId: 'call-1',
      output: { value: 'output' },
      providerExecuted: true,
      providerMetadata,
      toolMetadata,
      dynamic: true,
      preliminary: true,
    });

    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-result',
          toolCallId: 'call-undefined',
          toolName: 'dynamicTool',
          input: { value: 'input' },
          output: undefined,
        },
        { tools },
      ),
    ).toEqual({
      type: 'tool-output-available',
      toolCallId: 'call-undefined',
      // This must be `null` so that we don't lose the property when this is
      // serialized to JSON. See the following issue for more details:
      // https://github.com/vercel/ai/issues/15854
      output: null,
      dynamic: true,
    });

    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-error',
          toolCallId: 'call-2',
          toolName: 'dynamicTool',
          input: { value: 'input' },
          error: { code: 'provider-error' },
          providerExecuted: true,
          providerMetadata,
          toolMetadata,
          dynamic: true,
        },
        {
          onError: () => 'should not be used for provider-executed errors',
          tools,
        },
      ),
    ).toEqual({
      type: 'tool-output-error',
      toolCallId: 'call-2',
      errorText: '{"code":"provider-error"}',
      providerExecuted: true,
      providerMetadata,
      toolMetadata,
      dynamic: true,
    });

    expect(
      toUIMessageChunk<Tools>({
        type: 'tool-error',
        toolCallId: 'call-string-error',
        toolName: 'dynamicTool',
        input: { value: 'input' },
        error: 'provider string error',
        providerExecuted: true,
        dynamic: true,
      }),
    ).toEqual({
      type: 'tool-output-error',
      toolCallId: 'call-string-error',
      errorText: 'provider string error',
      providerExecuted: true,
      dynamic: true,
    });

    expect(
      toUIMessageChunk<Tools>(
        {
          type: 'tool-error',
          toolCallId: 'call-3',
          toolName: 'staticTool',
          input: { value: 'input' },
          error: new Error('tool failed'),
        },
        { onError: error => `handled: ${(error as Error).message}`, tools },
      ),
    ).toEqual({
      type: 'tool-output-error',
      toolCallId: 'call-3',
      errorText: 'handled: tool failed',
    });

    expect(
      toUIMessageChunk<Tools>({
        type: 'tool-output-denied',
        toolCallId: 'call-4',
        toolName: 'staticTool',
      }),
    ).toEqual({
      type: 'tool-output-denied',
      toolCallId: 'call-4',
    });

    expect(
      toUIMessageChunk<Tools>({
        type: 'tool-approval-request',
        approvalId: 'approval-1',
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-5',
          toolName: 'staticTool',
          input: { value: 'input' },
        },
        isAutomatic: true,
      }),
    ).toEqual({
      type: 'tool-approval-request',
      approvalId: 'approval-1',
      toolCallId: 'call-5',
      isAutomatic: true,
    });

    expect(
      toUIMessageChunk<Tools>({
        type: 'tool-approval-response',
        approvalId: 'approval-1',
        toolCall: {
          type: 'tool-call',
          toolCallId: 'call-5',
          toolName: 'staticTool',
          input: { value: 'input' },
        },
        approved: false,
        reason: 'not allowed',
        providerExecuted: true,
      }),
    ).toEqual({
      type: 'tool-approval-response',
      approvalId: 'approval-1',
      approved: false,
      reason: 'not allowed',
      providerExecuted: true,
    });
  });

  it('maps error parts through onError', () => {
    const onError = vi.fn(() => 'handled error');
    const error = new Error('boom');

    expect(toUIMessageChunk({ type: 'error', error }, { onError })).toEqual({
      type: 'error',
      errorText: 'handled error',
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('returns undefined for parts that do not produce UI message chunks', () => {
    expect(
      toUIMessageChunk({
        type: 'tool-input-end',
        id: 'call-1',
      }),
    ).toBeUndefined();

    expect(
      toUIMessageChunk({
        type: 'raw',
        rawValue: { provider: 'raw' },
      }),
    ).toBeUndefined();
  });

  it('throws for unknown part types', () => {
    expect(() =>
      toUIMessageChunk({ type: 'unknown' } as unknown as TextStreamPart<{}>),
    ).toThrow('Unknown chunk type: unknown');
  });
});
