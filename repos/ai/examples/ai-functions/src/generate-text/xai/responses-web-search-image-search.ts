import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai.responses('grok-4.5'),
    tools: {
      web_search: xai.tools.webSearch({ enableImageSearch: true }),
    },
    prompt: 'Show me images of SpaceX Starship on the launch pad.',
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Tool calls made:');
  for (const content of result.content) {
    if (content.type === 'tool-call') {
      console.log(
        `  - ${content.toolName} (providerExecuted: ${content.providerExecuted})`,
      );
    }
  }

  console.log();
  console.log('Sources cited:');
  for (const content of result.content) {
    if (content.type === 'source' && content.sourceType === 'url') {
      console.log(`  - ${content.url}`);
    }
  }

  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
