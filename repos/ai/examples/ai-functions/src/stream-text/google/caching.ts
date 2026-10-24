import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

run(async () => {
  const result1 = streamText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
  });

  await result1.consumeStream();

  const providerMetadata1 = await result1.providerMetadata;
  console.log(providerMetadata1?.google);

  // e.g.
  // {
  //   groundingMetadata: null,
  //   safetyRatings: null,
  //   usageMetadata: {
  //     thoughtsTokenCount: 1336,
  //     promptTokenCount: 2152,
  //     candidatesTokenCount: 992,
  //     totalTokenCount: 4480
  //   }
  // }

  const result2 = streamText({
    model: google('gemini-2.5-flash'),
    prompt: errorMessage,
  });

  await result2.consumeStream();

  const providerMetadata2 = await result2.providerMetadata;
  console.log(providerMetadata2?.google);

  // e.g.
  // {
  //   groundingMetadata: null,
  //   safetyRatings: null,
  //   usageMetadata: {
  //     cachedContentTokenCount: 2027,
  //     thoughtsTokenCount: 908,
  //     promptTokenCount: 2152,
  //     candidatesTokenCount: 667,
  //     totalTokenCount: 3727
  //   }
  // }
});
