# Next.js Chat Example

A minimal Next.js chat application for testing message persistence, server-side
rendering (SSR), and resumable streams.

## Prerequisites

- Node.js 22, 24, or 26
- pnpm 10 or later
- An [AI Gateway API key](https://vercel.com/ai-gateway)
- A Redis database with pub/sub support for resumable streams

## Setup

From the repository root, install dependencies and build the workspace
packages:

```bash
pnpm install
pnpm build
```

Copy the example environment file:

```bash
cp examples/next/.env.local.example examples/next/.env.local
```

Then set these values in `examples/next/.env.local`:

- `AI_GATEWAY_API_KEY`: authenticates requests to the AI Gateway. A
  `VERCEL_OIDC_TOKEN` can be used instead.
- `REDIS_URL`: connects `resumable-stream` to Redis.

## Run locally

```bash
cd examples/next
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test the example

Send a message to create a chat. The example stores chat data as JSON files in
`examples/next/.chats` so that reloading a chat URL renders its saved messages
on the server.

To test stream resumption, request a long response and reload the page while it
is still streaming. The client reconnects to the active stream through Redis.

The file-based chat store is for local demonstration only and is not suitable
for production use.
