import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const toolWithEmptyDescription = tool({
  description: '',
  inputSchema: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72,
  }),
});

run(async () => {
  const result = streamText({
    model: amazonBedrock('global.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      emptyDescTool: toolWithEmptyDescription,
    },
    toolChoice: 'required',
    prompt: 'Use the tool to get weather for San Francisco',
  });

  for await (const delta of result.stream) {
    switch (delta.type) {
      case 'text-delta': {
        process.stdout.write(delta.text);
        break;
      }
      case 'tool-call': {
        process.stdout.write(
          `\nTool call: '${delta.toolName}' ${JSON.stringify(delta.input)}`,
        );
        break;
      }
    }
  }
  process.stdout.write('\n\n');
});
