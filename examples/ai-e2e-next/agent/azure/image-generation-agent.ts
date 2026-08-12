import { createAzure, azure } from '@ai-sdk/azure';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const azureImageGenerationAgent = new ToolLoopAgent({
  model: createAzure({
    headers: {
      'x-ms-oai-image-generation-deployment': 'gpt-image-2', // use your own image model deployment
    },
  })('gpt-4.1-mini'),
  tools: {
    image_generation: azure.tools.imageGeneration({
      partialImages: 3,
      quality: 'low',
      size: '1024x1024',
    }),
  },
  onStepFinish: ({ request }) => {
    console.log(JSON.stringify(request.body, null, 2));
  },
});

export type AzureImageGenerationMessage = InferAgentUIMessage<
  typeof azureImageGenerationAgent
>;
