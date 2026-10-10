import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const anthropicMcpAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  providerOptions: {
    anthropic: {
      mcpServers: [
        {
          type: 'url',
          name: 'echo',
          url: 'https://echo.mcp.inevitable.fyi/mcp',
        },
      ],
    } satisfies AnthropicLanguageModelOptions,
  },
});

export type AnthropicMcpMessage = InferAgentUIMessage<typeof anthropicMcpAgent>;
