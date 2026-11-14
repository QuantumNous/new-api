/**
 * Integration test workflows for WorkflowAgent using mock providers.
 */
import { tool } from 'ai';
import { WorkflowAgent } from '../workflow-agent.js';
import { mockTextModel, mockSequenceModel } from '../providers/mock.js';
import { createTestSandbox } from './test-sandbox.js';
import { FatalError, getWritable } from 'workflow';
import { z } from 'zod/v4';

// ============================================================================
// Tool step functions
// ============================================================================

async function addNumbers(input: { a: number; b: number }): Promise<number> {
  'use step';
  return input.a + input.b;
}

async function echoStep(input: { step: number }): Promise<string> {
  'use step';
  return `step-${input.step}-done`;
}

async function throwingStep(): Promise<string> {
  'use step';
  throw new FatalError('Tool execution failed fatally');
}

// ============================================================================
// Core agent tests
// ============================================================================

export async function agentBasicE2e(prompt: string) {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockTextModel(`Echo: ${prompt}`),
    instructions: 'You are a helpful assistant.',
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: prompt }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

export async function agentToolCallE2e(a: number, b: number) {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'addNumbers',
        input: JSON.stringify({ a, b }),
      },
      { type: 'text', text: `The sum is ${a + b}` },
    ]),
    tools: {
      addNumbers: {
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: addNumbers,
      },
    },
    instructions: 'You are a calculator assistant.',
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: `Add ${a} and ${b}` }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    toolResults: result.toolResults,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

export async function agentMultiStepE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'echoStep',
        input: JSON.stringify({ step: 1 }),
      },
      {
        type: 'tool-call',
        toolName: 'echoStep',
        input: JSON.stringify({ step: 2 }),
      },
      {
        type: 'tool-call',
        toolName: 'echoStep',
        input: JSON.stringify({ step: 3 }),
      },
      { type: 'text', text: 'All done!' },
    ]),
    tools: {
      echoStep: {
        description: 'Echo the step number',
        inputSchema: z.object({ step: z.number() }),
        execute: echoStep,
      },
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'Run 3 steps' }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

export async function agentErrorToolE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      { type: 'tool-call', toolName: 'throwingTool', input: '{}' },
      { type: 'text', text: 'Tool failed but I recovered.' },
    ]),
    tools: {
      throwingTool: {
        description: 'A tool that always fails',
        inputSchema: z.object({}),
        execute: throwingStep,
      },
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'Call the throwing tool' }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

// ============================================================================
// repairToolCall serialization
// ============================================================================

async function repairToolCall({
  toolCall,
}: {
  toolCall: { toolCallId: string; toolName: string; input: string };
}) {
  'use step';
  // Fix the malformed JSON
  return { ...toolCall, input: '{"a": 3, "b": 7}' };
}

export async function agentRepairToolCallE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'addNumbers',
        // Malformed input: missing closing brace
        input: '{"a": 3, "b": 7',
      },
      { type: 'text', text: 'The sum is 10' },
    ]),
    tools: {
      addNumbers: {
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: addNumbers,
      },
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'add 3 and 7' }],
    writable: getWritable(),
    repairToolCall: repairToolCall as any,
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
    repaired: result.steps.length === 2, // If repair worked, we get 2 steps (tool call + text)
  };
}

// ============================================================================
// Callback tests — onStepFinish
// ============================================================================

export async function agentOnStepFinishE2e() {
  'use workflow';
  const callSources: string[] = [];
  let capturedStepResult: any = null;
  const agent = new WorkflowAgent({
    model: mockTextModel('hello'),
    onStepFinish: async () => {
      callSources.push('constructor');
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    onStepFinish: async stepResult => {
      callSources.push('method');
      capturedStepResult = {
        text: stepResult.text,
        finishReason: stepResult.finishReason,
        stepNumber: (stepResult as any).stepNumber,
      };
    },
  });
  return { callSources, capturedStepResult, stepCount: result.steps.length };
}

// ============================================================================
// Callback tests — onFinish
// ============================================================================

export async function agentOnFinishE2e() {
  'use workflow';
  const callSources: string[] = [];
  let capturedEvent: any = null;
  const agent = new WorkflowAgent({
    model: mockTextModel('hello from finish'),
    onFinish: async () => {
      callSources.push('constructor');
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    onFinish: async event => {
      callSources.push('method');
      capturedEvent = {
        text: (event as any).text,
        finishReason: (event as any).finishReason,
        stepsLength: event.steps.length,
        hasMessages: event.messages.length > 0,
        hasTotalUsage: (event as any).totalUsage != null,
      };
    },
  });
  return { callSources, capturedEvent, stepCount: result.steps.length };
}

// ============================================================================
// Instructions test
// ============================================================================

export async function agentInstructionsStringE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockTextModel('ok'),
    instructions: 'You are a pirate.',
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'ahoy' }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

// ============================================================================
// Timeout test
// ============================================================================

export async function agentTimeoutE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockTextModel('fast response'),
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    timeout: 30000,
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

// ============================================================================
// GAP tests — experimental_onStart
// ============================================================================

export async function agentOnStartE2e() {
  'use workflow';
  const callSources: string[] = [];
  const agent = new WorkflowAgent({
    model: mockTextModel('hello'),
    experimental_onStart: async () => {
      callSources.push('constructor');
    },
  } as any);
  await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    experimental_onStart: async () => {
      callSources.push('method');
    },
  } as any);
  return { callSources };
}

// ============================================================================
// GAP tests — experimental_onStepStart
// ============================================================================

export async function agentOnStepStartE2e() {
  'use workflow';
  const callSources: string[] = [];
  const agent = new WorkflowAgent({
    model: mockTextModel('hello'),
    experimental_onStepStart: async () => {
      callSources.push('constructor');
    },
  } as any);
  await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    experimental_onStepStart: async () => {
      callSources.push('method');
    },
  } as any);
  return { callSources };
}

// ============================================================================
// GAP tests — onToolExecutionStart
// ============================================================================

export async function agentonToolExecutionStartE2e() {
  'use workflow';
  const calls: string[] = [];
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'echoStep',
        input: JSON.stringify({ step: 1 }),
      },
      { type: 'text', text: 'done' },
    ]),
    tools: {
      echoStep: {
        description: 'Echo',
        inputSchema: z.object({ step: z.number() }),
        execute: echoStep,
      },
    },
    onToolExecutionStart: async () => {
      calls.push('constructor');
    },
  } as any);
  await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    onToolExecutionStart: async () => {
      calls.push('method');
    },
  } as any);
  return { calls };
}

// ============================================================================
// GAP tests — onToolExecutionEnd
// ============================================================================

export async function agentonToolExecutionEndE2e() {
  'use workflow';
  const calls: string[] = [];
  let capturedEvent: any = null;
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'addNumbers',
        input: JSON.stringify({ a: 1, b: 2 }),
      },
      { type: 'text', text: 'done' },
    ]),
    tools: {
      addNumbers: {
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: addNumbers,
      },
    },
    onToolExecutionEnd: async () => {
      calls.push('constructor');
    },
  } as any);
  await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
    onToolExecutionEnd: async (event: any) => {
      calls.push('method');
      capturedEvent = {
        toolName: event?.toolCall?.toolName,
        success: event?.success,
        output: event?.output,
      };
    },
  } as any);
  return { calls, capturedEvent };
}

// ============================================================================
// GAP tests — prepareCall
// ============================================================================

export async function agentPrepareCallE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockTextModel('ok'),
    prepareCall: ({ options, ...rest }: any) => ({
      ...rest,
      providerOptions: { test: { value: options?.value } },
    }),
  } as any);
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'test' }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

// ============================================================================
// GAP tests — tool approval (needsApproval)
// ============================================================================

export async function agentToolApprovalE2e() {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'riskyTool',
        input: JSON.stringify({ action: 'delete' }),
      },
      { type: 'text', text: 'done' },
    ]),
    tools: {
      riskyTool: {
        description: 'A dangerous tool that needs approval',
        inputSchema: z.object({ action: z.string() }),
        execute: echoStep as any,
        needsApproval: true,
      } as any,
    },
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: 'do something risky' }],
    writable: getWritable(),
  });
  return {
    toolCallsCount: result.toolCalls.length,
    toolResultsCount: result.toolResults.length,
    stepCount: result.steps.length,
    firstToolCallName: result.toolCalls[0]?.toolName,
  };
}

// ============================================================================
// Tool with input schema (tests serialization across step boundary)
// ============================================================================

export async function agentToolInputSchemaE2e(a: number, b: number) {
  'use workflow';
  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'addNumbers',
        input: JSON.stringify({ a, b }),
      },
      { type: 'text', text: `The sum is ${a + b}` },
    ]),
    tools: {
      addNumbers: tool({
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async (input: { a: number; b: number }) => input.a + input.b,
      }),
    },
    instructions: 'You are a calculator.',
  });
  const result = await agent.stream({
    messages: [{ role: 'user', content: `Add ${a} and ${b}` }],
    writable: getWritable(),
  });
  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
  };
}

// ============================================================================
// runtimeContext + toolsContext (end-to-end)
// ============================================================================

/**
 * Demonstrates the full context flow:
 *
 * - `runtimeContext` holds shared agent state (`tenantId`, `requestId`).
 *   `prepareStep` reads it and tags it with the current step number;
 *   `onFinish` receives the final value.
 * - `toolsContext` holds per-tool, schema-validated context. The
 *   `lookupCustomer` tool declares `contextSchema`, so its entry is
 *   validated and the tool's `execute` only sees its own context.
 */
export async function agentRuntimeAndToolsContextE2e() {
  'use workflow';

  let onFinishRuntimeContext: Record<string, unknown> | undefined;
  let onFinishToolsContext: Record<string, unknown> | undefined;
  let toolReceivedContext: unknown;

  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'lookupCustomer',
        input: JSON.stringify({ customerId: 'cust_123' }),
      },
      { type: 'text', text: 'Customer cust_123 is eligible.' },
    ]),
    tools: {
      lookupCustomer: tool({
        description: 'Look up customer account details.',
        inputSchema: z.object({ customerId: z.string() }),
        contextSchema: z.object({
          apiKey: z.string(),
          region: z.enum(['us', 'eu']),
        }),
        execute: async (input, { context }) => {
          toolReceivedContext = context;
          return { customerId: input.customerId, eligible: true };
        },
      }),
    },
    instructions: 'You look up customers.',
    runtimeContext: {
      tenantId: 'tenant_123',
      requestId: 'req_abc',
    },
    toolsContext: {
      lookupCustomer: {
        apiKey: 'sk-test-key',
        region: 'us',
      },
    },
    prepareStep: ({ stepNumber, runtimeContext }) => ({
      runtimeContext: { ...runtimeContext, lastStep: stepNumber },
    }),
    onFinish: ({ runtimeContext, toolsContext }) => {
      onFinishRuntimeContext = runtimeContext;
      onFinishToolsContext = toolsContext;
    },
  });

  const result = await agent.stream({
    messages: [
      { role: 'user', content: 'Is customer cust_123 eligible for support?' },
    ],
    writable: getWritable(),
  });

  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
    toolReceivedContext,
    onFinishRuntimeContext,
    onFinishToolsContext,
  };
}

export async function agentSandboxE2e() {
  'use workflow';

  let constructorSandboxRanCommand = 'not-run';
  let stepSandboxRanCommand = 'not-run';
  let firstPrepareStepSawConstructorSandbox = false;
  let secondPrepareStepSawConstructorSandbox = false;
  let prepareStepSawStepSandbox = false;

  // A live sandbox session passed through `experimental_sandbox`. The tool
  // `execute` is inline (not a `'use step'`) so the handle never crosses a
  // step boundary — matching the single-process use of `experimental_sandbox`.
  const constructorSandbox = createTestSandbox({
    run: async ({ command }) => {
      constructorSandboxRanCommand = command;
      return {
        exitCode: 0,
        stdout: `constructor ran: ${command}`,
        stderr: '',
      };
    },
  });
  const stepSandbox = createTestSandbox({
    run: async ({ command }) => {
      stepSandboxRanCommand = command;
      return { exitCode: 0, stdout: `ran: ${command}`, stderr: '' };
    },
  });

  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'runShell',
        input: JSON.stringify({ command: 'echo hello' }),
      },
      { type: 'text', text: 'Command executed.' },
    ]),
    tools: {
      runShell: tool({
        description: 'Run a shell command in the sandbox.',
        inputSchema: z.object({ command: z.string() }),
        execute: async ({ command }, { experimental_sandbox }) => {
          if (experimental_sandbox == null) {
            throw new Error('Sandbox is not available');
          }
          return experimental_sandbox.run({ command });
        },
      }),
    },
    instructions: 'You run shell commands in a sandbox.',
    experimental_sandbox: constructorSandbox,
    prepareStep: ({ stepNumber, experimental_sandbox }) => {
      if (stepNumber === 0) {
        firstPrepareStepSawConstructorSandbox =
          experimental_sandbox === constructorSandbox;
        return { experimental_sandbox: stepSandbox };
      }

      if (experimental_sandbox === stepSandbox) {
        prepareStepSawStepSandbox = true;
      }
      secondPrepareStepSawConstructorSandbox =
        experimental_sandbox === constructorSandbox;
      return {};
    },
  });

  const result = await agent.stream({
    messages: [{ role: 'user', content: 'Run echo hello' }],
    writable: getWritable(),
  });

  return {
    stepCount: result.steps.length,
    lastStepText: result.steps[result.steps.length - 1]?.text,
    toolResults: result.toolResults,
    constructorSandboxRanCommand,
    stepSandboxRanCommand,
    firstPrepareStepSawConstructorSandbox,
    secondPrepareStepSawConstructorSandbox,
    prepareStepSawStepSandbox,
  };
}
