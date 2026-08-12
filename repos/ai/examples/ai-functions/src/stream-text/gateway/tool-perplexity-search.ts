import { gateway, streamText } from 'ai';
import 'dotenv/config';

async function main() {
  const result = streamText({
    model: 'openai/gpt-5-nano',
    prompt: `Search for news about AI regulations from the first week of January 2025.`,
    tools: {
      perplexity_search: gateway.tools.perplexitySearch(),
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'reasoning-delta':
        process.stdout.write(`\x1b[34m${part.text}\x1b[0m`);
        break;
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'tool-call':
        console.log('\nTool call:', JSON.stringify(part, null, 2));
        break;
      case 'tool-result':
        console.log('\nTool result:', JSON.stringify(part, null, 2));
        break;
      case 'tool-error':
        console.log('\nTool error:', JSON.stringify(part, null, 2));
        break;
    }
  }

  console.log();
  console.log('Tool calls:', JSON.stringify(await result.toolCalls, null, 2));
  console.log(
    'Tool results:',
    JSON.stringify(await result.toolResults, null, 2),
  );
  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log(
    'Provider metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
}

main().catch(console.error);
