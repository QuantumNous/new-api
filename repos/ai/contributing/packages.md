# Packages

When adding new packages under `packages`, please ensure they are added to `/tsconfig.json`.

## Core Packages

| Package          | NPM Name                 | Description                             |
| ---------------- | ------------------------ | --------------------------------------- |
| `ai`             | `ai`                     | Main package                            |
| `provider`       | `@ai-sdk/provider`       | Provider specifications                 |
| `provider-utils` | `@ai-sdk/provider-utils` | Shared provider and ai code             |
| `codemod`        | `@ai-sdk/codemod`        | Automated migrations for major releases |

## AI/LLM Providers

| Package             | NPM Name                    | Provider                    |
| ------------------- | --------------------------- | --------------------------- |
| `openai`            | `@ai-sdk/openai`            | OpenAI                      |
| `anthropic`         | `@ai-sdk/anthropic`         | Anthropic (Claude)          |
| `google`            | `@ai-sdk/google`            | Google AI (Gemini)          |
| `google-vertex`     | `@ai-sdk/google-vertex`     | Google Vertex AI            |
| `azure`             | `@ai-sdk/azure`             | Azure OpenAI                |
| `amazon-bedrock`    | `@ai-sdk/amazon-bedrock`    | Amazon Bedrock              |
| `cohere`            | `@ai-sdk/cohere`            | Cohere                      |
| `mistral`           | `@ai-sdk/mistral`           | Mistral AI                  |
| `groq`              | `@ai-sdk/groq`              | Groq                        |
| `cerebras`          | `@ai-sdk/cerebras`          | Cerebras                    |
| `deepinfra`         | `@ai-sdk/deepinfra`         | DeepInfra                   |
| `deepseek`          | `@ai-sdk/deepseek`          | DeepSeek                    |
| `fireworks`         | `@ai-sdk/fireworks`         | Fireworks AI                |
| `perplexity`        | `@ai-sdk/perplexity`        | Perplexity                  |
| `replicate`         | `@ai-sdk/replicate`         | Replicate                   |
| `togetherai`        | `@ai-sdk/togetherai`        | Together AI                 |
| `xai`               | `@ai-sdk/xai`               | xAI (Grok)                  |
| `vercel`            | `@ai-sdk/vercel`            | Vercel AI                   |
| `gateway`           | `@ai-sdk/gateway`           | AI Gateway                  |
| `openai-compatible` | `@ai-sdk/openai-compatible` | OpenAI-compatible providers |
| `elevenlabs`        | `@ai-sdk/elevenlabs`        | ElevenLabs (Audio)          |
| `assemblyai`        | `@ai-sdk/assemblyai`        | AssemblyAI (Speech)         |
| `deepgram`          | `@ai-sdk/deepgram`          | Deepgram (Speech)           |
| `gladia`            | `@ai-sdk/gladia`            | Gladia (Speech)             |
| `revai`             | `@ai-sdk/revai`             | Rev.ai (Speech)             |
| `luma`              | `@ai-sdk/luma`              | Luma (Video)                |
| `fal`               | `@ai-sdk/fal`               | Fal.ai                      |
| `hume`              | `@ai-sdk/hume`              | Hume AI                     |
| `lmnt`              | `@ai-sdk/lmnt`              | LMNT (Speech)               |
| `langchain`         | `@ai-sdk/langchain`         | LangChain integration       |
| `llamaindex`        | `@ai-sdk/llamaindex`        | LlamaIndex integration      |
| `valibot`           | `@ai-sdk/valibot`           | Valibot schema validation   |

## UI Framework Integrations

| Package   | NPM Name          | Framework                   |
| --------- | ----------------- | --------------------------- |
| `react`   | `@ai-sdk/react`   | React hooks and utilities   |
| `vue`     | `@ai-sdk/vue`     | Vue composables             |
| `svelte`  | `@ai-sdk/svelte`  | Svelte stores and utilities |
| `angular` | `@ai-sdk/angular` | Angular services            |
| `rsc`     | `@ai-sdk/rsc`     | React Server Components     |
