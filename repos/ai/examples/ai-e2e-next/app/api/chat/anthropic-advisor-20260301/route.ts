import { anthropicAdvisor20260301Agent } from '@/agent/anthropic/advisor-20260301-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  return createAgentUIStreamResponse({
    agent: anthropicAdvisor20260301Agent,
    uiMessages: body.messages,
  });
}
