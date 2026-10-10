import { azure } from '@ai-sdk/azure';
import { streamText } from 'ai';
import { run } from '../../lib/run';

/**
 * prepare
 * Please add parameters in your .env file for initialize Azure OpenAI..
 * AZURE_RESOURCE_NAME="<your_resource_name>"
 * AZURE_API_KEY="<your_api_key>"
 */

run(async () => {
  // Basic text generation
  const result = streamText({
    model: azure('gpt-5.4-mini'), // use your own deployment
    prompt: 'Summarize how to upgrade AI SDK from 5 to 6.',
    tools: {
      web_search: azure.tools.webSearch({
        searchContextSize: 'low',
        filters: {
          allowedDomains: ['ai-sdk.dev'],
        },
      }),
    },
  });

  console.log('\n=== Basic Text Generation ===');
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
  console.log('\n=== Other Outputs ===');
  console.log(await result.toolCalls);
  console.log(await result.toolResults);
  console.log('\n=== Web Search Preview Annotations ===');
  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-end':
        {
          const annotations = part.providerMetadata?.azure?.annotations;
          if (annotations) {
            console.dir(annotations);
          }
        }
        break;

      case 'source':
        if (part.sourceType === 'url') {
          console.log(`\n[source: ${part.url}]`);
        }
        break;

      case 'error':
        console.log('error');
        console.error(part.error);
        break;
    }
  }
});
