import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

const bedrockAnthropic = createBedrockAnthropic({
  // example fetch wrapper that logs the URL:
  fetch: async (url, options) => {
    console.log(`Fetching ${url}`);
    const result = await fetch(url, options);
    console.log(`Fetched ${url}`);
    console.log();
    return result;
  },
});

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
});
