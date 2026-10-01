# AI SDK - Kling AI Provider

The **Kling AI provider** for the [AI SDK](https://ai-sdk.dev/docs) contains video model support for the [Kling AI API](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview).

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Kling AI (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Kling AI provider is available in the `@ai-sdk/klingai` module. You can install it with:

```bash
npm i @ai-sdk/klingai
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `klingai` from `@ai-sdk/klingai`:

```ts
import { klingai } from '@ai-sdk/klingai';
```

## Video Models

This provider currently supports three video generation modes: text-to-video, image-to-video, and motion control.

> **Note:** Not all options are supported by every model version and mode combination. See the [KlingAI Capability Map](https://app.klingai.com/global/dev/document-api/apiReference/model/skillsMap) for detailed compatibility.

### Text-to-Video

Generate video from a text prompt.

Available models: `kling-v1-t2v`, `kling-v1.6-t2v`, `kling-v2-master-t2v`, `kling-v2.1-master-t2v`, `kling-v2.5-turbo-t2v`, `kling-v2.6-t2v`

```ts
import { klingai } from '@ai-sdk/klingai';
import { experimental_generateVideo } from 'ai';

const { videos } = await experimental_generateVideo({
  model: klingai.video('kling-v2.6-t2v'),
  prompt: 'A chicken flying into the sunset in the style of 90s anime.',
  aspectRatio: '16:9',
  duration: 5,
  providerOptions: {
    klingai: {
      mode: 'std',
    },
  },
});
```

### Image-to-Video

Generate video from a start frame image, with optional end frame control.

Available models: `kling-v1-i2v`, `kling-v1.5-i2v`, `kling-v1.6-i2v`, `kling-v2-master-i2v`, `kling-v2.1-i2v`, `kling-v2.1-master-i2v`, `kling-v2.5-turbo-i2v`, `kling-v2.6-i2v`

```ts
import { klingai } from '@ai-sdk/klingai';
import { experimental_generateVideo } from 'ai';

const { videos } = await experimental_generateVideo({
  model: klingai.video('kling-v2.6-i2v'),
  prompt: {
    image: 'https://example.com/start-frame.png',
    text: 'The cat slowly turns its head and blinks',
  },
  duration: 5,
  providerOptions: {
    klingai: {
      // Pro mode required for start+end frame control
      mode: 'pro',
      // Optional: end frame image
      imageTail: 'https://example.com/end-frame.png',
    },
  },
});
```

### Motion Control

Generate video using a reference motion video.

Available models: `kling-v2.6-motion-control`

```ts
import { klingai } from '@ai-sdk/klingai';
import { experimental_generateVideo } from 'ai';

const { videos } = await experimental_generateVideo({
  model: klingai.video('kling-v2.6-motion-control'),
  prompt: {
    image: 'https://example.com/character.png',
    text: 'The character performs a smooth dance move',
  },
  providerOptions: {
    klingai: {
      videoUrl: 'https://example.com/reference-motion.mp4',
      characterOrientation: 'image',
      mode: 'std',
    },
  },
});
```

## Provider Options

Use `providerOptions.klingai` to configure video generation. Options vary by mode:

| Option                 | T2V               | I2V               | Motion Control    | Description                     |
| ---------------------- | ----------------- | ----------------- | ----------------- | ------------------------------- |
| `mode`                 | `'std'` / `'pro'` | `'std'` / `'pro'` | `'std'` / `'pro'` | Generation quality mode         |
| `negativePrompt`       | Yes               | Yes               | —                 | What to avoid (max 2500 chars)  |
| `sound`                | V2.6+ pro only    | V2.6+ pro only    | —                 | `'on'` / `'off'` for audio      |
| `cfgScale`             | Yes (V1.x)        | Yes (V1.x)        | —                 | Prompt adherence [0, 1]         |
| `cameraControl`        | Yes               | Yes               | —                 | Camera movement presets         |
| `imageTail`            | —                 | Pro mode          | —                 | End frame image (URL or base64) |
| `staticMask`           | —                 | Yes               | —                 | Static brush mask               |
| `dynamicMasks`         | —                 | Yes               | —                 | Dynamic brush configs           |
| `videoUrl`             | —                 | —                 | Required          | Reference motion video URL      |
| `characterOrientation` | —                 | —                 | Required          | `'image'` or `'video'`          |
| `keepOriginalSound`    | —                 | —                 | Yes               | `'yes'` / `'no'`                |
| `watermarkEnabled`     | —                 | —                 | Yes               | Enable watermark                |
| `pollIntervalMs`       | Yes               | Yes               | Yes               | Poll interval (default: 5000ms) |
| `pollTimeoutMs`        | Yes               | Yes               | Yes               | Max wait (default: 600000ms)    |

See the [KlingAI Capability Map](https://app.klingai.com/global/dev/document-api/apiReference/model/skillsMap) for which features each model version supports.

## Authentication

Kling AI uses access key / secret key authentication. Set the following environment variables:

```
KLINGAI_ACCESS_KEY=your-access-key
KLINGAI_SECRET_KEY=your-secret-key
```

Or pass them directly:

```ts
import { createKlingAI } from '@ai-sdk/klingai';

const klingai = createKlingAI({
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key',
});
```

## Documentation

Please check out the [Kling AI API documentation](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview) for more information.
