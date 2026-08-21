import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';

run(async () => {
  const result = await streamText({
    model: openai.responses('gpt-5-mini'),
    prompt: 'Can you search the web for latest NYC mayoral election results?',
    tools: {
      mcp: openai.tools.mcp({
        serverLabel: 'dmcp',
        serverUrl: 'https://mcp.exa.ai/mcp',
        serverDescription: 'A web-search API for AI agents',
      }),
    },
    include: {
      rawChunks: true,
    },
  });

  console.log('\n=== Basic Text Generation ===');
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
  console.log('\nTOOL CALLS:\n');
  console.log(await result.toolCalls);
  console.log('\nTOOL RESULTS:\n');
  console.log(await result.toolResults);
});
