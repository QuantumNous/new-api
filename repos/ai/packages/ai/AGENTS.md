# AI SDK Usage

## Use Cases

### Generating Text

#### text prompt

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-5',
  prompt: 'Invent a new holiday.', // text prompt
});

const text = result.text; // access generated text
```

#### Specifying the maximum number of tokens to generate

```ts
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-5',
  prompt: 'Invent a new holiday.',
  maxOutputTokens: 100, // maximum number of tokens to generate
});
```

### Streaming Text

#### text prompt and text stream

```ts
import { streamText } from 'ai';

const result = streamText({
  model: 'openai/gpt-5',
  prompt: 'Invent a new holiday.', // text prompt
});

const textStream = result.textStream; // access text stream
```

#### Specifying the maximum number of tokens to generate

```ts
import { streamText } from 'ai';

const result = await streamText({
  model: 'openai/gpt-5',
  prompt: 'Invent a new holiday.',
  maxOutputTokens: 100, // maximum number of tokens to generate
});
```
