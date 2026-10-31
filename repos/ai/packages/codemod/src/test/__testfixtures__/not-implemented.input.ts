// @ts-nocheck
import {
  streamText,
  convertToModelMessages,
  appendClientMessage,
  appendResponseMessages,
  StreamData,
} from 'ai';
import { openai } from '@ai-sdk/openai';

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
    return part.toolInvocation.toolName;
  }
});

message.parts.map(part => {
  if (part.type === 'tool-invocation') {
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

const streamData = new StreamData();
streamData.append('custom-data');
streamData.close();

messages.map(message =>
  message.experimental_attachments?.map((attachment, index) =>
    attachment.contentType?.includes('image/')
      ? 'image'
      : attachment.contentType?.includes('text/')
        ? 'text'
        : null,
  ),
);
