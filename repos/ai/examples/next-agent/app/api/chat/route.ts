import { weatherAgent } from '@/agent/weather-agent';
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: weatherAgent,
    uiMessages: messages,
  });
}
