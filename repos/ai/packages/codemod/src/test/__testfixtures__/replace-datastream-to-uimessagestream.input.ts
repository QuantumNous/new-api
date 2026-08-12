// @ts-nocheck
import {
  createDataStreamResponse,
  createDataStream,
  DataStreamWriter,
} from 'ai';

async function handler() {
  const stream = await createDataStream();
  const writer: DataStreamWriter = stream.writer;

  const response = await createDataStreamResponse({
    stream,
  });

  return response;
}

export type MyWriter = DataStreamWriter;

class StreamHandler {
  private stream;
  private writer: DataStreamWriter;

  constructor() {
    this.stream = createDataStream();
    this.writer = this.stream.writer;
  }

  async respond() {
    return createDataStreamResponse(this.stream);
  }
}