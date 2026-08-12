import { anthropicWebFetch20260209Agent } from '@/agent/anthropic/web-fetch-20260209-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  return createAgentUIStreamResponse({
    agent: anthropicWebFetch20260209Agent,
    uiMessages: body.messages,
    sendSources: true,
  });
}
