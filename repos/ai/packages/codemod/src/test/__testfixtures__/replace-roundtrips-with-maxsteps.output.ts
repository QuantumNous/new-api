// @ts-nocheck
import { generateText, streamText } from 'ai';

// Test generateText with both roundtrip types
await generateText({
  model,
  maxSteps: 3
});

// Test streamText with just maxToolRoundtrips
streamText({
  model,
  maxSteps: 6
});

// Test streamText with subsequent maxToolRoundtrips
streamText({
  model,
  maxSteps: 68
});

// Test streamText with no roundtrips
streamText({
  model
});

// Test generateText with just maxAutomaticRoundtrips
await generateText({
  model,
  maxSteps: 5
});

// Test generateText with subsequent maxToolRoundtrips
await generateText({
  model,
  maxSteps: 43
});

// Test generateText with no roundtrips
await generateText({
  model
});

// Test property access
const result = await generateText({ model });
console.log(result.steps.length);
