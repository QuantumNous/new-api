/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
export type DocsSection = {
  title: string
  paragraphs?: string[]
  items?: string[]
  code?: string
  codeLanguage?: 'bash' | 'typescript'
}

export type DocsPage = {
  slug: string
  title: string
  summary: string
  sections: DocsSection[]
}

export const REPRESENTATIVE_MODEL = 'YOUR_MODEL_ID'

export const GLOBAL_DOCS: DocsPage[] = [
  {
    slug: 'what-is-boxai',
    title: 'What is BoxAI',
    summary:
      'BoxAI (you-box.com) is a unified AI API gateway for multi-provider models, billing, and developer access.',
    sections: [
      {
        title: 'Official product definition',
        paragraphs: [
          'BoxAI (https://you-box.com) is the official unified AI API gateway. Teams use one base URL, one set of API keys, and one billing account to reach OpenAI-compatible, Claude, Gemini, and other providers.',
          'The public website and API host is you-box.com. When people search for BoxAI you-box, they are looking for this product.',
        ],
      },
      {
        title: 'What you can do with BoxAI',
        items: [
          'Call chat, responses, embeddings, images, and other gateway endpoints through a single integration.',
          'Browse model pricing and capabilities on the BoxAI Model Hub at you-box.com/pricing.',
          'Issue and rotate API keys, monitor usage, and manage quotas from the console.',
          'Connect desktop and third-party clients with the OpenAI-compatible base URL https://you-box.com/v1.',
        ],
      },
      {
        title: 'Brand and website',
        paragraphs: [
          'Product name: BoxAI (one word). Official website: https://you-box.com. Alternate spellings people use include boxai and Box AI — they all refer to this gateway when paired with you-box.com.',
        ],
      },
      {
        title: 'Next steps',
        items: [
          'Read Getting started to create a key and send your first request.',
          'Open Model Pricing to compare models available on BoxAI.',
          'Keep API keys on your server; never embed them in public frontends.',
        ],
      },
    ],
  },
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary:
      'Get started with BoxAI on you-box.com — create an API key, choose a model, and send your first gateway request.',
    sections: [
      {
        title: 'Make your first request',
        paragraphs: [
          'On BoxAI (https://you-box.com), use the production base URL shown below. Create a key in the dashboard, then copy an exact model ID from Model Hub.',
        ],
        code: `curl "$BOXAI_BASE_URL/v1/chat/completions" \\
  -H "Authorization: Bearer $BOXAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"YOUR_MODEL_ID","messages":[{"role":"user","content":"Hello"}]}'`,
        codeLanguage: 'bash',
      },
      {
        title: 'Three steps to production',
        items: [
          'Create and securely store an API key.',
          'Choose an exact model ID that is available to your group in Model Hub.',
          'Send requests to the BoxAI gateway and monitor status codes and usage.',
        ],
      },
      {
        title: 'Keep credentials private',
        paragraphs: [
          'Never expose API keys in browser code, public repositories, screenshots, or logs. Call the gateway from your trusted server and rotate any leaked key immediately.',
        ],
      },
    ],
  },
  {
    slug: 'streaming',
    title: 'Streaming',
    summary:
      'Process incremental server-sent events and cancel interrupted requests safely.',
    sections: [
      {
        title: 'Server-sent events',
        paragraphs: [
          'For OpenAI-compatible HTTP endpoints, request streaming in the payload and read each SSE data frame as it arrives. A data frame containing [DONE] ends the stream.',
          'Do not assume every protocol uses the same event shape. OpenAI-compatible, Claude, and Gemini profiles expose protocol-specific chunks and finish events.',
        ],
      },
      {
        title: 'Cancellation and cleanup',
        paragraphs: [
          'Use AbortController to cancel fetch when the user leaves, stops generation, or a deadline expires. Stop parsing, release the reader, and treat a deliberate abort differently from a network failure.',
        ],
        code: `const controller = new AbortController()
const response = await fetch(url, { ...options, signal: controller.signal })
// Later: controller.abort()`,
        codeLanguage: 'typescript',
      },
    ],
  },
  {
    slug: 'errors',
    title: 'Errors, retries, and rate limits',
    summary:
      'Classify failures, retry transient requests safely, and respect gateway limits.',
    sections: [
      {
        title: 'HTTP status categories',
        items: [
          '400 and 422 indicate invalid input; fix the request instead of retrying it unchanged.',
          '401 and 403 indicate authentication or permission failures; verify the key and model access.',
          '429 indicates a rate limit; honor Retry-After when present and reduce concurrency.',
          '500, 502, 503, and 504 are transient candidates when the operation is safe to repeat.',
        ],
      },
      {
        title: 'Safe retry policy',
        paragraphs: [
          'Retry only idempotent requests or operations protected by an idempotency mechanism. Never automatically retry authentication, permission, or validation failures.',
          'Use capped exponential backoff with random jitter, honor Retry-After, and set a small attempt limit. Cancel retries when the caller deadline or AbortSignal expires.',
        ],
      },
    ],
  },
]

export const PROFILE_NOTES: Record<string, string[]> = {
  openai_chat: [
    'Send a messages array and enable stream when incremental output is needed.',
  ],
  openai_responses: [
    'Send input instead of messages; response events differ from Chat Completions.',
  ],
  openai_responses_compact: [
    'Use this operation to compact response context before a later request.',
  ],
  anthropic_messages: [
    'Claude Messages requires x-api-key and the anthropic-version header.',
  ],
  gemini_generate_content: [
    'Gemini content uses contents and parts while gateway authentication remains Bearer.',
  ],
  openai_embeddings: [
    'Embeddings accept text or arrays of text and return numeric vectors.',
  ],
  jina_rerank: [
    'Rerank sends a query and documents, then returns relevance ordering.',
  ],
  openai_images: [
    'Image generation accepts a prompt and returns generated image data or URLs.',
  ],
  openai_audio_speech: [
    'Speech returns audio bytes; handle the response as binary rather than JSON.',
  ],
  openai_audio_transcriptions: [
    'Transcription uses multipart form data with an audio file.',
  ],
  openai_video: [
    'Video creation uses multipart form data and may complete asynchronously.',
  ],
  openai_realtime: [
    'Realtime uses WebSocket events and requires a server-side client that can set handshake headers.',
  ],
}
