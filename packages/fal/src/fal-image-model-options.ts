import {
  lazySchema,
  zodSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const falImageModelOptionsSchema = lazySchema(() =>
  zodSchema(
    z
      .looseObject({
        /** @deprecated use prompt.images instead */
        imageUrl: z.string().nullish().meta({
          deprecated: true,
          description: 'Use `prompt.images` instead',
        }),
        maskUrl: z
          .string()
          .nullish()
          .meta({ deprecated: true, description: 'Use `prompt.mask` instead' }),
        guidanceScale: z.number().min(1).max(20).nullish(),
        numInferenceSteps: z.number().min(1).max(50).nullish(),
        enableSafetyChecker: z.boolean().nullish(),
        outputFormat: z.enum(['jpeg', 'png']).nullish(),
        syncMode: z.boolean().nullish(),
        strength: z.number().nullish(),
        acceleration: z.enum(['none', 'regular', 'high']).nullish(),
        safetyTolerance: z
          .enum(['1', '2', '3', '4', '5', '6'])
          .or(z.number().min(1).max(6))
          .nullish(),
        /**
         * When true, converts multiple input images to `image_urls` array instead of `image_url` string.
         */
        useMultipleImages: z.boolean().nullish(),

        // Deprecated snake_case versions
        image_url: z.string().nullish(),
        mask_url: z.string().nullish(),
        guidance_scale: z.number().min(1).max(20).nullish(),
        num_inference_steps: z.number().min(1).max(50).nullish(),
        enable_safety_checker: z.boolean().nullish(),
        output_format: z.enum(['jpeg', 'png']).nullish(),
        sync_mode: z.boolean().nullish(),
        safety_tolerance: z
          .enum(['1', '2', '3', '4', '5', '6'])
          .or(z.number().min(1).max(6))
          .nullish(),
      })
      .transform(data => {
        const result: Record<string, unknown> = {};
        const deprecatedKeys: string[] = [];

        const mapKey = (snakeKey: string, camelKey: string) => {
          const snakeValue = data[snakeKey as keyof typeof data];
          const camelValue = data[camelKey as keyof typeof data];

          // If snake_case is used, mark it as deprecated
          if (snakeValue !== undefined && snakeValue !== null) {
            deprecatedKeys.push(snakeKey);
            result[camelKey] = snakeValue;
          } else if (camelValue !== undefined && camelValue !== null) {
            result[camelKey] = camelValue;
          }
        };

        // Map all known parameters
        mapKey('image_url', 'imageUrl');
        mapKey('mask_url', 'maskUrl');
        mapKey('guidance_scale', 'guidanceScale');
        mapKey('num_inference_steps', 'numInferenceSteps');
        mapKey('enable_safety_checker', 'enableSafetyChecker');
        mapKey('output_format', 'outputFormat');
        mapKey('sync_mode', 'syncMode');
        mapKey('safety_tolerance', 'safetyTolerance');

        // These don't have snake_case equivalents
        if (data.strength !== undefined && data.strength !== null) {
          result.strength = data.strength;
        }
        if (data.acceleration !== undefined && data.acceleration !== null) {
          result.acceleration = data.acceleration;
        }
        if (
          data.useMultipleImages !== undefined &&
          data.useMultipleImages !== null
        ) {
          result.useMultipleImages = data.useMultipleImages;
        }

        for (const [key, value] of Object.entries(data)) {
          if (
            ![
              // camelCase known keys
              'imageUrl',
              'maskUrl',
              'guidanceScale',
              'numInferenceSteps',
              'enableSafetyChecker',
              'outputFormat',
              'syncMode',
              'strength',
              'acceleration',
              'safetyTolerance',
              'useMultipleImages',
              // snake_case known keys
              'image_url',
              'mask_url',
              'guidance_scale',
              'num_inference_steps',
              'enable_safety_checker',
              'output_format',
              'sync_mode',
              'safety_tolerance',
            ].includes(key)
          ) {
            result[key] = value;
          }
        }

        if (deprecatedKeys.length > 0) {
          (result as any).__deprecatedKeys = deprecatedKeys;
        }

        return result;
      }),
  ),
);

export type FalImageModelOptions = InferSchema<
  typeof falImageModelOptionsSchema
>;
