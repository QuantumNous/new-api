import { anthropicWebSearchAgent } from '@/agent/anthropic/web-search-agent';
import { convertToModelMessages, createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const body = await request.json();
  const uiMessages = body.messages;

  console.log(
    '[anthropic-web-search-repro] UI messages',
    JSON.stringify(
      uiMessages,
      ['role', 'parts', 'type', 'state', 'toolCallId', 'providerExecuted'],
      2,
    ),
  );

  const modelMessages = await convertToModelMessages(uiMessages, {
    tools: anthropicWebSearchAgent.tools,
  });

  console.log(
    '[anthropic-web-search-repro] model messages',
    JSON.stringify(
      modelMessages,
      ['role', 'content', 'type', 'toolCallId', 'toolName', 'providerExecuted'],
      2,
    ),
  );

  return createAgentUIStreamResponse({
    agent: anthropicWebSearchAgent,
    uiMessages,
    sendSources: true,
  });
}
