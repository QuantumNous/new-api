import { openaiToolSearchAgent } from '@/agent/openai/tool-search-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiToolSearchAgent,
    uiMessages: body.messages,
  });
}
