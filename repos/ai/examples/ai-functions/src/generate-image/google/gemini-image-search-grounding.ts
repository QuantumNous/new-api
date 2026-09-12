import {
  google,
  type GoogleImageModelOptions,
  type GoogleProviderMetadata,
} from '@ai-sdk/google';
import { generateImage } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

/*
 * `generateText` enables Google Search grounding for the same model via the
 * top-level `tools` parameter (see
 * ../../generate-text/google/image-search.ts). `generateImage` intentionally
 * does not accept tools, so the Google provider exposes the same capability
 * through `providerOptions.google.googleSearch`, which is forwarded to a
 * `google.tools.googleSearch(...)` tool on the underlying language-model call.
 *
 * The value shape matches the args of `google.tools.googleSearch` — passing
 * `{}` enables Google Search with defaults, the same as the generateText path.
 */

run(async () => {
  const result = await generateImage({
    model: google.image('gemini-3.1-flash-image-preview'),
    prompt:
      'Search for live footage photos of the 2026 Super Bowl halftime show artist. I want an image with a close-up of them during the show, but in space.',
    aspectRatio: '16:9',
    providerOptions: {
      google: {
        googleSearch: { searchTypes: { imageSearch: {} } },
      } satisfies GoogleImageModelOptions,
    },
  });

  await presentImages(result.images);

  console.log();
  console.log('TOKEN USAGE');
  console.log(result.usage);

  const metadata = result.providerMetadata?.google as unknown as
    | GoogleProviderMetadata
    | undefined;

  console.log();
  console.log('GROUNDING METADATA');
  console.log(metadata?.groundingMetadata ?? '(none)');

  console.log();
  console.log('WARNINGS');
  console.log(result.warnings);
});
