import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  console.log('Text:', result.text);
  console.log();
  console.log('Tool calls made:');
  for (const content of result.content) {
    if (content.type === 'tool-call') {
      console.log(
        `  - ${content.toolName} (${content.providerExecuted ? 'server-side' : 'client-side'})`,
      );
    }
  }

  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
