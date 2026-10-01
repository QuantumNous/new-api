import { gateway, generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const result = await generateText({
    model: 'openai/gpt-5-nano',
    prompt: `Search for the latest research on quantum computing breakthroughs.`,
    tools: {
      parallel_search: gateway.tools.parallelSearch({
        mode: 'agentic',
        maxResults: 5,
        sourcePolicy: {
          includeDomains: ['nature.com', 'arxiv.org', 'science.org'],
        },
        excerpts: {
          maxCharsPerResult: 8000,
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
