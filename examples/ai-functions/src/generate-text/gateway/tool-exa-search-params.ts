import { gateway, generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const result = await generateText({
    model: 'openai/gpt-5-nano',
    prompt: `Search for recent AI regulation news from trusted sources.`,
    tools: {
      exa_search: gateway.tools.exaSearch({
        type: 'fast',
        numResults: 5,
        category: 'news',
        includeDomains: ['reuters.com', 'bbc.com', 'nytimes.com'],
        contents: {
          highlights: true,
          maxAgeHours: 24,
        },
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
