import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/web-grounding-enterprise

export const enterpriseWebSearch = createProviderExecutedToolFactory<
  {
    // Enterprise Web Search does not have any input schema
  },
  {
    // Enterprise Web Search does not have any output parameters
  },
  {
    // Enterprise Web Search does not have any configuration options
  }
>({
  id: 'google.enterprise_web_search',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: lazySchema(() => zodSchema(z.object({}))),
});
