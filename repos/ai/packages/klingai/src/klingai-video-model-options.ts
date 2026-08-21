import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Provider-specific options for KlingAI video generation.
 *
 * Not all options are supported by every model version and video mode (T2V, I2V,
 * motion control). See the KlingAI capability map for detailed compatibility:
 * https://app.klingai.com/global/dev/document-api/apiReference/model/skillsMap
 */
export type KlingAIVideoModelOptions = {
  /**
   * Video generation mode.
   *
   * - `'std'`: Standard mode — cost-effective.
   * - `'pro'`: Professional mode — higher quality but longer generation time.
   */
  mode?: 'std' | 'pro' | null;

  /**
   * Polling interval in milliseconds for checking task status.
   * Default: 5000 (5 seconds).
   */
  pollIntervalMs?: number | null;

  /**
   * Maximum time in milliseconds to wait for video generation.
   * Default: 600000 (10 minutes).
   */
  pollTimeoutMs?: number | null;

  // --- T2V and I2V options ---

  /**
   * Negative text prompt to specify what to avoid.
   * Cannot exceed 2500 characters.
   */
  negativePrompt?: string | null;

  /**
   * Whether to generate sound simultaneously when generating videos.
   * Only V2.6 and subsequent versions support this parameter,
   * and requires `mode: 'pro'`.
   */
  sound?: 'on' | 'off' | null;

  /**
   * Flexibility in video generation. The higher the value, the lower the
   * model's flexibility, and the stronger the relevance to the user's prompt.
   * Value range: [0, 1]. Kling-v2.x models do not support this parameter.
   */
  cfgScale?: number | null;

  /**
   * Camera movement control. If not specified, the model will intelligently
   * match based on the input text/images.
   */
  cameraControl?: {
    type:
      | 'simple'
      | 'down_back'
      | 'forward_up'
      | 'right_turn_forward'
      | 'left_turn_forward';
    config?: {
      horizontal?: number | null;
      vertical?: number | null;
      pan?: number | null;
      tilt?: number | null;
      roll?: number | null;
      zoom?: number | null;
    } | null;
  } | null;

  // --- I2V-specific options ---

  /**
   * End frame image for I2V start+end frame control.
   * Supports image URL or raw base64-encoded image data.
   * Requires `mode: 'pro'` for most models.
   */
  imageTail?: string | null;

  /**
   * Static brush mask image for I2V motion brush.
   * Supports image URL or raw base64-encoded image data.
   */
  staticMask?: string | null;

  /**
   * Dynamic brush configurations for I2V motion brush.
   * Up to 6 groups, each with a mask and motion trajectories.
   */
  dynamicMasks?: Array<{
    mask: string;
    trajectories: Array<{ x: number; y: number }>;
  }> | null;

  // --- v3.0 multi-shot options (T2V and I2V) ---

  /**
   * Enable multi-shot video generation (Kling v3.0+).
   * When true, the video is split into up to 6 storyboard shots
   * with individual prompts and durations.
   *
   * When multiShot is true with shotType 'customize', multiPrompt is required.
   * When multiShot is true, the main prompt parameter is ignored by the API.
   */
  multiShot?: boolean | null;

  /**
   * Storyboard method for multi-shot video generation (Kling v3.0+).
   * Required when multiShot is true.
   *
   * - `'customize'`: User-defined shots via multiPrompt.
   * - `'intelligence'`: Model auto-segments based on the main prompt.
   */
  shotType?: 'customize' | 'intelligence' | null;

  /**
   * Per-shot details for multi-shot video generation (Kling v3.0+).
   * Required when multiShot is true and shotType is 'customize'.
   *
   * Up to 6 shots. Each shot has an index, prompt (max 512 chars),
   * and duration in seconds. Shot durations must sum to the total duration.
   */
  multiPrompt?: Array<{
    index: number;
    prompt: string;
    duration: string;
  }> | null;

  // --- v3.0 element control (I2V and Motion Control) ---

  /**
   * Reference elements for element control (Kling v3.0+).
   * Supports video character elements and multi-image elements.
   *
   * - I2V: Up to 3 reference elements. Cannot coexist with voiceList.
   * - Motion Control: Currently only 1 element supported.
   *   When referencing an element, the generated video can only
   *   refer to the orientation of the person in the video.
   */
  elementList?: Array<{
    element_id: number;
  }> | null;

  // --- v3.0 voice control (T2V and I2V) ---

  /**
   * Voice references for voice control (Kling v3.0+).
   * Up to 2 voice references. Referenced via `<<<voice_1>>>` template
   * syntax in the prompt.
   *
   * When voiceList is used and the prompt references voice IDs,
   * sound must be set to 'on'.
   * Cannot coexist with elementList on the I2V endpoint.
   */
  voiceList?: Array<{
    voice_id: string;
  }> | null;

  // --- Shared options ---

  /**
   * Whether to generate watermarked results simultaneously.
   */
  watermarkEnabled?: boolean | null;

  // --- Motion-control-specific options ---

  /**
   * URL of the reference video. The character actions in the generated video
   * are consistent with the reference video.
   *
   * Supports .mp4/.mov, max 100MB, side lengths 340px–3850px,
   * duration 3–30 seconds (depends on `characterOrientation`).
   */
  videoUrl?: string | null;

  /**
   * Orientation of the characters in the generated video.
   *
   * - `'image'`: Same orientation as the person in the image.
   *   Reference video duration max 10 seconds.
   * - `'video'`: Same orientation as the person in the video.
   *   Reference video duration max 30 seconds.
   */
  characterOrientation?: 'image' | 'video' | null;

  /**
   * Whether to keep the original sound of the reference video.
   * Default: `'yes'`.
   */
  keepOriginalSound?: 'yes' | 'no' | null;

  [key: string]: unknown; // For passthrough
};

export const klingaiVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z.looseObject({
      mode: z.enum(['std', 'pro']).nullish(),
      pollIntervalMs: z.number().positive().nullish(),
      pollTimeoutMs: z.number().positive().nullish(),
      // T2V and I2V
      negativePrompt: z.string().nullish(),
      sound: z.enum(['on', 'off']).nullish(),
      cfgScale: z.number().nullish(),
      cameraControl: z
        .object({
          type: z.enum([
            'simple',
            'down_back',
            'forward_up',
            'right_turn_forward',
            'left_turn_forward',
          ]),
          config: z
            .object({
              horizontal: z.number().nullish(),
              vertical: z.number().nullish(),
              pan: z.number().nullish(),
              tilt: z.number().nullish(),
              roll: z.number().nullish(),
              zoom: z.number().nullish(),
            })
            .nullish(),
        })
        .nullish(),
      // v3.0 multi-shot
      multiShot: z.boolean().nullish(),
      shotType: z.enum(['customize', 'intelligence']).nullish(),
      multiPrompt: z
        .array(
          z.object({
            index: z.number(),
            prompt: z.string(),
            duration: z.string(),
          }),
        )
        .nullish(),
      // v3.0 element control (I2V)
      elementList: z
        .array(
          z.object({
            element_id: z.number(),
          }),
        )
        .nullish(),
      // v3.0 voice control
      voiceList: z
        .array(
          z.object({
            voice_id: z.string(),
          }),
        )
        .nullish(),
      // I2V-specific
      imageTail: z.string().nullish(),
      staticMask: z.string().nullish(),
      dynamicMasks: z
        .array(
          z.object({
            mask: z.string(),
            trajectories: z.array(z.object({ x: z.number(), y: z.number() })),
          }),
        )
        .nullish(),
      // Motion-control-specific
      videoUrl: z.string().nullish(),
      characterOrientation: z.enum(['image', 'video']).nullish(),
      keepOriginalSound: z.enum(['yes', 'no']).nullish(),
      watermarkEnabled: z.boolean().nullish(),
    }),
  ),
);
