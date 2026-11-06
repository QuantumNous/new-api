import { xai, type XaiLanguageModelResponsesOptions } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai.responses('grok-4-fast-non-reasoning'),
    tools: {
      file_search: xai.tools.fileSearch({
        vectorStoreIds: ['collection_your-id-here'],
        maxNumResults: 10,
      }),
    },
    providerOptions: {
      xai: {
        include: ['file_search_call.results'],
      } satisfies XaiLanguageModelResponsesOptions,
    },
    prompt: 'What documents do you have access to? Summarize the key findings.',
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Tool calls made:');
  for (const content of result.content) {
    if (content.type === 'tool-call') {
      console.log(
        `  - ${content.toolName} (${content.providerExecuted ? 'server-side' : 'client-side'})`,
      );
    }
  }

  console.log();
  console.log('Tool results:');
  for (const content of result.content) {
    if (content.type === 'tool-result') {
      console.log(`  Tool: ${content.toolName}`);
      console.log(`  Result: ${JSON.stringify(content, null, 2)}`);
    }
  }

  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
