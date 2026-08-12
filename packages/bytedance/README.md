# AI SDK - ByteDance Provider

The **ByteDance provider** for the [AI SDK](https://ai-sdk.dev/docs) contains video model support for ByteDance's Seedance family of video generation models through the [BytePlus ModelArk](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API) platform.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access ByteDance (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The ByteDance provider is available in the `@ai-sdk/bytedance` module. You can install it with:

```bash
npm i @ai-sdk/bytedance
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `byteDance` from `@ai-sdk/bytedance`:

```ts
import { byteDance } from '@ai-sdk/bytedance';
```

## Video Models

This provider supports text-to-video, image-to-video, audio-video sync, first-and-last frame control, and multi-reference image generation.

### Text-to-Video

Generate video from a text prompt.

Available models: `seedance-1-5-pro-251215`, `seedance-1-0-pro-250528`, `seedance-1-0-pro-fast-251015`, `seedance-1-0-lite-t2v-250428`

```ts
import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';

const { video } = await generateVideo({
  model: byteDance.video('seedance-1-0-pro-250528'),
  prompt: 'A cat playing with a ball of yarn in a sunlit room',
  aspectRatio: '16:9',
  duration: 5,
  providerOptions: {
    bytedance: {
      watermark: false,
    },
  },
});

console.log(video.url);
```

### Image-to-Video

Generate video from a first-frame image with an optional text prompt.

Available models: `seedance-1-5-pro-251215`, `seedance-1-0-pro-250528`, `seedance-1-0-pro-fast-251015`, `seedance-1-0-lite-i2v-250428`

```ts
import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';

const { video } = await generateVideo({
  model: byteDance.video('seedance-1-5-pro-251215'),
  prompt: {
    image: 'https://example.com/first-frame.png',
    text: 'The cat slowly turns its head and blinks',
  },
  duration: 5,
  providerOptions: {
    bytedance: {
      watermark: false,
    },
  },
});
```

### Image-to-Video with Audio

Seedance 1.5 Pro supports generating synchronized audio alongside the video.

```ts
import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';

const { video } = await generateVideo({
  model: byteDance.video('seedance-1-5-pro-251215'),
  prompt: {
    image: 'https://example.com/pianist.png',
    text: 'A young man sits at a piano, playing calmly. Gentle piano music plays in sync.',
  },
  duration: 5,
  providerOptions: {
    bytedance: {
      generateAudio: true,
      watermark: false,
    },
  },
});
```

### First-and-Last Frame Video

Generate smooth transitions between a starting and ending keyframe image.

```ts
import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';

const { video } = await generateVideo({
  model: byteDance.video('seedance-1-5-pro-251215'),
  prompt: {
    image: 'https://example.com/first-frame.jpg',
    text: 'Create a 360-degree orbiting camera shot based on this photo',
  },
  duration: 5,
  providerOptions: {
    bytedance: {
      lastFrameImage: 'https://example.com/last-frame.jpg',
      generateAudio: true,
      watermark: false,
    },
  },
});
```

### Multi-Reference Image-to-Video

Provide multiple reference images (1-4) that the model uses to faithfully reproduce object shapes, colors, and textures. Use `[Image 1]`, `[Image 2]`, etc. in your prompt to reference specific images.

Available models: `seedance-1-0-lite-i2v-250428`

```ts
import { byteDance } from '@ai-sdk/bytedance';
import { experimental_generateVideo as generateVideo } from 'ai';

const { video } = await generateVideo({
  model: byteDance.video('seedance-1-0-lite-i2v-250428'),
  prompt:
    'A boy from [Image 1] and a corgi from [Image 2], sitting on the lawn from [Image 3]',
  aspectRatio: '16:9',
  duration: 5,
  providerOptions: {
    bytedance: {
      referenceImages: [
        'https://example.com/boy.png',
        'https://example.com/corgi.png',
        'https://example.com/lawn.png',
      ],
      watermark: false,
    },
  },
});
```

## Provider Options

Use `providerOptions.bytedance` to configure video generation:

| Option            | Description                                                                            |
| ----------------- | -------------------------------------------------------------------------------------- |
| `watermark`       | Whether to add a watermark to the generated video                                      |
| `generateAudio`   | Generate synchronized audio (Seedance 1.5 Pro only)                                    |
| `cameraFixed`     | Whether to fix the camera during generation                                            |
| `returnLastFrame` | Return the last frame of the generated video (useful for chaining)                     |
| `serviceTier`     | `'default'` for online inference, `'flex'` for offline at 50% price                    |
| `draft`           | Enable draft mode for low-cost 480p preview generation (Seedance 1.5 Pro only)         |
| `lastFrameImage`  | URL of last frame image for first-and-last frame generation                            |
| `referenceImages` | Array of reference image URLs (1-4) for multi-reference generation (1.0 Lite I2V only) |
| `pollIntervalMs`  | Poll interval for async generation (default: 3000ms)                                   |
| `pollTimeoutMs`   | Max wait time for generation (default: 300000ms)                                       |

Supported aspect ratios: `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive` (image-to-video only).

## Authentication

Set the `ARK_API_KEY` environment variable:

```
ARK_API_KEY=your-api-key
```

Or pass it directly:

```ts
import { createByteDance } from '@ai-sdk/bytedance';

const byteDance = createByteDance({
  apiKey: 'your-api-key',
});
```

You can [obtain an API key](https://console.byteplus.com/ark/apiKey) from the BytePlus console.

## Documentation

Please check out the **[ByteDance provider](https://ai-sdk.dev/providers/ai-sdk-providers/bytedance)** for more information.
