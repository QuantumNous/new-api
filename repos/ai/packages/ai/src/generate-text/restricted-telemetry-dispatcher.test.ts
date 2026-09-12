import { describe, expect, it, vi } from 'vitest';
import { createNullLanguageModelUsage } from '../types/usage';
import { createRestrictedTelemetryDispatcher } from './restricted-telemetry-dispatcher';
import { DefaultStepResult } from './step-result';

const runtimeContext = {
  userId: 'user-123',
  requestId: 'request-123',
};

const includeRuntimeContext = {
  requestId: true,
};

const toolsContext = {
  weather: {
    apiKey: 'secret-api-key',
    city: 'Berlin',
  },
  stocks: {
    symbol: 'AI',
  },
};

const includeToolsContext = {
  weather: {
    city: true,
  },
  stocks: {
    symbol: true,
  },
};

const filteredToolsContext = {
  weather: { city: 'Berlin' },
  stocks: { symbol: 'AI' },
};

const tools = {
  weather: {},
  stocks: {},
} as any;

function createStepResult({
  context = runtimeContext,
  toolContexts = {},
}: {
  context?: typeof runtimeContext;
  toolContexts?: Record<string, unknown>;
} = {}) {
  return new DefaultStepResult({
    callId: 'call-1',
    stepNumber: 0,
    provider: 'test-provider',
    modelId: 'test-model',
    runtimeContext: context,
    toolsContext: toolContexts,
    content: [{ type: 'text', text: 'Hello' }],
    finishReason: 'stop',
    rawFinishReason: 'stop',
    usage: createNullLanguageModelUsage(),
    performance: {
      effectiveOutputTokensPerSecond: 0,
      outputTokensPerSecond: undefined,
      inputTokensPerSecond: undefined,
      effectiveTotalTokensPerSecond: 0,
      stepTimeMs: 0,
      responseTimeMs: 0,
      toolExecutionMs: {},
      timeToFirstOutputMs: undefined,
    },
    warnings: [],
    request: { messages: [] },
    response: {
      id: 'response-1',
      timestamp: new Date(0),
      modelId: 'test-model',
      messages: [],
    },
    providerMetadata: undefined,
  });
}

describe('createRestrictedTelemetryDispatcher', () => {
  it('excludes runtimeContext when no include context is configured', async () => {
    const onStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStart } },
      includeRuntimeContext: undefined,
    });

    await telemetryDispatcher.onStart?.({ runtimeContext } as any);

    const telemetryEvent = onStart.mock.calls[0][0];

    expect(telemetryEvent.runtimeContext).not.toBe(runtimeContext);
    expect(telemetryEvent.runtimeContext).toEqual({});
  });

  it('only includes runtimeContext properties marked as true', async () => {
    const onStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStart } },
      includeRuntimeContext: {
        userId: false,
        requestId: true,
      },
    });

    await telemetryDispatcher.onStart?.({ runtimeContext } as any);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: { requestId: 'request-123' },
      }),
    );
  });

  it('includes configured runtimeContext for start events without mutating the source event', async () => {
    const onStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStart } },
      includeRuntimeContext,
    });

    const event = {
      runtimeContext,
    } as any;

    await telemetryDispatcher.onStart?.(event);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: { requestId: 'request-123' },
      }),
    );
    expect(event.runtimeContext).toEqual(runtimeContext);
  });

  it('filters toolsContext per tool for start events without mutating the source event', async () => {
    const onStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStart } },
      includeRuntimeContext: undefined,
      includeToolsContext,
    });

    const event = {
      runtimeContext,
      toolsContext,
    } as any;

    await telemetryDispatcher.onStart?.(event);

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsContext: filteredToolsContext,
      }),
    );
    expect(event.toolsContext).toEqual(toolsContext);
  });

  it('excludes toolsContext properties when no include context is configured', async () => {
    const onStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStart } },
      includeRuntimeContext: undefined,
    });

    await telemetryDispatcher.onStart?.({
      runtimeContext,
      toolsContext,
    } as any);

    const telemetryEvent = onStart.mock.calls[0][0];

    expect(telemetryEvent.toolsContext).toEqual({});
  });

  it('includes configured runtimeContext for step start events and previous steps', async () => {
    const onStepStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStepStart } },
      includeRuntimeContext,
    });
    const previousStep = createStepResult();

    await telemetryDispatcher.onStepStart?.({
      runtimeContext,
      steps: [previousStep],
    } as any);

    const telemetryEvent = onStepStart.mock.calls[0][0];

    expect(telemetryEvent.runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.steps[0].runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.steps[0].text).toBe('Hello');
    expect(previousStep.runtimeContext).toEqual(runtimeContext);
  });

  it('filters toolsContext for step start events and previous steps', async () => {
    const onStepStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStepStart } },
      includeRuntimeContext: undefined,
      includeToolsContext,
    });
    const previousStep = createStepResult({ toolContexts: toolsContext });

    await telemetryDispatcher.onStepStart?.({
      runtimeContext,
      toolsContext,
      steps: [previousStep],
    } as any);

    const telemetryEvent = onStepStart.mock.calls[0][0];

    expect(telemetryEvent.toolsContext).toEqual(filteredToolsContext);
    expect(telemetryEvent.steps[0].toolsContext).toEqual(filteredToolsContext);
    expect(previousStep.toolsContext).toEqual(toolsContext);
  });

  it('includes configured runtimeContext for step end events without mutating the source step', async () => {
    const onStepEnd = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStepEnd } },
      includeRuntimeContext,
    });
    const step = createStepResult();

    await telemetryDispatcher.onStepEnd?.(step as any);

    const telemetryEvent = onStepEnd.mock.calls[0][0];

    expect(telemetryEvent.runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.text).toBe('Hello');
    expect(step.runtimeContext).toEqual(runtimeContext);
  });

  it('filters toolsContext for step end events without mutating the source step', async () => {
    const onStepEnd = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onStepEnd } },
      includeRuntimeContext: undefined,
      includeToolsContext,
    });
    const step = createStepResult({ toolContexts: toolsContext });

    await telemetryDispatcher.onStepEnd?.(step as any);

    const telemetryEvent = onStepEnd.mock.calls[0][0];

    expect(telemetryEvent.toolsContext).toEqual(filteredToolsContext);
    expect(telemetryEvent.text).toBe('Hello');
    expect(step.toolsContext).toEqual(toolsContext);
  });

  it('includes configured runtimeContext for end events and all steps without mutating source steps', async () => {
    const onEnd = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onEnd } },
      includeRuntimeContext,
    });
    const step = createStepResult();

    await telemetryDispatcher.onEnd?.({
      ...createStepResult(),
      text: 'Hello',
      runtimeContext,
      steps: [step],
      finalStep: step,
      usage: createNullLanguageModelUsage(),
    } as any);

    const telemetryEvent = onEnd.mock.calls[0][0];

    expect(telemetryEvent.runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.steps[0].runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.finalStep).toBe(telemetryEvent.steps[0]);
    expect(telemetryEvent.text).toBe('Hello');
    expect(step.runtimeContext).toEqual(runtimeContext);
  });

  it('filters toolsContext for end events and all steps without mutating source steps', async () => {
    const onEnd = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onEnd } },
      includeRuntimeContext: undefined,
      includeToolsContext,
    });
    const step = createStepResult({ toolContexts: toolsContext });

    await telemetryDispatcher.onEnd?.({
      ...createStepResult({ toolContexts: toolsContext }),
      text: 'Hello',
      runtimeContext,
      toolsContext,
      steps: [step],
      finalStep: step,
      usage: createNullLanguageModelUsage(),
    } as any);

    const telemetryEvent = onEnd.mock.calls[0][0];

    expect(telemetryEvent.toolsContext).toEqual(filteredToolsContext);
    expect(telemetryEvent.steps[0].toolsContext).toEqual(filteredToolsContext);
    expect(telemetryEvent.finalStep).toBe(telemetryEvent.steps[0]);
    expect(telemetryEvent.text).toBe('Hello');
    expect(step.toolsContext).toEqual(toolsContext);
  });

  it('includes configured runtimeContext for abort events and all steps without mutating source steps', async () => {
    const onAbort = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onAbort } },
      includeRuntimeContext,
    });
    const step = createStepResult();

    await telemetryDispatcher.onAbort?.({
      callId: 'call-1',
      steps: [step],
      reason: 'manual abort',
    });

    const telemetryEvent = onAbort.mock.calls[0][0];

    expect(telemetryEvent.reason).toBe('manual abort');
    expect(telemetryEvent.steps[0].runtimeContext).toEqual({
      requestId: 'request-123',
    });
    expect(telemetryEvent.steps[0].text).toBe('Hello');
    expect(step.runtimeContext).toEqual(runtimeContext);
  });

  it('filters tool execution start events without mutating the source event', async () => {
    const onToolExecutionStart = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onToolExecutionStart } },
      includeRuntimeContext,
      includeToolsContext,
    });
    const event = {
      callId: 'call-1',
      messages: [],
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tool-call-1',
        toolName: 'weather',
        input: { value: 'input' },
      },
      toolContext: toolsContext.weather,
    };

    await telemetryDispatcher.onToolExecutionStart?.(event as any);

    expect(onToolExecutionStart).toHaveBeenCalledWith(
      expect.objectContaining({
        ...event,
        toolContext: filteredToolsContext.weather,
      }),
    );
    expect(event.toolContext).toEqual(toolsContext.weather);
  });

  it('filters tool execution end events without mutating the source event', async () => {
    const onToolExecutionEnd = vi.fn();
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { onToolExecutionEnd } },
      includeRuntimeContext,
      includeToolsContext,
    });
    const event = {
      callId: 'call-1',
      toolExecutionMs: 10,
      messages: [],
      toolCall: {
        type: 'tool-call',
        toolCallId: 'tool-call-1',
        toolName: 'weather',
        input: { value: 'input' },
      },
      toolContext: toolsContext.weather,
      toolOutput: {
        type: 'tool-result',
        toolCallId: 'tool-call-1',
        toolName: 'weather',
        output: { value: 'output' },
      },
    };

    await telemetryDispatcher.onToolExecutionEnd?.(event as any);

    expect(onToolExecutionEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        ...event,
        toolContext: filteredToolsContext.weather,
      }),
    );
    expect(event.toolContext).toEqual(toolsContext.weather);
  });

  it('passes through executeTool without filtering', async () => {
    const executeTool = vi.fn(async ({ execute }) => execute());
    const telemetryDispatcher = createRestrictedTelemetryDispatcher({
      telemetry: { integrations: { executeTool } },
      includeRuntimeContext,
    });

    await expect(
      telemetryDispatcher.executeTool?.({
        callId: 'call-1',
        toolCallId: 'tool-call-1',
        execute: async () => 'result',
      }),
    ).resolves.toBe('result');

    expect(executeTool).toHaveBeenCalledOnce();
  });
});
