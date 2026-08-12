import { z } from 'zod';

export const notificationSchema = z.object({
  notifications: z.array(
    z.object({
      name: z.string().describe('Name of a fictional person.'),
      message: z.string().describe('Message. Do not use emojis or links.'),
      minutesAgo: z.number(),
    }),
  ),
});
