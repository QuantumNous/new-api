---
title: Automatic1111
description: Automatic1111 Provider for the AI SDK
---

# Automatic1111

[AUTOMATIC1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) is a popular web interface for Stable Diffusion that provides a comprehensive set of features for image generation. The [Automatic1111 provider](https://github.com/Ponesicek/automatic1111-provider) for the AI SDK enables seamless integration with locally hosted AUTOMATIC1111 instances while offering unique advantages:

- **Local Control**: Full control over your image generation with local Stable Diffusion models
- **No API Costs**: Generate unlimited images without per-request charges
- **Model Flexibility**: Use any Stable Diffusion checkpoint
- **Privacy**: All generation happens locally on your hardware
- **Community Models**: Access to thousands of community-created models from Civitai and HuggingFace

Learn more about AUTOMATIC1111's capabilities in the [AUTOMATIC1111 Documentation](https://github.com/AUTOMATIC1111/stable-diffusion-webui).

## Setup

You need to have AUTOMATIC1111 running with the `--api` flag enabled. Start your AUTOMATIC1111 instance with:

```bash
# Windows
./webui.bat --api

# Linux/Mac
./webui.sh --api
```

The Automatic1111 provider is available in the `automatic1111-provider` module. You can install it with:

```bash
# pnpm
pnpm add automatic1111-provider

# npm
npm install automatic1111-provider

# yarn
npm install automatic1111-provider
```

## Provider Instance

To create an Automatic1111 provider instance, use the `createAutomatic1111` function:

```typescript
import { createAutomatic1111 } from 'automatic1111-provider';

const automatic1111 = createAutomatic1111({
  baseURL: 'http://127.0.0.1:7860', // Your AUTOMATIC1111 instance
});
```

## Image Models

The Automatic1111 provider supports image generation through the `image()` method:

```typescript
// Basic image generation
const imageModel = automatic1111.image('v1-5-pruned-emaonly');

// With custom model
const sdxlModel = automatic1111.image('sd_xl_base_1.0');
```

## Examples

### Basic Image Generation

```typescript
import { automatic1111 } from 'automatic1111-provider';
import { generateImage } from 'ai';

const { images } = await generateImage({
  model: automatic1111.image('v1-5-pruned-emaonly'),
  prompt: 'A beautiful sunset over mountains',
  size: '512x512',
});
```

### Advanced Configuration

```typescript
const { images } = await generateImage({
  model: automatic1111.image('realistic-vision-v4'),
  prompt: 'Portrait of a wise old wizard with a long beard',
  n: 2,
  seed: 12345,
  providerOptions: {
    automatic1111: {
      negative_prompt: 'blurry, ugly, deformed, low quality',
      steps: 40,
      cfg_scale: 8.5,
      sampler_name: 'DPM++ SDE Karras',
      styles: ['photorealistic', 'detailed'],
      check_model_exists: true,
    },
  },
});
```

## Provider Options

The Automatic1111 provider supports the following options for customizing image generation:

### Available Options

| Option               | Type       | Default     | Description                              |
| -------------------- | ---------- | ----------- | ---------------------------------------- |
| `negative_prompt`    | `string`   | `undefined` | What you don't want in the image         |
| `steps`              | `number`   | `20`        | Number of sampling steps                 |
| `cfg_scale`          | `number`   | `7`         | CFG (Classifier Free Guidance) scale     |
| `sampler_name`       | `string`   | `"Euler a"` | Sampling method                          |
| `denoising_strength` | `number`   | `undefined` | Denoising strength for img2img (0.0-1.0) |
| `styles`             | `string[]` | `undefined` | Apply predefined styles                  |
| `check_model_exists` | `boolean`  | `false`     | Verify model exists before generation    |

## Model Management

The provider automatically detects available models from your AUTOMATIC1111 instance. To use a model:

1. Place your `.safetensors` or `.ckpt` model files in the `models/Stable-diffusion/` folder
2. Restart AUTOMATIC1111 or refresh the models list in the web interface
3. Use the exact model name (without file extension) in the provider

## Additional Resources

- [AUTOMATIC1111 Documentation](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [AUTOMATIC1111 Models](https://civitai.com/models)
- [AUTOMATIC1111 HuggingFace](https://huggingface.co/models?other=automatic1111)
- [Vercel AI SDK](https://ai-sdk.dev/)
