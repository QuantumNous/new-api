import {
  createModelCallToUIChunkTransform,
  WorkflowAgent,
  type ModelCallStreamPart,
} from '@ai-sdk/workflow';
import {
  convertToModelMessages,
  tool,
  type Experimental_SandboxSession as SandboxSession,
  type UIMessage,
} from 'ai';
import { getWritable } from 'workflow';
import { z } from 'zod';
import { mockSequenceModel } from './mock-model';

interface SandboxRequestContext {
  requestId: string;
  tenantId: string;
  scenario: 'sandbox';
}

function createSandbox({ label }: { label: string }): SandboxSession {
  const notImplemented = async () => {
    throw new Error('Only sandbox.run is implemented in this e2e sandbox.');
  };

  return {
    description: `Sandbox e2e session (${label})`,
    readFile: notImplemented,
    readBinaryFile: notImplemented,
    readTextFile: notImplemented,
    writeFile: notImplemented,
    writeBinaryFile: notImplemented,
    writeTextFile: notImplemented,
    spawn: notImplemented,
    run: async ({ command }) => {
      return {
        exitCode: 0,
        stdout: `sandbox:${label}:${command}`,
        stderr: '',
      };
    },
  };
}

const tools = {
  runSandboxCommand: tool({
    description: 'Run a deterministic command in the configured sandbox.',
    inputSchema: z.object({ command: z.string() }),
    execute: async ({ command }, { experimental_sandbox }) => {
      if (experimental_sandbox == null) {
        throw new Error('Sandbox is not available');
      }

      const result = await experimental_sandbox.run({
        command,
        workingDirectory: '/workspace',
        env: { SCENARIO: 'sandbox' },
      });

      return {
        command,
        sandboxDescription: experimental_sandbox.description,
        ...result,
      };
    },
  }),
};

export async function sandboxChat(
  messages: UIMessage[],
  request: SandboxRequestContext,
) {
  'use workflow';

  const streamSandbox = createSandbox({ label: 'stream' });

  const agent = new WorkflowAgent({
    model: mockSequenceModel([
      {
        type: 'tool-call',
        toolName: 'runSandboxCommand',
        input: JSON.stringify({ command: 'echo sandbox-e2e' }),
      },
      { type: 'text', text: 'Sandbox command completed.' },
    ]),
    instructions:
      'You are a deterministic sandbox e2e agent. Use the scripted tool.',
    tools,
    runtimeContext: {
      requestId: request.requestId,
      tenantId: request.tenantId,
    },
  });

  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    writable: getWritable<ModelCallStreamPart>(),
    experimental_sandbox: streamSandbox,
  });

  return { messages: result.messages };
}

export function toUIMessageStream(
  readable: ReadableStream<ModelCallStreamPart>,
) {
  return readable.pipeThrough(createModelCallToUIChunkTransform());
}
