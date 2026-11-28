import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

/**
 * prepare
 * Please create vector store and put file in your vector.
 * URL:openai vector store dashboard
 * https://platform.openai.com/storage/vector_stores/
 */

const VectorStoreId = 'vs_xxxxxxxxxxxxxxxxxxxxxxxx'; // put your vector store id.

run(async () => {
  // Basic text generation
  const basicResult = await generateText({
    model: openai.responses('gpt-4.1-mini'),
    prompt: 'What is quantum computing?', // please question about your documents.
    tools: {
      file_search: openai.tools.fileSearch({
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
  console.dir(basicResult.toolCalls, { depth: null });
  console.dir(basicResult.toolResults, { depth: null });
});
