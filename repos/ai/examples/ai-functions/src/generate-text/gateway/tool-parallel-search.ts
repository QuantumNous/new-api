import { gateway, generateText } from 'ai';
import 'dotenv/config';

async function main() {
  const result = await generateText({
    model: 'openai/gpt-5-nano',
    prompt:
      'Use the parallelSearch tool to find current information about renewable energy developments in 2025. You must search the web first before answering.',
    tools: {
      parallel_search: gateway.tools.parallelSearch(),
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
