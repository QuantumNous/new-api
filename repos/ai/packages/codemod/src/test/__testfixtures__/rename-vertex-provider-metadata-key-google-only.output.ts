// @ts-nocheck
// This file uses @ai-sdk/google (NOT vertex) - should NOT be transformed
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const result = await generateText({
  model: google('gemini-2.5-flash'),
  providerOptions: {
    google: {
      safetySettings: [],
    },
  },
  prompt: 'Hello',
});

// These should stay as 'google' since we're using @ai-sdk/google
console.log(result.providerMetadata?.google?.safetyRatings);
const { google: metadata } = result.providerMetadata ?? {};

