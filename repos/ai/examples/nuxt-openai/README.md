# AI SDK, Nuxt and OpenAI Chat Example

This example shows how to use the [AI SDK](https://ai-sdk.dev/docs) with [Nuxt](https://nuxt.com/), and [OpenAI](https://openai.com) to create a ChatGPT-like AI-powered streaming chat bot.

## Deploy your own

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=ai-sdk-example):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fai%2Ftree%2Fmain%2Fexamples%2Fnuxt-openai&env=NUXT_OPENAI_API_KEY&envDescription=OpenAI%20API%20Key&envLink=https%3A%2F%2Fplatform.openai.com%2Faccount%2Fapi-keys&project-name=ai-chat&repository-name=nuxt-ai-chat)

## How to use

Execute `create-nuxt` to bootstrap the example:

```bash
npx create-nuxt -t github:vercel/ai/examples/nuxt-openai nuxt-openai
```

To run the example locally you need to:

1. Sign up at [OpenAI's Developer Platform](https://platform.openai.com/signup).
2. Go to [OpenAI's dashboard](https://platform.openai.com/account/api-keys) and create an API KEY.
3. Set the required OpenAI environment variable as the token value as shown [the example env file](./.env.example) but in a new file called `.env`.
4. `pnpm install` to install the required dependencies.
5. `pnpm dev` to launch the development server.

## Deploy to Vercel

This example can be directly deployed to Vercel, you can run the following commands:

```bash
pnpm run build
vercel deploy
```

This example is configured to use the `vercel-edge` [[Nitro preset](https://nitro.unjs.io/deploy/providers/vercel#vercel-edge-functions).
This means that the example will be deployed to Vercel's Edge Network.
You can use different providers, such as `vercel` by modifying your `nuxt.config.ts` file, or using the `NITRO_PRESET` environment variable.

## Learn More

To learn more about OpenAI, Nuxt, and the AI SDK take a look at the following resources:

- [AI SDK docs](https://ai-sdk.dev/docs) - learn mode about the AI SDK
- [Vercel AI Playground](https://ai-sdk.dev/playground) - compare and tune 20+ AI models side-by-side
- [OpenAI Documentation](https://platform.openai.com/docs) - learn about OpenAI features and API.
- [Nuxt Documentation](https://nuxt.com/docs) - learn about Nuxt features and API.
