import { streamText, simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { run } from '../lib/run';

const generateLongContent = (tokens: number, includeTools = false) => {
  const chunks: LanguageModelV3StreamPart[] = [
    { type: 'text-start', id: 'text-1' },
  ];

  // Generate many token chunks to simulate a long response
  for (let i = 0; i < tokens; i++) {
    chunks.push({
      type: 'text-delta',
      id: 'text-1',
      delta: `Token${i} `,
    });
  }

  chunks.push({ type: 'text-end', id: 'text-1' });

  // Add tool-related chunks if requested
  if (includeTools) {
    // Add tool call chunks
    chunks.push(
      {
        type: 'tool-input-start',
        id: 'tool-call-1',
        toolName: 'getWeather',
      },
      {
        type: 'tool-input-delta',
        id: 'tool-call-1',
        delta: '{"location": "',
      },
      {
        type: 'tool-input-delta',
        id: 'tool-call-1',
        delta: 'San Francisco',
      },
      {
        type: 'tool-input-delta',
        id: 'tool-call-1',
        delta: '"}',
      },
      {
        type: 'tool-input-end',
        id: 'tool-call-1',
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-call-1',
        toolName: 'getWeather',
        input: '{"location": "San Francisco"}',
      },
      {
        type: 'tool-result',
        toolCallId: 'tool-call-1',
        toolName: 'getWeather',
        result: {
          type: 'text',
          value: 'Sunny, 72°F',
        },
      },
    );
  }

  chunks.push({
    type: 'finish',
    finishReason: { raw: undefined, unified: 'stop' },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: tokens,
        text: tokens,
        reasoning: undefined,
      },
    },
  });

  return chunks;
};

// Calculate approximate bytes for throughput measurement
// Reuses the generateLongContent function to avoid duplication
const calculateTotalBytes = (tokens: number, includeTools = false) => {
  const chunks = generateLongContent(tokens, includeTools);
  let totalBytes = 0;

  for (const chunk of chunks) {
    totalBytes += JSON.stringify(chunk).length;
  }

  return totalBytes;
};

async function benchmarkSingleStream() {
  const tokenCount = 10000;
  const chunks = generateLongContent(tokenCount);
  const totalBytes = calculateTotalBytes(tokenCount);

  const model = new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: null, // No delay
        chunkDelayInMs: null, // No delay between chunks
      }),
    }),
  });

  const startTime = performance.now();

  const result = streamText({
    model,
    prompt: 'Test prompt',
  });

  await result.consumeStream();

  const endTime = performance.now();
  const duration = endTime - startTime;
  const tokensPerSecond = (tokenCount / duration) * 1000;
  const megabytesPerSecond = totalBytes / (1024 * 1024) / (duration / 1000);

  console.log(`Single stream benchmark results:`);
  console.log(`  Duration: ${duration.toFixed(2)}ms`);
  console.log(`  Tokens: ${tokenCount.toLocaleString()}`);
  console.log(`  Total data: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`  Throughput: ${tokensPerSecond.toFixed(0)} tokens/second`);
  console.log(`  Throughput: ${megabytesPerSecond.toFixed(2)} MB/s`);
}

async function benchmarkConcurrentStreams() {
  const tokensPerStream = 1000;
  const streamCount = 100;
  const chunks = generateLongContent(tokensPerStream);
  const bytesPerStream = calculateTotalBytes(tokensPerStream);
  const totalBytes = bytesPerStream * streamCount;
  const totalTokens = tokensPerStream * streamCount;

  const model = new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: null, // No delay
        chunkDelayInMs: null, // No delay between chunks
      }),
    }),
  });

  const startTime = performance.now();

  const streams = [];
  for (let i = 0; i < streamCount; i++) {
    const result = streamText({
      model,
      prompt: `Test prompt ${i}`,
    });
    streams.push(result);
  }

  await Promise.all(streams.map(stream => stream.consumeStream()));

  const endTime = performance.now();
  const duration = endTime - startTime;
  const tokensPerSecond = (totalTokens / duration) * 1000;
  const megabytesPerSecond = totalBytes / (1024 * 1024) / (duration / 1000);

  console.log(`\nConcurrent streams benchmark results:`);
  console.log(`  Duration: ${duration.toFixed(2)}ms`);
  console.log(`  Streams: ${streamCount}`);
  console.log(`  Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`  Total data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Throughput: ${tokensPerSecond.toFixed(0)} tokens/second`);
  console.log(`  Throughput: ${megabytesPerSecond.toFixed(2)} MB/s`);
  console.log(`  Average per stream: ${(duration / streamCount).toFixed(2)}ms`);
}

async function benchmarkStreamWithToolCalls() {
  const tokenCount = 5000;
  const includeTools = true;
  const chunks = generateLongContent(tokenCount, includeTools);
  const totalBytes = calculateTotalBytes(tokenCount, includeTools);

  const model = new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks,
        initialDelayInMs: null, // No delay
        chunkDelayInMs: null, // No delay between chunks
      }),
    }),
  });

  const startTime = performance.now();

  const result = streamText({
    model,
    prompt: 'Test prompt with tools',
  });

  await result.consumeStream();

  const endTime = performance.now();
  const duration = endTime - startTime;
  const tokensPerSecond = (tokenCount / duration) * 1000;
  const megabytesPerSecond = totalBytes / (1024 * 1024) / (duration / 1000);

  console.log(`\nStream with tool calls benchmark results:`);
  console.log(`  Duration: ${duration.toFixed(2)}ms`);
  console.log(`  Tokens: ${tokenCount.toLocaleString()}`);
  console.log(`  Total data: ${(totalBytes / 1024).toFixed(2)} KB`);
  console.log(`  Throughput: ${tokensPerSecond.toFixed(0)} tokens/second`);
  console.log(`  Throughput: ${megabytesPerSecond.toFixed(2)} MB/s`);
  console.log(
    `  Tool chunks: 7 (input-start, 3x input-delta, input-end, tool-call, tool-result)`,
  );
}

run(async () => {
  console.log('Running streamText benchmarks...\n');

  await benchmarkSingleStream();
  await benchmarkConcurrentStreams();
  await benchmarkStreamWithToolCalls();

  console.log('\nBenchmark complete!');
});
