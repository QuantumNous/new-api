# AI SDK Angular

Angular UI components for the [AI SDK v6](https://ai-sdk.dev/docs).

## Overview

The `@ai-sdk/angular` package provides Angular-specific implementations using Angular signals for reactive state management:

- **Chat** - Multi-turn conversations with streaming responses
- **Completion** - Single-turn text generation
- **StructuredObject** - Type-safe object generation with Zod schemas

## Installation

```bash
npm install @ai-sdk/angular ai
```

### Peer Dependencies

- Angular 16+ (`@angular/core`)
- Zod v3+ (optional, for structured objects)

## Chat

Real-time conversation interface with streaming support.

### Basic Usage

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Chat } from '@ai-sdk/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="chat-container">
      <div class="messages">
        @for (message of chat.messages; track message.id) {
          <div class="message" [ngClass]="message.role">
            @for (part of message.parts; track $index) {
              @switch (part.type) {
                @case ('text') {
                  <div style="white-space: pre-wrap">
                    {{ part.text }}
                    @if (part.state === 'streaming') {
                      <span class="cursor">&#9646;</span>
                    }
                  </div>
                }
                @case ('reasoning') {
                  <details>
                    <summary>Reasoning</summary>
                    <div style="white-space: pre-wrap; opacity: 80%">
                      {{ part.text }}
                    </div>
                  </details>
                }
                @default {
                  <code>{{ part | json }}</code>
                }
              }
            }
          </div>
        }
        @if (chat.status === 'submitted') {
          <div><em>Waiting...</em></div>
        }
      </div>

      <form [formGroup]="chatForm" (ngSubmit)="sendMessage()">
        <input formControlName="userInput" placeholder="Type your message..." />
        @if (chat.status === 'ready') {
          <button type="submit" [disabled]="!chatForm.valid">Send</button>
        } @else {
          <button [disabled]="chat.status === 'error'" (click)="chat.stop()">
            Stop
          </button>
        }
      </form>
    </div>
  `,
})
export class ChatComponent {
  private fb = inject(FormBuilder);

  public chat = new Chat({});

  chatForm = this.fb.group({
    userInput: ['', Validators.required],
  });

  sendMessage() {
    if (this.chatForm.invalid) return;

    const userInput = this.chatForm.value.userInput;
    this.chatForm.reset();

    this.chat.sendMessage(
      { text: userInput },
      {
        body: {
          selectedModel: 'openai/gpt-5.4',
        },
      },
    );
  }
}
```

`selectedModel` should be an AI Gateway model ID like `openai/gpt-5.4`.

### Constructor Options

```typescript
interface ChatInit<UI_MESSAGE extends UIMessage = UIMessage> {
  /** A unique identifier for the chat */
  id?: string;

  /** Optional metadata schema for UI messages */
  messageMetadataSchema?:
    | Validator<InferUIMessageMetadata<UI_MESSAGE>>
    | StandardSchemaV1<InferUIMessageMetadata<UI_MESSAGE>>;

  /** Optional data part schemas for UI messages */
  dataPartSchemas?: UIDataTypesToSchemas<InferUIMessageData<UI_MESSAGE>>;

  /** Initial messages */
  messages?: UI_MESSAGE[];

  /** Custom ID generator */
  generateId?: IdGenerator;

  /** Custom transport */
  transport?: ChatTransport<UI_MESSAGE>;

  /** Maximum conversation steps */
  maxSteps?: number;

  /** Tool call handler */
  onToolCall?: (params: {
    toolCall: ToolCall<string, unknown>;
  }) => void | Promise<unknown> | unknown;

  /** Completion callback */
  onFinish?: (params: { message: UI_MESSAGE }) => void;

  /** Data part callback */
  onData?: (dataPart: DataUIPart<InferUIMessageData<UI_MESSAGE>>) => void;

  /** Error handler */
  onError?: (error: Error) => void;
}
```

### Properties (Reactive)

These are values backed by Angular signals and update reactively.

- `messages: UIMessage[]` - Array of conversation messages
- `status: ChatStatus` - Current status
- `error: Error | undefined` - Current error state

### Methods

```typescript
// Send a message
await chat.sendMessage(
  message: UIMessageInput,
  options?: {
    body?: object;
    headers?: Record<string, string> | Headers;
  }
);

// Regenerate last assistant message
await chat.regenerate(options?: {
  body?: object;
  headers?: Record<string, string> | Headers;
});

// Resume an interrupted stream
await chat.resumeStream(options?: {
  body?: object;
  headers?: Record<string, string> | Headers;
});

// Add tool execution result
chat.addToolResult({
  toolCallId: string;
  output: unknown;
});

// Stop current generation
chat.stop();
```

### File Attachments

```typescript
// HTML template
<input type="file" multiple (change)="onFileSelect($event)" />

// Component
onFileSelect(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    this.chat.sendMessage({
      text: "Analyze these files",
      files: files
    });
  }
}
```

### Client-side Tool Calls

```typescript
const chat = new Chat({
  async onToolCall({ toolCall }) {
    switch (toolCall.toolName) {
      case 'get_weather':
        return await getWeather(toolCall.input.location);
      case 'search':
        return await search(toolCall.input.query);
      default:
        throw new Error(`Unknown tool: ${toolCall.toolName}`);
    }
  },
});
```

## Completion

Single-turn text generation with streaming.

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { Completion } from '@ai-sdk/angular';

@Component({
  selector: 'app-completion',
  template: `
    <div>
      <textarea
        [(ngModel)]="completion.input"
        placeholder="Enter your prompt..."
        rows="4"
      >
      </textarea>

      <button
        (click)="completion.complete(completion.input)"
        [disabled]="completion.loading"
      >
        {{ completion.loading ? 'Generating...' : 'Generate' }}
      </button>

      @if (completion.loading) {
        <button (click)="completion.stop()">Stop</button>
      }

      <div class="result">
        <h3>Result:</h3>
        <pre>{{ completion.completion }}</pre>
      </div>

      @if (completion.error) {
        <div class="error">{{ completion.error.message }}</div>
      }
    </div>
  `,
})
export class CompletionComponent {
  completion = new Completion({
    api: '/api/completion',
    streamProtocol: 'text',
    onFinish: (prompt, completion) => {
      console.log('Completed:', { prompt, completion });
    },
  });
}
```

### Constructor Options

```typescript
interface CompletionOptions {
  /** API endpoint (default: '/api/completion') */
  api?: string;

  /** Unique identifier */
  id?: string;

  /** Initial completion text */
  initialCompletion?: string;

  /** Initial input text */
  initialInput?: string;

  /** Stream protocol: 'data' (default) | 'text' */
  streamProtocol?: 'data' | 'text';

  /** Completion callback */
  onFinish?: (prompt: string, completion: string) => void;

  /** Error handler */
  onError?: (error: Error) => void;

  /** Custom fetch function */
  fetch?: FetchFunction;

  /** Request headers */
  headers?: Record<string, string> | Headers;

  /** Request body */
  body?: object;

  /** Request credentials */
  credentials?: RequestCredentials;
}
```

### Properties (Reactive)

- `completion: string` - Generated text (writable)
- `input: string` - Current input (writable)
- `loading: boolean` - Generation state
- `error: Error | undefined` - Error state
- `id: string` - Completion ID
- `api: string` - API endpoint
- `streamProtocol: 'data' | 'text'` - Stream type

### Methods

```typescript
// Generate completion
await completion.complete(
  prompt: string,
  options?: {
    headers?: Record<string, string> | Headers;
    body?: object;
  }
);

// Form submission handler
await completion.handleSubmit(event?: { preventDefault?: () => void });

// Stop generation
completion.stop();
```

## StructuredObject

Generate structured data with Zod schemas and streaming.

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { StructuredObject } from '@ai-sdk/angular';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
});

@Component({
  selector: 'app-structured-object',
  template: `
    <div>
      <textarea
        [(ngModel)]="input"
        placeholder="Enter content to analyze..."
        rows="4"
      >
      </textarea>

      <button (click)="analyze()" [disabled]="structuredObject.loading">
        {{ structuredObject.loading ? 'Analyzing...' : 'Analyze' }}
      </button>

      @if (structuredObject.object) {
        <div class="result">
          <h3>Analysis:</h3>
          <div><strong>Title:</strong> {{ structuredObject.object.title }}</div>
          <div>
            <strong>Summary:</strong> {{ structuredObject.object.summary }}
          </div>
          <div>
            <strong>Tags:</strong>
            {{ structuredObject.object.tags?.join(', ') }}
          </div>
          <div>
            <strong>Sentiment:</strong> {{ structuredObject.object.sentiment }}
          </div>
        </div>
      }

      @if (structuredObject.error) {
        <div class="error">{{ structuredObject.error.message }}</div>
      }
    </div>
  `,
})
export class StructuredObjectComponent {
  input = '';

  structuredObject = new StructuredObject({
    api: '/api/analyze',
    schema,
    onFinish: ({ object, error }) => {
      if (error) {
        console.error('Schema validation failed:', error);
      } else {
        console.log('Generated object:', object);
      }
    },
  });

  async analyze() {
    if (!this.input.trim()) return;
    await this.structuredObject.submit(this.input);
  }
}
```

### Constructor Options

```typescript
interface StructuredObjectOptions<SCHEMA, RESULT> {
  /** API endpoint */
  api: string;

  /** Zod schema */
  schema: SCHEMA;

  /** Unique identifier */
  id?: string;

  /** Initial object value */
  initialValue?: DeepPartial<RESULT>;

  /** Completion callback */
  onFinish?: (event: {
    object: RESULT | undefined;
    error: Error | undefined;
  }) => void;

  /** Error handler */
  onError?: (error: Error) => void;

  /** Custom fetch function */
  fetch?: FetchFunction;

  /** Request headers */
  headers?: Record<string, string> | Headers;

  /** Request credentials */
  credentials?: RequestCredentials;
}
```

### Properties (Reactive)

- `object: DeepPartial<RESULT> | undefined` - Generated object
- `loading: boolean` - Generation state
- `error: Error | undefined` - Error state

### Methods

```typescript
// Submit input for generation
await structuredObject.submit(input: unknown);

// Stop generation
structuredObject.stop();
```

## Server Implementation

When you pass a string model ID (for example `openai/gpt-5.4`), the AI SDK uses
AI Gateway as the default provider, so no provider import is required.

### Express.js Chat Endpoint

```typescript
import {
  convertToModelMessages,
  pipeTextStreamToResponse,
  pipeUIMessageStreamToResponse,
  streamText,
  toTextStream,
  toUIMessageStream,
} from 'ai';
import express from 'express';

const app = express();
app.use(express.json({ strict: false }));

app.post('/api/chat', async (req, res) => {
  const { messages, selectedModel } = req.body;

  const result = streamText({
    model: selectedModel || 'openai/gpt-5.4',
    messages: convertToModelMessages(messages),
  });

  pipeUIMessageStreamToResponse({
    response: res,
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
```

### Express.js Completion Endpoint

```typescript
app.post('/api/completion', async (req, res) => {
  const { prompt } = req.body;

  const result = streamText({
    model: 'openai/gpt-5.4',
    prompt,
  });

  pipeTextStreamToResponse({
    response: res,
    stream: toTextStream({ stream: result.stream }),
  });
});
```

### Express.js Structured Object Endpoint

```typescript
import { streamObject } from 'ai';
import { z } from 'zod';

app.post('/api/analyze', async (req, res) => {
  const input = req.body;

  const result = streamObject({
    model: 'openai/gpt-5.4',
    schema: z.object({
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
    }),
    prompt: `Analyze this content: ${JSON.stringify(input)}`,
  });

  result.pipeTextStreamToResponse(res);
});
```

## Development Setup

### Building the Library

```bash
# Install dependencies
pnpm install

# Build library
pnpm build

# Watch mode
pnpm build:watch

# Run tests
pnpm test

# Test watch mode
pnpm test:watch
```

### Running the Example

```bash
# Navigate to example
cd examples/angular

# Set up environment
echo "AI_GATEWAY_API_KEY=your_key_here" > .env

# Alternatively, use OIDC authentication
# echo "VERCEL_OIDC_TOKEN=your_token_here" > .env

# Start development (Angular + Express)
pnpm start
```

Starts:

- Angular dev server: `http://localhost:4200`
- Express API server: `http://localhost:3000`
- Proxy routes `/api/*` to Express

## Testing

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:update       # Update snapshots
```

## TypeScript Support

Full type safety with automatic type inference:

```typescript
import { Chat, UIMessage, StructuredObject } from '@ai-sdk/angular';
import { z } from 'zod';

// Custom message types
interface CustomMessage extends UIMessage {
  customData?: string;
}

const chat = new Chat<CustomMessage>({});

// Schema-typed objects
const schema = z.object({
  name: z.string(),
  age: z.number(),
});

const obj = new StructuredObject({
  api: '/api/object',
  schema, // Type automatically inferred
});

// obj.object has type: { name?: string; age?: number } | undefined
```

## Error Handling

All components provide reactive error states:

```typescript
const chat = new Chat({
  onError: (error) => {
    console.error('Chat error:', error);
  }
});

// Template
@if (chat.error) {
  <div class="error">{{ chat.error.message }}</div>
}
```

## Performance

### Stop on-going requests

```typescript
chat.stop();
completion.stop();
structuredObject.stop();
```

### Change Detection

Uses Angular signals for efficient reactivity:

```typescript
// These trigger minimal change detection
chat.messages; // UIMessage[]
chat.status; // ChatStatus
chat.error; // Error | undefined
```

## License

Apache-2.0
