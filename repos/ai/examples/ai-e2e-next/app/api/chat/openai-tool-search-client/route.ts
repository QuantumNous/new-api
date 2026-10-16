import { openaiToolSearchClientAgent } from '@/agent/openai/tool-search-client-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(req: Request) {
  const body = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiToolSearchClientAgent,
    uiMessages: body.messages,
  });
}
