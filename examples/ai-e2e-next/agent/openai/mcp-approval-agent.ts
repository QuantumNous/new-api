import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const openaiMCPApprovalAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5'),
  instructions:
    'You are a helpful assistant that can shorten links. ' +
    'Use the MCP tools available to you to shorten links when needed. ' +
    'When a tool execution is not approved by the user, do not retry it. ' +
    'Just say that the tool execution was not approved.',
  tools: {
    mcp: openai.tools.mcp({
      serverLabel: 'zip1',
      serverUrl: 'https://zip1.io/mcp',
      serverDescription: 'Link shortener',
      requireApproval: 'always',
    }),
  },
});

export type OpenAIMCPApprovalAgentUIMessage = InferAgentUIMessage<
  typeof openaiMCPApprovalAgent
>;
