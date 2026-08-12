import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const models = [
  'grok-4',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-4-fast-reasoning',
  'grok-4-fast-non-reasoning',
  'grok-code-fast-1',
  'grok-3',
  'grok-3-mini',
];

run(async () => {
  for (const modelId of models) {
    try {
      const result = await generateText({
        model: xai.responses(modelId),
        prompt: 'Say a single word.',
      });

      const body = result.response.body as Record<string, any>;
      const raw = body.usage;
      const sdk = result.usage;

      console.log(`--- ${modelId} ---`);
      console.log(
        `raw: output_tokens=${raw.output_tokens}, reasoning_tokens=${raw.output_tokens_details?.reasoning_tokens ?? 0}, total_tokens=${raw.total_tokens}`,
      );
      console.log(
        `sdk: outputTokens=${sdk.outputTokens}, textTokens=${sdk.outputTokenDetails?.textTokens}, reasoningTokens=${sdk.outputTokenDetails?.reasoningTokens}, totalTokens=${sdk.totalTokens}`,
      );
      console.log();
    } catch (e: any) {
      console.log(`--- ${modelId} ---`);
      console.log(`error: ${e.message?.slice(0, 80)}`);
      console.log();
    }
  }
});
