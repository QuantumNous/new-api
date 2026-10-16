import {
  azure,
  type AzureResponsesSourceDocumentProviderMetadata,
  type AzureResponsesTextProviderMetadata,
} from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { downloadAzureContainerFile } from '../../lib/download-azure-container-file';

/**
 * prepare
 * Please add parameters in your .env file for initialize Azure OpenAI..
 * AZURE_RESOURCE_NAME="<your_resource_name>"
 * AZURE_API_KEY="<your_api_key>"
 */

run(async () => {
  // Basic text generation
  const basicResult = await generateText({
    model: azure.responses('gpt-4.1-mini'),
    prompt:
      'Create a program that generates five random numbers between 1 and 100 with two decimal places, and show me the execution results. Also save the result to a file.',
    tools: {
      code_interpreter: azure.tools.codeInterpreter(),
    },
  });

  console.log('\n=== Basic Text Generation ===');
  console.log(basicResult.text);
  console.log('\n=== Other Outputs ===');
  console.dir(basicResult.toolCalls, { depth: Infinity });
  console.dir(basicResult.toolResults, { depth: Infinity });
  console.log('\n=== Code Interpreter Annotations ===');

  const containerfileList: {
    containerId: string;
    fileId: string;
  }[] = [];
  for (const part of basicResult.content) {
    if (part.type === 'text') {
      const providerMetadata = part.providerMetadata as
        | AzureResponsesTextProviderMetadata
        | undefined;
      if (!providerMetadata) continue;
      const { azure } = providerMetadata;
      console.log('-- text-part-- ');
      console.dir({ azure }, { depth: Infinity });
    } else if (part.type === 'source') {
      if (part.sourceType === 'document') {
        const providerMetadata = part.providerMetadata as
          | AzureResponsesSourceDocumentProviderMetadata
          | undefined;
        if (!providerMetadata) continue;
        const { azure } = providerMetadata;
        console.log('-- source-document-part-- ');
        console.dir({ azure }, { depth: Infinity });
        if (azure.type === 'container_file_citation') {
          containerfileList.push({
            containerId: azure.containerId,
            fileId: azure.fileId,
          });
        }
      }
    }
  }
  for await (const containerFile of containerfileList) {
    await downloadAzureContainerFile(
      containerFile.containerId,
      containerFile.fileId,
    );
  }
});
