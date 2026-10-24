import { createMCPClient } from '@ai-sdk/mcp';
import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import 'dotenv/config';

async function main() {
  const mcpClient = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://localhost:8085/sse',
    },
  });

  const definitions = await mcpClient.listTools();
  console.log(`Definitions: ${JSON.stringify(definitions, null, 2)}`);

  // Create executable tools
  const tools = mcpClient.toolsFromDefinitions(definitions);

  const { text: answer, steps } = await generateText({
    model: openai('gpt-4o-mini'),
    tools,
    stopWhen: isStepCount(20),
    onStepFinish: async ({ toolResults }) => {
      if (toolResults.length > 0) {
        console.log('Tool results:', JSON.stringify(toolResults, null, 2));
      }
    },
    prompt:
      'Please greet Alice, then tell me the current time, and finally add 42 + 58.',
  });

  console.log(`\nFinal answer: ${answer}`);
  console.log(`Total steps: ${steps.length}`);

  await mcpClient.close();
}

main().catch(console.error);
