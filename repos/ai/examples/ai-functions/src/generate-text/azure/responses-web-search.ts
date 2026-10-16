import { azure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';

/**
 * prepare
 * Please add parameters in your .env file for initialize Azure OpenAI..
 * AZURE_RESOURCE_NAME="<your_resource_name>"
 * AZURE_API_KEY="<your_api_key>"
 */

run(async () => {
  // Basic text generation
  const basicResult = await generateText({
    model: azure('gpt-5.4-mini'),
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
  console.log(basicResult.text);
  console.log('\n=== Other Outputs ===');
  console.dir(basicResult.toolCalls, { depth: Infinity });
  console.dir(basicResult.toolResults, { depth: Infinity });
  console.log('\n=== Web Search Preview Annotations ===');
  for (const part of basicResult.content) {
    if (part.type === 'text') {
      const annotations = part.providerMetadata?.azure?.annotations;
      if (annotations) {
        console.dir(annotations);
      }
    }
  }
});
