import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const vertexAnthropic = createVertexAnthropic({
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
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
});
