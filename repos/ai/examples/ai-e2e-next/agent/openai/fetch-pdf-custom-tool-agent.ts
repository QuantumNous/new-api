import { fetchPdfTool } from '@/tool/fetch-pdf-tool';
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const openaiFetchPdfCustomToolAgent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  tools: {
    fetchPdf: fetchPdfTool,
  },
  onStepFinish: ({ request }) => {
    console.dir(request.body, { depth: 3 });
  },
});

export type OpenAIFetchPdfCustomToolMessage = InferAgentUIMessage<
  typeof openaiFetchPdfCustomToolAgent
>;
