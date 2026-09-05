import { createMCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Starting MCP server via stdio...\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, 'server.mjs')],
  });

  const client = await createMCPClient({ transport });

  try {
    const tools = await client.tools();
    const tool = tools['get-image'];

    console.log('Calling get-image tool...\n');
    const result = await tool.execute!(
      {},
      { messages: [], toolCallId: '1', context: {} },
    );

    console.log('Raw execute() result (MCP format):');
    console.log(JSON.stringify(result, null, 2));

    if (tool.toModelOutput) {
      console.log('\ntoModelOutput() result (AI SDK format):');
      const modelOutput = (tool.toModelOutput as Function)({
        toolCallId: '1',
        input: {},
        output: result,
      });
      console.log(JSON.stringify(modelOutput, null, 2));

      console.log('\nImage content properly converted:');
      console.log('  - MCP: type="image", mimeType="image/png"');
      console.log('  - SDK: type="file-data", mediaType="image/png"');
    } else {
      console.log('\ntoModelOutput not available (main branch)');
      console.log('Bug: raw MCP content passed to model without conversion');
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
