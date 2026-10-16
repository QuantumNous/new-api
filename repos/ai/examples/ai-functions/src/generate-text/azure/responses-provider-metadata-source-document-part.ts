import {
  azure,
  type AzureResponsesSourceDocumentProviderMetadata,
} from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: azure('gpt-4.1-mini'),
    prompt:
      'Create a program that generates five random numbers between 1 and 100 with two decimal places, and show me the execution results. Also save the result to a file.',
    tools: {
      code_interpreter: azure.tools.codeInterpreter(),
      web_search_preview: azure.tools.webSearchPreview({}),
      file_search: azure.tools.fileSearch({ vectorStoreIds: ['vs_1234'] }), // requires a configured vector store
    },
  });

  for (const part of result.content) {
    if (part.type === 'source') {
      if (part.sourceType === 'document') {
        const providerMetadata = part.providerMetadata as
          | AzureResponsesSourceDocumentProviderMetadata
          | undefined;
        if (!providerMetadata) continue;
        const annotation = providerMetadata.azure;
        switch (annotation.type) {
          case 'file_citation':
            // file_citation is returned from file_search and provides:
            // properties: type, fileId and index
            // The filename can be accessed via part.filename.
            break;
          case 'container_file_citation':
            // container_file_citation is returned from code_interpreter and provides:
            // properties: type, containerId and fileId
            // The filename can be accessed via part.filename.
            break;
          case 'file_path':
            // file_path provides:
            // properties: type, fileId and index
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
