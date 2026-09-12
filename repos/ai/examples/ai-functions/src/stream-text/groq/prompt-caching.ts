import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { run } from '../../lib/run';

const MODEL = 'openai/gpt-oss-120b';

const REFERENCE = (
  'The quick brown fox jumps over the lazy dog. ' +
  'Implicit prompt caching reuses a shared prompt prefix across requests. '
).repeat(1200);

run(async () => {
  console.log(`Model: ${MODEL} — 5 identical runs (caching is best-effort)\n`);

  for (let i = 1; i <= 5; i++) {
    const result = streamText({
      model: groq(MODEL),
      system: `Reference context follows.\n\n${REFERENCE}`,
      prompt:
        'In one short sentence, what does the reference context describe?',
    });

    result.consumeStream();

    const usage = await result.usage;
    const cached = usage.inputTokenDetails.cacheReadTokens ?? 0;
    console.log(
      `run ${i}: inputTokens=${usage.inputTokens} cachedInputTokens=${cached} ` +
        `${cached > 0 ? '← cache hit' : ''}`,
    );
  }
});
