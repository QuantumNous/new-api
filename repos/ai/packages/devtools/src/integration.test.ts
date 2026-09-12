import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Telemetry } from 'ai';
import { DevToolsTelemetry } from './integration.js';

const mockCreateRun = vi.fn();
const mockCreateStep = vi.fn();
const mockGetStepsForRun = vi.fn();
const mockUpdateStepResult = vi.fn();
const mockNotifyServerAsync = vi.fn();

vi.mock('./db.js', () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...args),
  createStep: (...args: unknown[]) => mockCreateStep(...args),
  getStepsForRun: (...args: unknown[]) => mockGetStepsForRun(...args),
  updateStepResult: (...args: unknown[]) => mockUpdateStepResult(...args),
  notifyServerAsync: (...args: unknown[]) => mockNotifyServerAsync(...args),
}));

type Listener<T> = (event: T) => PromiseLike<void> | void;

type TestIntegration = {
  [K in keyof Telemetry]: K extends 'executeTool'
    ? Telemetry[K]
    : Listener<Record<string, unknown>>;
};

function makeStartEvent(overrides: Record<string, unknown> = {}) {
  return {
    callId: 'call-1',
    operationId: 'ai.generateText',
    provider: 'test-provider',
    modelId: 'test-model',
    functionId: undefined,
    maxOutputTokens: undefined,
    temperature: undefined,
    topP: undefined,
    topK: undefined,
    presencePenalty: undefined,
    frequencyPenalty: undefined,
    seed: undefined,
    ...overrides,
  };
}

function makeStepStartEvent(overrides: Record<string, unknown> = {}) {
  return {
    callId: 'call-1',
    steps: [],
    provider: 'test-provider',
    modelId: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
    tools: undefined,
    toolChoice: undefined,
    providerOptions: undefined,
    ...overrides,
  };
}

function makeStepFinishEvent(overrides: Record<string, unknown> = {}) {
  return {
    callId: 'call-1',
    stepNumber: 0,
    content: [{ type: 'text', text: 'Hello!' }],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 5 },
    request: {},
    response: {
      id: 'resp-1',
      modelId: 'test-model',
      timestamp: new Date('2025-01-01'),
      messages: [],
    },
    ...overrides,
  };
}

describe('DevToolsTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date('2025-01-01T00:00:00Z') });
    vi.stubGlobal(
      'crypto',
      Object.assign({}, crypto, {
        randomUUID: () => '00000000-0000-0000-0000-000000000000',
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createIntegration(): TestIntegration {
    return DevToolsTelemetry() as unknown as TestIntegration;
  }

  it('throws in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => DevToolsTelemetry()).toThrow(
        'should not be used in production',
      );
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('ignores embed/rerank operations', async () => {
    const integration = createIntegration();

    for (const operationId of ['ai.embed', 'ai.embedMany', 'ai.rerank']) {
      await integration.onStart!({ operationId, callId: 'x' } as any);
    }

    expect(mockCreateRun).not.toHaveBeenCalled();
  });

  describe('generateText lifecycle', () => {
    it('creates run and step, then updates result on finish', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      expect(mockCreateRun).toHaveBeenCalledOnce();

      await integration.onStepStart!(makeStepStartEvent());
      expect(mockCreateStep).toHaveBeenCalledOnce();

      const stepArg = mockCreateStep.mock.calls[0][0];
      expect(stepArg).toMatchInlineSnapshot(`
        {
          "id": "00000000-0000-0000-0000-000000000000",
          "input": "{"prompt":[{"role":"user","content":"hello"}]}",
          "model_id": "test-model",
          "provider": "test-provider",
          "provider_options": null,
          "run_id": "20250101000000000-00000000",
          "started_at": "2025-01-01T00:00:00.000Z",
          "step_number": 1,
          "type": "generate",
        }
      `);

      await integration.onStepEnd!(makeStepFinishEvent());
      expect(mockUpdateStepResult).toHaveBeenCalledOnce();

      const [stepId, result] = mockUpdateStepResult.mock.calls[0];
      expect(stepId).toBe('00000000-0000-0000-0000-000000000000');
      expect(JSON.parse(result.output)).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "Hello!",
              "type": "text",
            },
          ],
          "finishReason": "stop",
          "response": {
            "id": "resp-1",
            "messages": [],
            "modelId": "test-model",
            "timestamp": "2025-01-01T00:00:00.000Z",
          },
        }
      `);
      expect(result.error).toBeNull();
      expect(result.raw_response).toBeNull();
      expect(result.raw_chunks).toBeNull();
    });

    it('stores request.body and response.body as raw data', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());
      await integration.onStepEnd!(
        makeStepFinishEvent({
          request: { body: { model: 'test', prompt: 'hi' } },
          response: {
            id: 'resp-1',
            modelId: 'test-model',
            timestamp: new Date('2025-01-01'),
            messages: [],
            body: { choices: [{ text: 'Hello!' }] },
          },
        }),
      );

      const result = mockUpdateStepResult.mock.calls[0][1];
      expect(JSON.parse(result.raw_request)).toMatchInlineSnapshot(`
        {
          "model": "test",
          "prompt": "hi",
        }
      `);
      expect(JSON.parse(result.raw_response)).toMatchInlineSnapshot(`
        {
          "choices": [
            {
              "text": "Hello!",
            },
          ],
        }
      `);
    });
  });

  describe('streamText lifecycle', () => {
    it('prefers response.body over collected chunks', async () => {
      const integration = createIntegration();

      await integration.onStart!(
        makeStartEvent({ operationId: 'ai.streamText' }),
      );
      await integration.onStepStart!(makeStepStartEvent());

      await integration.onStepEnd!(
        makeStepFinishEvent({
          response: {
            id: 'resp-1',
            modelId: 'test-model',
            timestamp: new Date('2025-01-01'),
            messages: [],
            body: { fromProvider: true },
          },
        }),
      );

      const result = mockUpdateStepResult.mock.calls[0][1];
      expect(JSON.parse(result.raw_response)).toMatchInlineSnapshot(`
        {
          "fromProvider": true,
        }
      `);
    });

    it('groups resumed calls under a shared run id', async () => {
      mockGetStepsForRun.mockResolvedValueOnce([]).mockResolvedValueOnce([{}]);
      const integration = DevToolsTelemetry({
        runId: 'tool-approval-run',
      }) as unknown as TestIntegration;

      await integration.onStart!(
        makeStartEvent({ operationId: 'ai.streamText' }),
      );
      await integration.onStepStart!(makeStepStartEvent());
      await integration.onEnd!({ callId: 'call-1' });

      await integration.onStart!(
        makeStartEvent({
          callId: 'call-2',
          operationId: 'ai.streamText',
        }),
      );
      await integration.onStepStart!(makeStepStartEvent({ callId: 'call-2' }));

      expect(mockCreateRun.mock.calls.map(([runId]) => runId)).toEqual([
        'tool-approval-run',
        'tool-approval-run',
      ]);
      expect(
        mockCreateStep.mock.calls.map(([step]) => step.step_number),
      ).toEqual([1, 2]);
    });
  });

  describe('streamObject lifecycle', () => {
    it('creates stream-type step via onObjectStepStart/End', async () => {
      const integration = createIntegration();

      await integration.onStart!(
        makeStartEvent({ operationId: 'ai.streamObject' }),
      );
      await integration.onObjectStepStart!({
        callId: 'call-1',
        stepNumber: 0,
        provider: 'test-provider',
        modelId: 'test-model',
        promptMessages: [{ role: 'user', content: 'give me json' }],
        providerOptions: undefined,
      } as any);

      expect(mockCreateStep.mock.calls[0][0].type).toBe('stream');

      await integration.onObjectStepEnd!({
        callId: 'call-1',
        stepNumber: 0,
        finishReason: 'stop',
        objectText: '{"name":"test"}',
        usage: { inputTokens: 5, outputTokens: 10 },
        request: {},
        response: {
          id: 'resp-1',
          modelId: 'test-model',
          timestamp: new Date('2025-01-01'),
        },
      } as any);

      const output = JSON.parse(mockUpdateStepResult.mock.calls[0][1].output);
      expect(output).toMatchInlineSnapshot(`
        {
          "finishReason": "stop",
          "objectText": "{"name":"test"}",
          "response": {
            "id": "resp-1",
            "modelId": "test-model",
            "timestamp": "2025-01-01T00:00:00.000Z",
          },
        }
      `);
    });
  });

  describe('onError', () => {
    it('extracts error message from Error cause', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());

      await integration.onError!({
        callId: 'call-1',
        error: new Error('connection failed'),
      });

      const result = mockUpdateStepResult.mock.calls[0][1];
      expect(result.error).toBe('connection failed');
      expect(result.output).toBeNull();
    });

    it('handles string error cause', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());

      await integration.onError!({
        callId: 'call-1',
        error: 'something broke',
      });

      expect(mockUpdateStepResult.mock.calls[0][1].error).toBe(
        'something broke',
      );
    });

    it('ignores errors without callId', async () => {
      const integration = createIntegration();
      await integration.onError!({});
      expect(mockUpdateStepResult).not.toHaveBeenCalled();
    });
  });

  describe('onEnd', () => {
    it('cleans up call state so subsequent events are ignored', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());
      await integration.onStepEnd!(makeStepFinishEvent());
      await integration.onEnd!({ callId: 'call-1' } as any);

      mockCreateStep.mockClear();
      await integration.onStepStart!(makeStepStartEvent());
      expect(mockCreateStep).not.toHaveBeenCalled();
    });
  });

  describe('executeTool nesting', () => {
    it('links nested call run to parent step', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());

      await integration.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => {
          await integration.onStart!(
            makeStartEvent({
              callId: 'call-2',
              operationId: 'ai.generateText',
            }),
          );
          return 'result';
        },
      });

      expect(mockCreateRun).toHaveBeenCalledTimes(2);
      const nestedRunCall = mockCreateRun.mock.calls[1];
      expect(nestedRunCall[1]).toMatchInlineSnapshot(`
        {
          "runId": "${mockCreateRun.mock.calls[0][0]}",
          "stepId": "00000000-0000-0000-0000-000000000000",
        }
      `);
    });

    it('restores tool context after execution', async () => {
      const integration = createIntegration();

      await integration.onStart!(makeStartEvent());
      await integration.onStepStart!(makeStepStartEvent());

      await integration.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => 'result',
      });

      mockCreateRun.mockClear();
      await integration.onStart!(
        makeStartEvent({ callId: 'call-3', operationId: 'ai.generateText' }),
      );
      expect(mockCreateRun.mock.calls[0][1]).toBeUndefined();
    });
  });
});
