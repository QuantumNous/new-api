import { rollDieToolWithProgrammaticCalling } from '@/tool/roll-die-tool-with-programmatic-calling';
import {
  anthropic,
  forwardAnthropicContainerIdFromLastStep,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';

export const anthropicProgrammaticToolCallingAgent = new ToolLoopAgent({
  model: anthropic('claude-opus-4-6'),
  callOptionsSchema: z.object({
    containerId: z.string().optional(),
  }),
  tools: {
    code_execution: anthropic.tools.codeExecution_20260120(),
    rollDie: rollDieToolWithProgrammaticCalling,
  },

  prepareCall: ({ options, ...rest }) => ({
    ...rest,
    providerOptions: {
      anthropic: {
        container: {
          id: options?.containerId,
        },
      } satisfies AnthropicLanguageModelOptions as any,
    },
  }),

  // Pass container ID between steps within the same stream
  prepareStep: forwardAnthropicContainerIdFromLastStep,
});

export type AnthropicProgrammaticToolCallingMessage = InferAgentUIMessage<
  typeof anthropicProgrammaticToolCallingAgent
>;
