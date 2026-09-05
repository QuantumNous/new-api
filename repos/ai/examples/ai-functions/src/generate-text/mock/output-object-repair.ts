import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { run } from '../../lib/run';

const repairedSchema = z.object({ content: z.string() });

run(async () => {
  try {
    const result = await generateText({
      model: new MockLanguageModelV3({
        doGenerate: async () => ({
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: 20,
              text: 20,
              reasoning: undefined,
            },
          },
          warnings: [],
          finishReason: { raw: undefined, unified: 'tool-calls' },
          content: [
            { type: 'text', text: `{ "content": "provider metadata test"` },
          ],
        }),
      }),
      output: Output.object({
        schema: repairedSchema,
      }),
      prompt: 'What are the tourist attractions in San Francisco?',
    });

    console.log('Output:');
    console.log(result.output);
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || error.text == null) {
      throw error;
    }

    const repairedOutput = repairedSchema.parse(JSON.parse(`${error.text}}`));

    console.log('Output after manual repair:');
    console.log(repairedOutput);
  }
});
