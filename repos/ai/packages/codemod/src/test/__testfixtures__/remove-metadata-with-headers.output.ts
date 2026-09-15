// @ts-nocheck
import { generateObject, LanguageModelResponseMetadata } from 'ai';
import { LanguageModelResponseMetadataWithHeaders as MetadataWithHeaders } from 'other-pkg';

// Direct type usage
interface Config {
  metadata: LanguageModelResponseMetadata;
}

// Usage with generateObject result
async function processResult() {
  const result = await generateObject({
    model,
    schema: schema,
    prompt: 'test'
  });

  // Save response metadata to variable
  const metadata: LanguageModelResponseMetadata = result.response;

  // Destructured access
  const { headers, timestamp }: LanguageModelResponseMetadata = result.response;

  // Direct property access
  const responseData: LanguageModelResponseMetadata = {
    id: result.response.id,
    timestamp: result.response.timestamp,
    headers: result.response.headers
  };

  return { metadata, headers, responseData };
}

// Should NOT rename - different package
type OtherMetadata = MetadataWithHeaders;

// Should rename
const data: LanguageModelResponseMetadata = {
  id: 'test',
  timestamp: new Date(),
  headers: {}
};
