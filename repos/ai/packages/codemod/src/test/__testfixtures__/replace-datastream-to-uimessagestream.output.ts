// @ts-nocheck
import {
  createUIMessageStreamResponse,
  createUIMessageStream,
  UIMessageStreamWriter,
} from 'ai';

async function handler() {
  const stream = await createUIMessageStream();
  const writer: UIMessageStreamWriter = stream.writer;

  const response = await createUIMessageStreamResponse({
    stream,
  });

  return response;
}

export type MyWriter = UIMessageStreamWriter;

class StreamHandler {
  private stream;
  private writer: UIMessageStreamWriter;

  constructor() {
    this.stream = createUIMessageStream();
    this.writer = this.stream.writer;
  }

  async respond() {
    return createUIMessageStreamResponse(this.stream);
  }
}