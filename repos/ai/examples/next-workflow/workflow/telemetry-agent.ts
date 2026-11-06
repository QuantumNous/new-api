import {
  createModelCallToUIChunkTransform,
  WorkflowAgent,
  type ModelCallStreamPart,
  type TelemetryOptions,
  type WorkflowAgentOnErrorCallback,
  type WorkflowAgentOnEndCallback,
  type WorkflowAgentOnStartCallback,
  type WorkflowAgentOnStepStartCallback,
  type WorkflowAgentOnToolExecutionEndCallback,
  type WorkflowAgentOnToolExecutionStartCallback,
} from '@ai-sdk/workflow';
import {
  convertToModelMessages,
  tool,
  type Telemetry,
  type UIMessage,
} from 'ai';
import { getWritable } from 'workflow';
import { z } from 'zod';
import { devToolsTelemetry } from '../lib/devtools-bridge';
import {
  recordTelemetryEvent,
  type TelemetryEventSource,
  type TelemetryScenario,
} from '../lib/telemetry-store';
import { mockSequenceModel, type MockResponseDescriptor } from './mock-model';

interface TelemetryRequestContext {
  telemetryRunId: string;
  requestId: string;
  tenantId: string;
  scenario: TelemetryScenario;
}

interface RuntimeContext {
  [key: string]: unknown;
  telemetryRunId: string;
  requestId: string;
  tenantId: string;
  secretToken: string;
}

function summarizeEvent(event: unknown) {
  const value = event as Record<string, unknown> | undefined;
  return {
    operationId: value?.operationId,
    functionId: value?.functionId,
    callId: value?.callId,
    stepNumber: value?.stepNumber,
    toolName: value?.toolName,
    toolCallId: value?.toolCallId,
    success: value?.success,
    finishReason: value?.finishReason,
    runtimeContext: value?.runtimeContext,
    toolsContext: value?.toolsContext,
  };
}

function summarizeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };
}

function createTelemetryIntegration(telemetryRunId: string) {
  const record =
    (name: string) =>
    async (event: unknown): Promise<void> => {
      await recordTelemetryEvent({
        telemetryRunId,
        source: 'telemetry',
        name,
        summary: summarizeEvent(event),
      });
    };

  return {
    onStart: record('onStart'),
    onStepStart: record('onStepStart'),
    onLanguageModelCallStart: record('onLanguageModelCallStart'),
    onLanguageModelCallEnd: record('onLanguageModelCallEnd'),
    onToolExecutionStart: record('onToolExecutionStart'),
    onToolExecutionEnd: record('onToolExecutionEnd'),
    onStepFinish: record('onStepFinish'),
    onEnd: record('onEnd'),
    onError: async error => {
      await recordTelemetryEvent({
        telemetryRunId,
        source: 'telemetry',
        name: 'onError',
        summary: summarizeError(error),
      });
    },
    executeTool: async ({ callId, toolCallId, execute }) => {
      await recordTelemetryEvent({
        telemetryRunId,
        source: 'telemetry',
        name: 'executeTool',
        summary: { callId, toolCallId },
      });
      return execute();
    },
  } satisfies Telemetry;
}

async function getWeather(
  input: { city: string },
  options: {
    context: {
      unit: 'celsius' | 'fahrenheit';
      requestId: string;
      secret: string;
    };
  },
) {
  'use step';
  return {
    city: input.city,
    temperature: options.context.unit === 'celsius' ? 21 : 70,
    unit: options.context.unit,
    requestId: options.context.requestId,
    secretWasAvailableToTool: options.context.secret.length > 0,
  };
}

async function calculate(input: { expression: string }) {
  'use step';
  return {
    expression: input.expression,
    result: 42,
  };
}

async function deleteFile(
  input: { path: string },
  options: { context: { rootDir: string; requestId: string; secret: string } },
) {
  'use step';
  if (!input.path.startsWith(options.context.rootDir)) {
    throw new Error(`Refusing to delete outside ${options.context.rootDir}`);
  }
  return { deleted: input.path, requestId: options.context.requestId };
}

async function failTool() {
  'use step';
  throw new Error('Intentional telemetry e2e tool failure');
}

const tools = {
  getWeather: tool({
    description: 'Get deterministic weather for a city.',
    inputSchema: z.object({ city: z.string() }),
    contextSchema: z.object({
      unit: z.enum(['celsius', 'fahrenheit']),
      requestId: z.string(),
      secret: z.string(),
    }),
    execute: getWeather,
  }),
  calculate: tool({
    description: 'Evaluate a deterministic expression.',
    inputSchema: z.object({ expression: z.string() }),
    execute: calculate,
  }),
  deleteFile: {
    description: 'Delete a sandboxed file after approval.',
    inputSchema: z.object({ path: z.string() }),
    contextSchema: z.object({
      rootDir: z.string(),
      requestId: z.string(),
      secret: z.string(),
    }),
    execute: deleteFile,
    needsApproval: true as const,
  },
  failTool: tool({
    description: 'Throw an error to exercise telemetry error paths.',
    inputSchema: z.object({}),
    execute: failTool,
  }),
};

function getResponses(scenario: TelemetryScenario): MockResponseDescriptor[] {
  switch (scenario) {
    case 'approval':
      return [
        {
          type: 'tool-call',
          toolName: 'deleteFile',
          input: JSON.stringify({ path: '/tmp/workflow-telemetry/report.txt' }),
        },
        { type: 'text', text: 'The approved file operation completed.' },
      ];
    case 'tool-error':
      return [
        { type: 'tool-call', toolName: 'failTool', input: '{}' },
        { type: 'text', text: 'The failing tool path was observed.' },
      ];
    case 'model-error':
      return [
        { type: 'error', message: 'Intentional telemetry e2e model error' },
      ];
    default:
      return [
        {
          type: 'tool-call',
          toolName: 'getWeather',
          input: JSON.stringify({ city: 'San Francisco' }),
        },
        {
          type: 'tool-call',
          toolName: 'calculate',
          input: JSON.stringify({ expression: '40 + 2' }),
        },
        { type: 'text', text: 'Weather and calculator tools completed.' },
      ];
  }
}

function createTelemetryOptions({
  functionId,
  telemetryRunId,
}: {
  functionId: string;
  telemetryRunId: string;
}): TelemetryOptions<RuntimeContext, typeof tools> {
  return {
    functionId,
    includeRuntimeContext: {
      telemetryRunId: true,
      requestId: true,
      tenantId: true,
    },
    includeToolsContext: {
      getWeather: {
        requestId: true,
        unit: true,
      },
      deleteFile: {
        requestId: true,
      },
    },
    integrations: [
      createTelemetryIntegration(telemetryRunId),
      devToolsTelemetry,
    ],
  };
}

const recordCallback =
  ({
    telemetryRunId,
    source,
    name,
  }: {
    telemetryRunId: string;
    source: TelemetryEventSource;
    name: string;
  }) =>
  async (event: unknown) => {
    await recordTelemetryEvent({
      telemetryRunId,
      source,
      name,
      summary: summarizeEvent(event),
    });
  };

export async function telemetryChat(
  messages: UIMessage[],
  request: TelemetryRequestContext,
) {
  'use workflow';

  await recordTelemetryEvent({
    telemetryRunId: request.telemetryRunId,
    source: 'workflow',
    name: 'workflowStart',
    summary: { scenario: request.scenario },
  });

  const agent = new WorkflowAgent({
    model: mockSequenceModel(getResponses(request.scenario)),
    instructions:
      'You are a deterministic telemetry e2e agent. Use the scripted tools.',
    tools,
    runtimeContext: {
      telemetryRunId: request.telemetryRunId,
      requestId: request.requestId,
      tenantId: request.tenantId,
      secretToken: 'runtime-secret-not-for-telemetry',
    },
    toolsContext: {
      getWeather: {
        unit: 'celsius',
        requestId: request.requestId,
        secret: 'weather-secret-not-for-telemetry',
      },
      deleteFile: {
        rootDir: '/tmp/workflow-telemetry',
        requestId: request.requestId,
        secret: 'delete-secret-not-for-telemetry',
      },
    },
    telemetry: createTelemetryOptions({
      functionId: 'workflow-agent-telemetry-constructor',
      telemetryRunId: request.telemetryRunId,
    }),
    experimental_onStart: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'experimental_onStart',
    }) satisfies WorkflowAgentOnStartCallback<typeof tools, RuntimeContext>,
    experimental_onStepStart: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'experimental_onStepStart',
    }) satisfies WorkflowAgentOnStepStartCallback<typeof tools, RuntimeContext>,
    onToolExecutionStart: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'onToolExecutionStart',
    }) satisfies WorkflowAgentOnToolExecutionStartCallback<typeof tools>,
    onToolExecutionEnd: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'onToolExecutionEnd',
    }) satisfies WorkflowAgentOnToolExecutionEndCallback<typeof tools>,
    onEnd: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'onEnd',
    }) satisfies WorkflowAgentOnEndCallback<typeof tools, RuntimeContext>,
  });

  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    writable: getWritable<ModelCallStreamPart>(),
    telemetry: createTelemetryOptions({
      functionId: `workflow-agent-telemetry-${request.scenario}`,
      telemetryRunId: request.telemetryRunId,
    }),
    onError: recordCallback({
      telemetryRunId: request.telemetryRunId,
      source: 'agent-callback',
      name: 'onError',
    }) satisfies WorkflowAgentOnErrorCallback,
  });

  await recordTelemetryEvent({
    telemetryRunId: request.telemetryRunId,
    source: 'workflow',
    name: 'workflowFinish',
    summary: {
      scenario: request.scenario,
      steps: result.steps.length,
      text: result.steps.at(-1)?.text,
    },
  });

  return { messages: result.messages };
}

export function toUIMessageStream(
  readable: ReadableStream<ModelCallStreamPart>,
) {
  return readable.pipeThrough(createModelCallToUIChunkTransform());
}
