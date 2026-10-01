'use server';

import { openai } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { notificationSchema, type PartialNotification } from './schema';
export async function generateNotifications(context: string) {
  const notificationsStream = createStreamableValue<PartialNotification>();

  const result = streamText({
    model: openai('gpt-5-mini'),
    prompt: `Generate 3 notifications for a messages app in this context: ${context}`,
    output: Output.object({ schema: notificationSchema }),
  });

  try {
    for await (const partialOutput of result.partialOutputStream) {
      notificationsStream.update(partialOutput);
    }
  } finally {
    notificationsStream.done();
  }

  return notificationsStream.value;
}
