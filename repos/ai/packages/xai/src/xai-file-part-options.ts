import { z } from 'zod/v4';

// provider options for file parts (images) in user messages
export const xaiFilePartProviderOptions = z.object({
  /**
   * Controls the resolution at which the model processes the image.
   * `low` processes the image at reduced resolution and consumes fewer
   * input tokens, `high` processes the image at full resolution, and
   * `auto` lets the API decide. Defaults to full resolution when not set.
   *
   * Note: the xAI API silently ignores invalid values, so the value is
   * validated client-side.
   *
   * @see https://docs.x.ai/developers/model-capabilities/images/understanding
   */
  imageDetail: z.enum(['low', 'high', 'auto']).optional(),
});

export type XaiFilePartProviderOptions = z.infer<
  typeof xaiFilePartProviderOptions
>;
