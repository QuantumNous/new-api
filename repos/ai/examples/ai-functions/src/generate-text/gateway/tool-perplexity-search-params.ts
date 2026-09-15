import { gateway, generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const result = await generateText({
    model: 'openai/gpt-5-nano',
    prompt: `Search for news about AI regulations from the first week of January 2025. `,
    tools: {
      perplexity_search: gateway.tools.perplexitySearch({
        maxResults: 5,
        searchLanguageFilter: ['en'],
        country: 'US',
        searchDomainFilter: ['reuters.com', 'bbc.com', 'nytimes.com'],
      }),
    },
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Reasoning:', result.reasoning);
  console.log();
  console.log('Tool calls:', JSON.stringify(result.toolCalls, null, 2));
  console.log('Tool results:', JSON.stringify(result.toolResults, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log(
    'Provider metadata:',
    JSON.stringify(result.finalStep.providerMetadata, null, 2),
  );
}

main().catch(console.error);
