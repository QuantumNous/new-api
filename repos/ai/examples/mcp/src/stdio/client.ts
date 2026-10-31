import { openai } from '@ai-sdk/openai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { generateText, isStepCount } from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';
import 'dotenv/config';
import { z } from 'zod';

async function main() {
  let mcpClient;

  try {
    // Or use the AI SDK's stdio transport by importing:
    // import { Experimental_StdioMCPTransport as StdioClientTransport } from 'ai/mcp-stdio'
    const stdioTransport = new StdioClientTransport({
      command: 'node',
      args: ['src/stdio/dist/server.js'],
      env: {
        FOO: 'bar',
      },
    });

    mcpClient = await createMCPClient({
      transport: stdioTransport,
    });

    const { text: answer } = await generateText({
      model: openai('gpt-4o-mini'),
      tools: await mcpClient.tools({
        schemas: {
          'get-pokemon': {
            inputSchema: z.object({ name: z.string() }),
          },
        },
      }),
      stopWhen: isStepCount(10),
      onStepFinish: async ({ toolResults }) => {
        console.log(`STEP RESULTS: ${JSON.stringify(toolResults, null, 2)}`);
      },
      instructions: 'You are an expert in Pokemon',
      prompt:
        'Which Pokemon could best defeat Feebas? Choose one and share details about it.',
    });

    console.log(`FINAL ANSWER: ${answer}`);
  } finally {
    await mcpClient?.close();
  }
}

main().catch(console.error);
