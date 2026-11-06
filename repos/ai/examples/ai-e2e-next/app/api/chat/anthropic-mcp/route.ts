import { anthropicMcpAgent } from '@/agent/anthropic/mcp-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  console.dir(body.messages, { depth: Infinity });

  return createAgentUIStreamResponse({
    agent: anthropicMcpAgent,
    uiMessages: body.messages,
  });
}
