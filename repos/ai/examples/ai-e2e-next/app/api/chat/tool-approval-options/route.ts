import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, dynamicTool, createAgentUIStreamResponse } from 'ai';
import { z } from 'zod';

function randomWeather() {
  const weatherOptions = ['sunny', 'cloudy', 'rainy', 'windy'];
  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

const weatherTool = dynamicTool({
  description: 'Get the weather in a location',
  inputSchema: z.object({ city: z.string() }),
  needsApproval: true,
  async *execute() {
    yield { state: 'loading' as const };
    await new Promise(resolve => setTimeout(resolve, 2000));
    yield {
      state: 'ready' as const,
      temperature: 72,
      weather: randomWeather(),
    };
  },
});

const defaultInstructions =
  'You are a helpful weather assistant. ' +
  'When a tool execution is not approved by the user, do not retry it. ' +
  'Just say that the tool execution was not approved.';

export async function POST(request: Request) {
  const body = await request.json();

  const systemInstruction: string | undefined = body.systemInstruction;

  const agent = new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-6'),
    instructions: systemInstruction ?? defaultInstructions,
    tools: { weather: weatherTool },
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: body.messages,
  });
}
