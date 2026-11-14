// @ts-nocheck
import { vertex } from '@ai-sdk/google-vertex';
import { generateText, streamText } from 'ai';

// Case 1: Direct providerMetadata access with optional chaining
const result1 = await generateText({
  model: vertex('gemini-2.5-flash'),
  prompt: 'Hello',
});
console.log(result1.providerMetadata?.vertex?.safetyRatings);
console.log(result1.providerMetadata?.vertex?.groundingMetadata);
console.log(result1.providerMetadata?.vertex?.urlContextMetadata);
console.log(result1.providerMetadata?.vertex?.promptFeedback);
console.log(result1.providerMetadata?.vertex?.usageMetadata);

// Case 2: Non-optional access
const metadata = result1.providerMetadata.vertex;
const ratings = result1.providerMetadata.vertex.safetyRatings;

// Case 3: Destructuring from providerMetadata
const { vertex } = result1.providerMetadata ?? {};
const { vertex: vertexMeta } = result1.providerMetadata ?? {};

// Case 4: providerOptions input
const result2 = await generateText({
  model: vertex('gemini-2.5-flash'),
  providerOptions: {
    vertex: {
      safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_LOW_AND_ABOVE',
        },
      ],
    },
  },
  prompt: 'Hello',
});

// Case 5: Streaming with finish event
const { stream } = await streamText({
  model: vertex('gemini-2.5-flash'),
  prompt: 'Hello',
});

for await (const event of stream) {
  if (event.type === 'finish') {
    console.log(event.providerMetadata?.vertex?.safetyRatings);
  }
}

// Case 6: Content parts with thoughtSignature
const result3 = await generateText({
  model: vertex('gemini-2.5-flash'),
  prompt: 'Think step by step',
});

for (const part of result3.content) {
  if (part.providerMetadata?.vertex?.thoughtSignature) {
    console.log(part.providerMetadata.vertex.thoughtSignature);
  }
}

// Case 7: Variable assignment
const providerMetadata = result1.providerMetadata;
const googleMeta = providerMetadata?.vertex;

// Case 8: Function that accesses providerMetadata
function logSafetyRatings(result: any) {
  return result.providerMetadata?.vertex?.safetyRatings;
}

// Case 9: Nested providerOptions in larger config
const config = {
  model: vertex('gemini-2.5-flash'),
  providerOptions: {
    vertex: {
      thinkingConfig: {
        thinkingBudget: 1024,
      },
    },
  },
};
