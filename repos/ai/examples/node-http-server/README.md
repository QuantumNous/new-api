# Node.js Http Server + AI SDK Example

A minimal Node.js HTTP server demonstrating how to use the AI SDK to stream text and custom UI message data over HTTP.

## Endpoints

| Method | Path           | Description                                                                        |
| ------ | -------------- | ---------------------------------------------------------------------------------- |
| `POST` | `/`            | Streams a text response generated with `streamText`.                               |
| `POST` | `/stream-data` | Streams a UI message stream that mixes custom data parts with `streamText` output. |

## Setup

1. From the root of the AI SDK repo, install dependencies:

   ```sh
   pnpm install
   ```

2. Create a `.env` file in `examples/node-http-server/` (copy from `.env.example`) and add your OpenAI API key:

   ```sh
   OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
   ```

3. Start the server from this directory:

   ```sh
   pnpm dev
   ```

   The server listens on `http://localhost:8080`.

## Try it

Stream a text response:

```sh
curl -X POST http://localhost:8080/
```

Stream custom data alongside generated text:

```sh
curl -X POST http://localhost:8080/stream-data
```
