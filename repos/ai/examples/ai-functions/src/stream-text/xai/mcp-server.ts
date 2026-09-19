import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { stream } = streamText({
    model: xai.responses('grok-4-1-fast-reasoning'),
    tools: {
      mcp_server: xai.tools.mcpServer({
        serverUrl: 'https://mcp.deepwiki.com/mcp',
        serverLabel: 'deepwiki',
        serverDescription: 'DeepWiki MCP server for repository analysis',
      }),
    },
    prompt:
      'Use the deepwiki tool to tell me about the vercel/ai repository on GitHub',
  });

  let toolCallCount = 0;

  for await (const event of stream) {
    if (event.type === 'tool-call') {
      toolCallCount++;
      console.log(
        `\n[Tool Call ${toolCallCount}] ${event.toolName}${event.providerExecuted ? ' (server-side)' : ' (client)'}`,
      );
    } else if (event.type === 'text-delta') {
      process.stdout.write(event.text);
    }
  }

  console.log('\n');
});
