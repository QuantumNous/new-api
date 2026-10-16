# Manual Testing

You can use the examples under `/examples/ai-functions` and `/examples/ai-e2e-next` for manual testing (command line and web UI).

Ideally you should cover 3 cases for changes or new features:

- `generateText` test (command line)
- `streamText` test (command line)
- UI test with message and follow up message after the assistant response (to ensure that the results are correctly send back to the LLM)

# Unit Testing

## Providers

### Test Fixtures

For provider response parsing tests, we aim at storing test fixtures with the true responses from the providers (unless they are too large in which case some cutting that does not change semantics is advised).

The fixtures are stored in a `__fixtures__` subfolder, e.g. `packages/openai/src/responses/__fixtures__`. See the file names in `packages/openai/src/responses/__fixtures__` for naming conventions and `packages/openai/src/responses/openai-responses-language-model.test.ts` for how to set up test helpers.

You can use our examples under `/examples/ai-functions` to generate test fixtures.

#### generateText

For `generateText`, log the raw response output to the console and copy it into a new test fixture.

```ts
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5-nano'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(JSON.stringify(result.response.body, null, 2));
});
```

#### streamText

For `streamText`, you need to set `includeRawChunks` to `true` and use the special `saveRawChunks` helper. Run the script from the `/example/ai-functions` folder via `pnpm tsx src/stream-text/script-name.ts`. The result is then stored in the `/examples/ai-functions/output` folder. You can copy it to your fixtures folder and rename it.

```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../lib/run';
import { saveRawChunks } from '../lib/save-raw-chunks';

run(async () => {
  const result = streamText({
    model: openai('gpt-5-nano'),
    prompt: 'Invent a new holiday and describe its traditions.',
    includeRawChunks: true,
  });

  await saveRawChunks({ result, filename: 'openai-gpt-5-nano' });
});
```

#### embedMany

For `embedMany`, log the raw response body from the first response. Note that `embedMany` returns `responses` (plural, an array) not `response`.

```ts
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: ['sunny day at the beach', 'rainy day in the city'],
  });

  console.log(JSON.stringify(result.responses?.[0]?.body, null, 2));
});
```

Embedding vectors are typically too large to store in full. Trim them to a few values per vector (e.g. 5) while keeping the rest of the response structure intact.

### Loading Fixtures in Tests

The `saveRawChunks` helper writes one JSON object per line (no SSE envelope). The test chunk loader must reconstruct the SSE format the provider expects. Different providers use different SSE formats:

**OpenAI-style SSE** (openai, deepseek, groq, xai, etc.) uses `data: ` prefix with a `[DONE]` sentinel:

```ts
function prepareChunksFixtureResponse(filename: string) {
  const chunks = fs
    .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => `data: ${line}\n\n`);
  chunks.push('data: [DONE]\n\n');

  server.urls['<api-url>'].response = {
    type: 'stream-chunks',
    chunks,
  };
}
```

**Event-typed SSE** (cohere) includes an `event:` field extracted from the chunk's `type` property:

```ts
function prepareChunksFixtureResponse(filename: string) {
  const chunks = fs
    .readFileSync(`src/__fixtures__/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      const parsed = JSON.parse(line);
      return `event: ${parsed.type}\ndata: ${line}\n\n`;
    });

  server.urls['<api-url>'].response = {
    type: 'stream-chunks',
    chunks,
  };
}
```

Check the provider's `doStream` implementation to see which `createEventSourceResponseHandler` or SSE parsing it uses, and match the loader accordingly.
