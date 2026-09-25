import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';

export const anthropicCodeExecutionFileUploadAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  telemetry: {
    recordInputs: false,
  },
  callOptionsSchema: z.object({
    containerId: z.string().optional(),
  }),
  tools: {
    code_execution: anthropic.tools.codeExecution_20250825(),
  },
  prepareCall: ({ options, ...rest }) => ({
    ...rest,
    ...(options?.containerId != null
      ? {
          providerOptions: {
            anthropic: {
              container: {
                id: options.containerId,
              },
            } satisfies AnthropicLanguageModelOptions,
          },
        }
      : {}),
  }),
});

export type AnthropicCodeExecutionFileUploadMessage = InferAgentUIMessage<
  typeof anthropicCodeExecutionFileUploadAgent
>;
