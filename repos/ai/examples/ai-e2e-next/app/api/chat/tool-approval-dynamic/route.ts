import { dynamicWeatherWithApprovalAgent } from '@/agent/anthropic/dynamic-weather-with-approval-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();

  console.dir(body.messages, { depth: Infinity });

  return createAgentUIStreamResponse({
    agent: dynamicWeatherWithApprovalAgent,
    uiMessages: body.messages,
  });
}
