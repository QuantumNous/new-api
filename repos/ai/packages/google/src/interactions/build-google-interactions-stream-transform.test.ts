import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from '@ai-sdk/provider-utils/test';
import type { ParseResult } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { buildGoogleInteractionsStreamTransform } from './build-google-interactions-stream-transform';
import type { GoogleInteractionsEvent } from './google-interactions-api';

function runTransform(events: Array<GoogleInteractionsEvent>) {
  const transform = buildGoogleInteractionsStreamTransform({
    warnings: [],
    generateId: () => 'test-id',
  });
  const input = convertArrayToReadableStream(
    events.map(value => ({ success: true, value, rawValue: value })),
  ) as ReadableStream<ParseResult<GoogleInteractionsEvent>>;
  return convertReadableStreamToArray(input.pipeThrough(transform));
}

describe('buildGoogleInteractionsStreamTransform — video deltas', () => {
  it('emits a file stream part for a video delta carrying inline data', async () => {
    const parts = await runTransform([
      {
        event_type: 'interaction.created',
        interaction: { id: 'v1_video-stream', status: 'in_progress' },
      },
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'model_output' },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: {
          type: 'video',
          data: 'AAAAIGZ0eXBpc29t',
          mime_type: 'video/mp4',
        },
      },
      {
        event_type: 'step.stop',
        index: 0,
      },
      {
        event_type: 'interaction.completed',
        interaction: { id: 'v1_video-stream', status: 'completed' },
      },
    ] as Array<GoogleInteractionsEvent>);

    const fileParts = parts.filter(p => p.type === 'file');
    expect(fileParts).toEqual([
      expect.objectContaining({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'data', data: 'AAAAIGZ0eXBpc29t' },
      }),
    ]);
  });

  it('emits a file stream part for a video delta carrying a uri', async () => {
    const parts = await runTransform([
      {
        event_type: 'interaction.created',
        interaction: { id: 'v1_video-stream', status: 'in_progress' },
      },
      {
        event_type: 'step.start',
        index: 0,
        step: { type: 'model_output' },
      },
      {
        event_type: 'step.delta',
        index: 0,
        delta: { type: 'video', uri: 'https://example.test/clip.mp4' },
      },
      {
        event_type: 'step.stop',
        index: 0,
      },
      {
        event_type: 'interaction.completed',
        interaction: { id: 'v1_video-stream', status: 'completed' },
      },
    ] as Array<GoogleInteractionsEvent>);

    const fileParts = parts.filter(p => p.type === 'file');
    expect(fileParts).toEqual([
      expect.objectContaining({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'url', url: new URL('https://example.test/clip.mp4') },
      }),
    ]);
  });
});

describe('buildGoogleInteractionsStreamTransform — usage modality', () => {
  it('surfaces output_tokens_by_modality on the finish part providerMetadata', async () => {
    const parts = await runTransform([
      {
        event_type: 'interaction.created',
        interaction: { id: 'v1_usage', status: 'in_progress' },
      },
      {
        event_type: 'interaction.completed',
        interaction: {
          id: 'v1_usage',
          status: 'completed',
          usage: {
            total_output_tokens: 57939,
            output_tokens_by_modality: [
              { modality: 'video', tokens: 57920 },
              { modality: 'text', tokens: 19 },
            ],
          },
        },
      },
    ] as Array<GoogleInteractionsEvent>);

    const finish = parts.find(p => p.type === 'finish');
    expect(finish?.providerMetadata?.google?.outputTokensByModality).toEqual({
      video: 57920,
      text: 19,
    });
  });
});
