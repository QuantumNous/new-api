// @ts-nocheck
import {
  streamText,
  convertToModelMessages,
  appendClientMessage,
  appendResponseMessages,
  StreamData,
} from 'ai';
import { openai } from '@ai-sdk/openai';

/* FIXME(@ai-sdk-upgrade-v5): The `appendClientMessage` option has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#message-persistence-changes */
const updatedMessages = appendClientMessage({
  messages,
  message: lastUserMessage,
});

const result = streamText({
  model: openai('gpt-4o'),
  messages: updatedMessages,
  experimental_generateMessageId: () => generateId(), // ID generation on streamText
  onFinish: async ({ responseMessages, usage }) => {
    // Use helper functions to format messages
    /* FIXME(@ai-sdk-upgrade-v5): The `appendResponseMessages` option has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#message-persistence-changes */
    const finalMessages = appendResponseMessages({
      messages: updatedMessages,
      responseMessages,
    });

    // Save formatted messages to database
    await saveMessages(finalMessages);
  },
});

message.parts.map(part => {
  if (part.type === 'tool-invocation') {
    /* FIXME(@ai-sdk-upgrade-v5): The `part.toolInvocation.toolName` property has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
    return part.toolInvocation.toolName;
  }
});

message.parts.map(part => {
  if (part.type === 'tool-invocation') {
    /* FIXME(@ai-sdk-upgrade-v5): The `part.toolInvocation.state` property has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#tool-part-type-changes-uimessage */
    switch (part.toolInvocation.state) {
    case 'partial-call':
      return 'Loading...';
    case 'call':
      return `Tool called with ${JSON.stringify(part.toolInvocation.args)}`;
    case 'result':
      return `Result: ${part.toolInvocation.result}`;
    }
  }
});

/* FIXME(@ai-sdk-upgrade-v5): The `StreamData` type has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#stream-data-removal */
const streamData = new StreamData();
streamData.append('custom-data');
streamData.close();

/* FIXME(@ai-sdk-upgrade-v5): The `experimental_attachments` property has been replaced with the parts array. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#attachments--file-parts */
messages.map(message =>
  message.experimental_attachments?.map((attachment, index) =>
    attachment.contentType?.includes('image/')
      ? 'image'
      : attachment.contentType?.includes('text/')
        ? 'text'
        : null,
  ),
);
