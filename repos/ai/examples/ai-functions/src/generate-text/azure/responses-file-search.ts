import { azure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';

/**
 * prepare 1
 * Please add parameters in your .env file for initialize Azure OpenAI.
 * AZURE_RESOURCE_NAME="<your_resource_name>"
 * AZURE_API_KEY="<your_api_key>"
 *
 * prepare 2
 * Please create vector store and put file in your vector.
 * URL:AOAI vector store portal
 * https://oai.azure.com/resource/vectorstore
 */

const VectorStoreId = 'vs_xxxxxxxxxxxxxxxxxxxxxxxx'; // put your vector store id.

run(async () => {
  // Basic text generation
  const basicResult = await generateText({
    model: azure.responses('gpt-4.1-mini'),
    prompt: 'What is quantum computing?', // please question about your documents.
    tools: {
      file_search: azure.tools.fileSearch({
        // optional configuration:
        vectorStoreIds: [VectorStoreId],
        maxNumResults: 10,
        ranking: {
          ranker: 'auto',
        },
      }),
    },
    // Force file search tool:
    toolChoice: { type: 'tool', toolName: 'file_search' },
  });

  console.log('\n=== Basic Text Generation ===');
  console.log(basicResult.text);
  console.log('\n=== Other Outputs ===');
  console.dir(basicResult.toolCalls, { depth: Infinity });
  console.dir(basicResult.toolResults, { depth: Infinity });
});
