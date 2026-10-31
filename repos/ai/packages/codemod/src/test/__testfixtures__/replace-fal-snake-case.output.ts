// @ts-nocheck
import { fal } from '@ai-sdk/fal';
import { generateImage } from 'ai';

// Test 1: Basic snake_case conversion
const result1 = await generateImage({
  model: fal.image('fal-ai/flux/dev'),
  prompt: 'A cute baby sea otter',
  providerOptions: {
    fal: {
      guidanceScale: 7.5,
      numInferenceSteps: 28,
      enableSafetyChecker: true,
    },
  },
});

// Test 2: Image-to-image with image_url
const result2 = await generateImage({
  model: fal.image('fal-ai/flux/dev/image-to-image'),
  prompt: 'Transform this',
  providerOptions: {
    fal: {
      imageUrl: 'https://example.com/image.png',
      guidanceScale: 7.5,
      numInferenceSteps: 50,
    },
  },
});

// Test 3: Mixed snake_case options
const result3 = await generateImage({
  model: fal.image('fal-ai/flux/dev'),
  prompt: 'Abstract art',
  providerOptions: {
    fal: {
      outputFormat: 'png',
      syncMode: true,
      safetyTolerance: 5,
    },
  },
});

// Test 4: Already camelCase (should not change)
const result4 = await generateImage({
  model: fal.image('fal-ai/flux/dev'),
  prompt: 'Landscape',
  providerOptions: {
    fal: {
      guidanceScale: 7.0,
      numInferenceSteps: 20,
    },
  },
});

// Test 5: Nested objects
const config = {
  providerOptions: {
    fal: {
      guidanceScale: 8.0,
      enableSafetyChecker: false,
    },
  },
};
