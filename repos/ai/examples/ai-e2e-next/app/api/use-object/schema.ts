import type { DeepPartial } from 'ai';
import { z } from 'zod';

// define a schema for the notifications
export const notificationSchema = z.object({
  notifications: z.array(
    z.object({
      name: z.string().describe('Name of a fictional person.'),
      message: z.string().describe('Message. Do not use emojis or links.'),
      minutesAgo: z.number(),
    }),
  ),
});

// define a type for the partial notifications during generation
export type PartialNotification = DeepPartial<typeof notificationSchema>;
