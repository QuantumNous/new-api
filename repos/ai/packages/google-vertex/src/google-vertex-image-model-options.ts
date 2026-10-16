import { z } from 'zod/v4';

export const googleVertexImageModelOptionsSchema = z.object({
  negativePrompt: z.string().nullish(),
  personGeneration: z
    .enum(['dont_allow', 'allow_adult', 'allow_all'])
    .nullish(),
  safetySetting: z
    .enum([
      'block_low_and_above',
      'block_medium_and_above',
      'block_only_high',
      'block_none',
    ])
    .nullish(),
  addWatermark: z.boolean().nullish(),
  storageUri: z.string().nullish(),
  sampleImageSize: z.enum(['1K', '2K']).nullish(),
  /**
   * Configuration for image editing operations
   */
  edit: z
    .object({
      /**
       * An integer that represents the number of sampling steps.
       * A higher value offers better image quality, a lower value offers better latency.
       * Try 35 steps to start. If the quality doesn't meet your requirements,
       * increase the value towards an upper limit of 75.
       */
      baseSteps: z.number().nullish(),

      // Edit mode options
      // https://cloud.google.com/vertex-ai/generative-ai/docs/image/edit-insert-objects
      mode: z
        .enum([
          'EDIT_MODE_INPAINT_INSERTION',
          'EDIT_MODE_INPAINT_REMOVAL',
          'EDIT_MODE_OUTPAINT',
          'EDIT_MODE_CONTROLLED_EDITING',
          'EDIT_MODE_PRODUCT_IMAGE',
          'EDIT_MODE_BGSWAP',
        ])
        .nullish(),

      /**
       * The mask mode to use.
       * - `MASK_MODE_DEFAULT` - Default value for mask mode.
       * - `MASK_MODE_USER_PROVIDED` - User provided mask. No segmentation needed.
       * - `MASK_MODE_DETECTION_BOX` - Mask from detected bounding boxes.
       * - `MASK_MODE_CLOTHING_AREA` - Masks from segmenting the clothing area with open-vocab segmentation.
       * - `MASK_MODE_PARSED_PERSON` - Masks from segmenting the person body and clothing using the person-parsing model.
       */
      maskMode: z
        .enum([
          'MASK_MODE_DEFAULT',
          'MASK_MODE_USER_PROVIDED',
          'MASK_MODE_DETECTION_BOX',
          'MASK_MODE_CLOTHING_AREA',
          'MASK_MODE_PARSED_PERSON',
        ])
        .nullish(),

      /**
       * Optional. A float value between 0 and 1, inclusive, that represents the
       * percentage of the image width to grow the mask by. Using dilation helps
       * compensate for imprecise masks. We recommend a value of 0.01.
       */
      maskDilation: z.number().nullish(),
    })
    .nullish(),
});
export type GoogleVertexImageModelOptions = z.infer<
  typeof googleVertexImageModelOptionsSchema
>;
