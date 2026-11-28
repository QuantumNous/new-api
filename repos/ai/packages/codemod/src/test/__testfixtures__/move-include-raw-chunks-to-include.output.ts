import { streamText } from 'ai';

declare const model: any;

streamText({
  model,
  prompt: 'Hello',

  include: {
    rawChunks: true
  }
});
