# Angular AI SDK Example

A small Angular app that exercises the AI SDK UI package with chat, completion, and structured object generation.

## Setup

```bash
# Install dependencies
pnpm install

# Create .env file with your AI Gateway API key
echo "AI_GATEWAY_API_KEY=your_key_here" > .env

# Or use OIDC authentication
# echo "VERCEL_OIDC_TOKEN=your_token_here" > .env

# Start the app
pnpm start
```

This runs both the Angular frontend (localhost:4200) and Express backend (localhost:3000) concurrently.

## Tech Stack

- Angular 20
- Express.js backend
- AI SDK (@ai-sdk/angular, ai)
- AI Gateway (default provider)

## Features

- Real-time chat interface
- Completion + structured object examples
- Message streaming
- Fake weather tool (server-side)
- Reasoning stream (supported models only)
- Proxy configuration for API requests

Set your preferred model in `chat.component.ts` by changing the `selectedModel` parameter.
Use AI Gateway model IDs like `openai/gpt-5.4`.
