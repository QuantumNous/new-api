import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

const models = [
  'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'us.anthropic.claude-opus-4-20250514-v1:0',
  'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'us.anthropic.claude-opus-4-1-20250805-v1:0',
  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'us.anthropic.claude-3-opus-20240229-v1:0',
  'us.anthropic.claude-3-haiku-20240307-v1:0',
];

run(async () => {
  for (const modelId of models) {
    console.log(`\n--- Testing ${modelId} ---`);
    try {
      const start = Date.now();
      const result = streamText({
        model: bedrockAnthropic(modelId),
        prompt: 'Say "Hello" and nothing else.',
        maxOutputTokens: 50,
      });

      process.stdout.write('Response: ');
      for await (const textPart of result.textStream) {
        process.stdout.write(textPart);
      }
      console.log();

      const usage = await result.usage;
      const duration = Date.now() - start;

      console.log(
        `Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`,
      );
      console.log(`Duration: ${duration}ms`);
      console.log(`Status: PASS`);
    } catch (error) {
      console.log(`Status: FAIL`);
      console.log(`Error: ${error instanceof Error ? error.message : error}`);
    }
  }
});
