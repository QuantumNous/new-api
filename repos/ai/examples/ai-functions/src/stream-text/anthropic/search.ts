import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-3-5-sonnet-latest'),
    prompt:
      'What are the latest news about climate change and renewable energy? Please provide current information and cite your sources.',
    tools: {
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: 8,
        blockedDomains: ['pinterest.com', 'reddit.com/r/conspiracy'],
        userLocation: {
          type: 'approximate',
          city: 'New York',
          region: 'New York',
          country: 'US',
          timezone: 'America/New_York',
        },
      }),
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Sources:', await result.sources);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);

  const sources = await result.sources;
  for (const source of sources) {
    if (source.sourceType === 'url') {
      console.log('Source URL:', source.url);
      console.log('Title:', source.title);
      console.log();
    }
  }
});
