import {
  openai,
  type OpenaiResponsesTextProviderMetadata,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-4.1-mini'),
    prompt:
      'Create a program that generates five random numbers between 1 and 100 with two decimal places, and show me the execution results. Also save the result to a file.',
    tools: {
      code_interpreter: openai.tools.codeInterpreter(),
      web_search: openai.tools.webSearch(),
      file_search: openai.tools.fileSearch({ vectorStoreIds: ['vs_1234'] }), // requires a configured vector store
    },
  });

  for (const part of result.content) {
    if (part.type === 'text') {
      const providerMetadata = part.providerMetadata as
        | OpenaiResponsesTextProviderMetadata
        | undefined;
      if (!providerMetadata) continue;
      const { itemId: _itemId, annotations } = providerMetadata.openai;

      if (!annotations) continue;
      for (const annotation of annotations) {
        switch (annotation.type) {
          case 'url_citation':
            // url_citation is returned from web_search and provides:
            // properties: type, url, title, start_index and end_index
            break;
          case 'file_citation':
            // file_citation is returned from file_search and provides:
            // properties: type, file_id, filename and index
            break;
          case 'container_file_citation':
            // container_file_citation is returned from code_interpreter and provides:
            // properties: type, container_id, file_id, filename, start_index and end_index
            break;
          case 'file_path':
            // file_path provides:
            // properties: type, file_id and index
            break;
          default: {
            const _exhaustiveCheck: never = annotation;
            throw new Error(
              `Unhandled annotation: ${JSON.stringify(_exhaustiveCheck)}`,
            );
          }
        }
      }
    }
  }
});
