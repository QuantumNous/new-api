import { openai } from '@ai-sdk/openai';
import { splitMCPAppTools } from '@ai-sdk/mcp';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from 'ai';
import { createLocalMCPAppsClient } from '../mcp-client';

function logModelStep(event: {
  stepNumber: number;
  text: string;
  toolCalls: readonly unknown[];
  toolResults: readonly unknown[];
  finishReason: string;
}) {
  console.log('[mcp-apps/chat] model step', {
    stepNumber: event.stepNumber,
    finishReason: event.finishReason,
    text: event.text,
    toolCalls: event.toolCalls,
    toolResults: event.toolResults,
  });
}

export async function POST(req: Request) {
  const requestUrl = new URL(req.url);

  const [client, { messages }] = await Promise.all([
    createLocalMCPAppsClient(requestUrl.origin),
    req.json(),
  ]);

  try {
    const { modelVisible } = splitMCPAppTools(await client.listTools());
    const tools = client.toolsFromDefinitions(modelVisible);
    const modelMessages = await convertToModelMessages(messages);

    console.log('[mcp-apps/chat] request', {
      messageCount: messages.length,
      modelVisibleTools: modelVisible.tools.map(tool => tool.name),
    });

    const result = streamText({
      model: openai('gpt-4o-mini'),
      tools,
      stopWhen: isStepCount(5),
      messages: modelMessages,
      onStepFinish: logModelStep,
      onEnd: async event => {
        console.log('[mcp-apps/chat] model finish', {
          finishReason: event.finishReason,
          text: event.text,
          totalUsage: event.usage,
          stepCount: event.steps.length,
        });
        await client.close();
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    await client.close();
    console.error(error);
    return Response.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
