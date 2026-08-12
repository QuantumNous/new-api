import { tool, type ToolSet } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { Callback } from '../util/callback';
import type {
  GenerateTextEndEvent,
  GenerateTextStepEndEvent,
  GenerateTextStepStartEvent,
  GenerateTextStartEvent,
} from './generate-text-events';
import type { Output } from './output';
import { createRestrictedTelemetryDispatcher } from './restricted-telemetry-dispatcher';
import type {
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';

describe('createRestrictedTelemetryDispatcher types', () => {
  type RuntimeContext = {
    userId: string;
    requestId: string;
  };

  const tools = {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      contextSchema: z.object({ weatherApiKey: z.string() }),
    }),
    calculator: tool({
      inputSchema: z.object({ expression: z.string() }),
    }),
  };

  type Tools = typeof tools;

  const telemetryDispatcher = createRestrictedTelemetryDispatcher<
    ToolSet,
    RuntimeContext,
    Output
  >({
    includeRuntimeContext: { userId: true },
  });

  it('exposes text telemetry callbacks with the original runtimeContext type', () => {
    expectTypeOf(telemetryDispatcher.onStart).toMatchTypeOf<
      | Callback<GenerateTextStartEvent<ToolSet, RuntimeContext, Output>>
      | undefined
    >();
    expectTypeOf(telemetryDispatcher.onStepStart).toMatchTypeOf<
      | Callback<GenerateTextStepStartEvent<ToolSet, RuntimeContext, Output>>
      | undefined
    >();
    expectTypeOf(telemetryDispatcher.onStepEnd).toMatchTypeOf<
      Callback<GenerateTextStepEndEvent<ToolSet, RuntimeContext>> | undefined
    >();
    expectTypeOf(telemetryDispatcher.onStepFinish).toMatchTypeOf<
      Callback<GenerateTextStepEndEvent<ToolSet, RuntimeContext>> | undefined
    >();
    expectTypeOf(telemetryDispatcher.onEnd).toMatchTypeOf<
      Callback<GenerateTextEndEvent<ToolSet, RuntimeContext>> | undefined
    >();
  });

  it('exposes tool execution callbacks with the original tool set type', () => {
    const telemetryDispatcher = createRestrictedTelemetryDispatcher<
      Tools,
      RuntimeContext,
      Output
    >({
      includeRuntimeContext: { userId: true },
    });

    expectTypeOf(telemetryDispatcher.onToolExecutionStart).toMatchTypeOf<
      Callback<ToolExecutionStartEvent<Tools>> | undefined
    >();
    expectTypeOf(telemetryDispatcher.onToolExecutionEnd).toMatchTypeOf<
      Callback<ToolExecutionEndEvent<Tools>> | undefined
    >();
  });
});
