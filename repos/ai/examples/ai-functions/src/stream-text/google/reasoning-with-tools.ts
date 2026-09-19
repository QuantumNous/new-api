import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { streamText } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-2.5-flash'),
    prompt: 'Calculate the sum of 2+2 using the calculate function.',
    tools: {
      calculate: {
        description: 'Calculate the result of a mathematical expression',
        inputSchema: z.object({
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
          operation: z
            .enum(['add', 'subtract', 'multiply', 'divide'])
            .describe('Mathematical operation'),
        }),
      },
    },
    toolChoice: 'required',
    reasoning: 'xhigh',
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta':
        process.stdout.write(chunk.text);
        break;
      case 'reasoning-delta':
        if (chunk.providerMetadata?.google?.thoughtSignature) {
          console.log(
            '[Reasoning with signature]:',
            chunk.providerMetadata.google.thoughtSignature,
          );
        }
        break;
      case 'tool-call':
        console.log('\nTool call:', chunk.toolName, chunk.input);
        if (chunk.providerMetadata?.google?.thoughtSignature) {
          console.log(
            '[Tool signature]:',
            chunk.providerMetadata.google.thoughtSignature,
          );
        }
        break;
    }
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
