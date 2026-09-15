import { toUIMessageStream } from '@ai-sdk/langchain';
import { AIMessageChunk } from '@langchain/core/messages';
import { createUIMessageStream } from 'ai';

const langchainStream = new ReadableStream<AIMessageChunk>({
  start(controller) {
    controller.enqueue(
      new AIMessageChunk({
        id: 'langchain-message',
        content: 'Hello from LangChain',
      }),
    );
    controller.close();
  },
});

const stream = createUIMessageStream({
  async execute({ writer }) {
    // This composed stream owns the outer message lifecycle.
    writer.write({ type: 'start' });

    const reader = toUIMessageStream(langchainStream, {
      sendStart: false,
      sendFinish: false,
    }).getReader();

    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      writer.write(chunk);
    }

    writer.write({ type: 'finish' });
  },
});

const reader = stream.getReader();
while (true) {
  const { done, value: chunk } = await reader.read();
  if (done) break;
  console.log(JSON.stringify(chunk));
}

process.exit(0);
