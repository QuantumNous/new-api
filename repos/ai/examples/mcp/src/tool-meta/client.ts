import { createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:8084/mcp'),
  );

  const mcpClient = await createMCPClient({
    transport,
  });

  try {
    const tools = await mcpClient.tools();

    const weatherTool = tools['get-weather'];
    console.log('Tool: get-weather');
    console.log(`  Description: ${weatherTool.description}`);
    console.log(`  _meta: ${JSON.stringify(weatherTool._meta, null, 2)}`);

    if (weatherTool._meta?.['openai/outputTemplate']) {
      console.log(
        `  Output template: ${weatherTool._meta['openai/outputTemplate']}`,
      );
    }

    const weatherWidget = await mcpClient.readResource({
      uri: weatherTool!._meta!['openai/outputTemplate'] as string,
    });
    console.log('Weather widget:', JSON.stringify(weatherWidget, null, 2));

    const timeTool = tools['get-time'];
    console.log('\nTool: get-time');
    console.log(`  Description: ${timeTool.description}`);
    console.log(`  _meta: ${JSON.stringify(timeTool._meta, null, 2)}`);
  } finally {
    await mcpClient.close();
  }
}

main().catch(console.error);
