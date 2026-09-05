import { xai } from '@ai-sdk/xai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const xaiMcpServerAgent = new ToolLoopAgent({
  model: xai.responses('grok-4-1-fast-reasoning'),
  tools: {
    mcp_server: xai.tools.mcpServer({
      serverUrl: 'https://mcp.deepwiki.com/mcp',
      serverLabel: 'deepwiki',
      serverDescription: 'DeepWiki MCP server for repository analysis',
    }),
  },
});

export type XaiMcpServerMessage = InferAgentUIMessage<typeof xaiMcpServerAgent>;
