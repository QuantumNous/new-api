# Next.js x AI SDK x Kasada

Integration of an AI chat app based on Vercel's AI SDK and [Kasada](https://www.kasada.io/)'s advanced bot protection solution.

This implementation hooks into the API calls to the LLM and prevents abusive usage before it occurs.

# Setup

1. Run these commands to install the dependencies and create a `.env.local` file:

```sh
pnpm i
cp .env.local.example .env.local # and fill in the required values
```

2. Based on your Kasada dashboard, update the API URL in both `kasada-server.ts` and `kasada-client.ts`. It looks something like this:

```
https://${kasadaAPIHostname}/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/api/${kasadaAPIVersion}/classification
```

3. Move the existing `app/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/[[...restpath]]/route.ts` file to your
   new path, and fill in the `KASADA_ENDPOINT` and `X-Forwarded-Host` header inside of it. They're labelled `FILL_IN`.
