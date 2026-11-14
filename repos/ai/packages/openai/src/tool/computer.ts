import {
  createProviderDefinedToolFactoryWithOutputSchema,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const safetyCheckSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  message: z.string().optional(),
});

const computerActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('click'),
    button: z.enum(['left', 'right', 'wheel', 'back', 'forward']),
    x: z.number(),
    y: z.number(),
    keys: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('double_click'),
    x: z.number(),
    y: z.number(),
    keys: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('drag'),
    path: z.array(z.object({ x: z.number(), y: z.number() })),
    keys: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('keypress'),
    keys: z.array(z.string()),
  }),
  z.object({
    type: z.literal('move'),
    x: z.number(),
    y: z.number(),
    keys: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('screenshot'),
  }),
  z.object({
    type: z.literal('scroll'),
    x: z.number(),
    y: z.number(),
    scrollX: z.number(),
    scrollY: z.number(),
    keys: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('type'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('wait'),
  }),
]);

export const computerInputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      actions: z.array(computerActionSchema),
      pendingSafetyChecks: z.array(safetyCheckSchema),
      status: z.enum(['in_progress', 'completed', 'incomplete']),
    }),
  ),
);

export const computerOutputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      output: z.union([
        z.object({
          type: z.literal('computer_screenshot'),
          imageUrl: z.string(),
          fileId: z.string().optional(),
          detail: z.enum(['auto', 'low', 'high', 'original']).optional(),
        }),
        z.object({
          type: z.literal('computer_screenshot'),
          fileId: z.string(),
          imageUrl: z.string().optional(),
          detail: z.enum(['auto', 'low', 'high', 'original']).optional(),
        }),
      ]),
      acknowledgedSafetyChecks: z.array(safetyCheckSchema).optional(),
    }),
  ),
);

export type OpenAIComputerAction = z.infer<typeof computerActionSchema>;
export type OpenAIComputerSafetyCheck = z.infer<typeof safetyCheckSchema>;

const computerToolFactory = createProviderDefinedToolFactoryWithOutputSchema<
  {
    /**
     * Ordered UI actions to execute.
     */
    actions: OpenAIComputerAction[];

    /**
     * Safety checks that must be acknowledged before continuing.
     */
    pendingSafetyChecks: OpenAIComputerSafetyCheck[];

    /**
     * Status of the computer call.
     */
    status: 'in_progress' | 'completed' | 'incomplete';
  },
  {
    /**
     * The screenshot captured after executing all actions.
     */
    output:
      | {
          type: 'computer_screenshot';
          imageUrl: string;
          fileId?: string;
          detail?: 'auto' | 'low' | 'high' | 'original';
        }
      | {
          type: 'computer_screenshot';
          fileId: string;
          imageUrl?: string;
          detail?: 'auto' | 'low' | 'high' | 'original';
        };

    /**
     * Safety checks that the application has reviewed and acknowledged.
     */
    acknowledgedSafetyChecks?: OpenAIComputerSafetyCheck[];
  },
  {}
>({
  id: 'openai.computer',
  inputSchema: computerInputSchema,
  outputSchema: computerOutputSchema,
});

export const computer = (
  options: Parameters<typeof computerToolFactory>[0] = {},
) => computerToolFactory(options);
