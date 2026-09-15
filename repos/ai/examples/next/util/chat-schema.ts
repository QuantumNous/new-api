import type { UIDataTypes, UIMessage } from 'ai';
import { z } from 'zod';

export const myMessageMetadataSchema = z.object({
  createdAt: z.number(),
});

export type MyMessageMetadata = z.infer<typeof myMessageMetadataSchema>;

export type MyUIMessage = UIMessage<MyMessageMetadata, UIDataTypes>;

export type ChatData = {
  id: string;
  messages: MyUIMessage[];
  createdAt: number;
  activeStreamId: string | null;
  canceledAt: number | null;
};
