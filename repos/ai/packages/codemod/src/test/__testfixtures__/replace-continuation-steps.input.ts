// @ts-nocheck
import { generateText } from 'ai';
import { generateText as genText } from 'ai';
import { generateText as otherGen } from 'other-pkg';

// Should rename - direct import
const result = await generateText({
  model,
  prompt: 'Hello',
  experimental_continuationSteps: true
});

// Should rename - aliased import
await genText({
  experimental_continuationSteps: false
});

// Should NOT rename - different package
await otherGen({
  experimental_continuationSteps: true
});

// Should NOT rename - not in generateText call
const config = {
  experimental_continuationSteps: true
};
