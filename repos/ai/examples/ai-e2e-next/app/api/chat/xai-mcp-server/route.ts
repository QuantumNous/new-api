import { xaiMcpServerAgent } from '@/agent/xai/mcp-server-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  return createAgentUIStreamResponse({
    agent: xaiMcpServerAgent,
    uiMessages: messages,
    sendSources: true,
  });
}
