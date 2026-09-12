# Fastify + AI SDK Example

You can use the AI SDK in an [Fastify](https://fastify.dev/) server to generate and stream text and objects.

## Usage

1. Create .env file with the following content (and more settings, depending on the providers you want to use):

```sh
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

2. Run the following commands from the root directory of the AI SDK repo:

```sh
pnpm install
pnpm build
```

3. Run the following command:

```sh
pnpm dev
```

4. Test the endpoint with Curl:

```sh
curl -X POST http://localhost:8080
```
