import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
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
      const result = streamText({
        model: xai(modelId),
        prompt: 'Say a single word.',
      });

      for await (const textPart of result.textStream) {
        void textPart;
      }

      const sdk = await result.usage;

      console.log(`--- ${modelId} ---`);
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
