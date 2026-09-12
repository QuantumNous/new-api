import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    temperature: 0, // Explicitly set temperature to 0
    tools: {
      executeCommand: tool({
        description:
          'Execute a command with optional working directory and timeout',
        inputSchema: z.object({
          command: z.string().describe('The command to execute'),
          workdir: z
            .string()
            .nullable()
            .describe('Working directory (null if not specified)'),
          timeout: z
            .string()
            .nullable()
            .describe('Timeout value (null if not specified)'),
        }),
        execute: async ({ command, workdir, timeout }) => {
          return `Executed: ${command} in ${workdir || 'current dir'} with timeout ${timeout || 'default'}`;
        },
      }),
    },
    prompt: 'List the files in the /tmp directory with a 30 second timeout',
  });

  console.log(JSON.stringify(result, null, 2));
});
