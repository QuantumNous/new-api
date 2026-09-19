import type { Experimental_TranscriptionModelV4StreamPart } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';
import {
  parseTranscriptionStreamClientFrame,
  parseTranscriptionStreamPart,
  serializeTranscriptionStreamPart,
  TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE,
  TRANSCRIPTION_STREAM_START_FRAME_TYPE,
} from './transcription-stream-envelope';

describe('frame type constants', () => {
  it('should use the transcription-stream namespace', () => {
    expect(TRANSCRIPTION_STREAM_START_FRAME_TYPE).toBe(
      'transcription-stream.start',
    );
    expect(TRANSCRIPTION_STREAM_AUDIO_DONE_FRAME_TYPE).toBe(
      'transcription-stream.audio-done',
    );
  });
});

describe('parseTranscriptionStreamClientFrame', () => {
  it('should parse a minimal start frame', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm' },
        }),
      ),
    ).toEqual({
      type: 'start',
      frame: {
        type: 'transcription-stream.start',
        inputAudioFormat: { type: 'audio/pcm' },
      },
    });
  });

  it('should parse a full start frame', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
          providerOptions: { openai: { language: 'en' } },
          includeRawChunks: true,
        }),
      ),
    ).toEqual({
      type: 'start',
      frame: {
        type: 'transcription-stream.start',
        inputAudioFormat: { type: 'audio/pcm', rate: 16000 },
        providerOptions: { openai: { language: 'en' } },
        includeRawChunks: true,
      },
    });
  });

  it('should not restrict the audio format type', () => {
    const result = parseTranscriptionStreamClientFrame(
      JSON.stringify({
        type: 'transcription-stream.start',
        inputAudioFormat: { type: 'audio/some-future-format' },
      }),
    );
    expect(result.type).toBe('start');
  });

  it('should parse an audio-done frame', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({ type: 'transcription-stream.audio-done' }),
      ),
    ).toEqual({ type: 'audio-done' });
  });

  it('should classify unrecognized frame types as unknown', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({ type: 'transcription-stream.some-future-frame' }),
      ),
    ).toEqual({ type: 'unknown' });
  });

  it('should classify malformed JSON as invalid', () => {
    expect(parseTranscriptionStreamClientFrame('{not json')).toEqual({
      type: 'invalid',
      message: 'malformed JSON',
    });
  });

  it('should classify a prototype-pollution start frame as invalid', () => {
    // Raw JSON text: a `__proto__` key in an object literal would set the
    // prototype rather than serialize as a key, so it must be literal text.
    const frame =
      '{"type":"transcription-stream.start","inputAudioFormat":{"type":"audio/pcm"},"__proto__":{"polluted":true}}';

    expect(parseTranscriptionStreamClientFrame(frame)).toEqual({
      type: 'invalid',
      message: 'malformed JSON',
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should classify a constructor.prototype-pollution start frame as invalid', () => {
    const frame =
      '{"type":"transcription-stream.start","inputAudioFormat":{"type":"audio/pcm"},"constructor":{"prototype":{"polluted":true}}}';

    expect(parseTranscriptionStreamClientFrame(frame).type).toBe('invalid');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([['"a string"'], ['[1, 2]'], ['null'], ['42']])(
    'should classify non-object JSON as invalid: %s',
    text => {
      expect(parseTranscriptionStreamClientFrame(text).type).toBe('invalid');
    },
  );

  it('should classify a missing frame type as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(JSON.stringify({ foo: 'bar' })),
    ).toEqual({
      type: 'invalid',
      message: 'frame type must be a string',
    });
  });

  it('should classify a start frame without inputAudioFormat as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({ type: 'transcription-stream.start' }),
      ).type,
    ).toBe('invalid');
  });

  it('should classify a start frame with a non-string format type as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 42 },
        }),
      ).type,
    ).toBe('invalid');
  });

  it('should classify a start frame with a non-number rate as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm', rate: '16000' },
        }),
      ).type,
    ).toBe('invalid');
  });

  it('should classify a start frame with non-object providerOptions as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm' },
          providerOptions: 'nope',
        }),
      ).type,
    ).toBe('invalid');
  });

  it('should classify a start frame with non-boolean includeRawChunks as invalid', () => {
    expect(
      parseTranscriptionStreamClientFrame(
        JSON.stringify({
          type: 'transcription-stream.start',
          inputAudioFormat: { type: 'audio/pcm' },
          includeRawChunks: 'yes',
        }),
      ).type,
    ).toBe('invalid');
  });
});

describe('serializeTranscriptionStreamPart', () => {
  it('should serialize parts as JSON', () => {
    expect(
      serializeTranscriptionStreamPart({
        type: 'transcript-delta',
        id: 'seg-1',
        delta: 'Hel',
      }),
    ).toBe('{"type":"transcript-delta","id":"seg-1","delta":"Hel"}');
  });

  it('should serialize response-metadata timestamps as ISO strings', () => {
    expect(
      serializeTranscriptionStreamPart({
        type: 'response-metadata',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        modelId: 'openai/gpt-realtime-whisper',
      }),
    ).toBe(
      '{"type":"response-metadata","timestamp":"2026-01-01T00:00:00.000Z","modelId":"openai/gpt-realtime-whisper"}',
    );
  });

  it('should serialize Error payloads in error parts with their name and message', () => {
    // `Error` properties are non-enumerable, so a plain JSON.stringify would
    // serialize the payload to `{}` and lose the message end-to-end.
    expect(
      serializeTranscriptionStreamPart({
        type: 'error',
        error: new Error('rate limited'),
      }),
    ).toBe(
      '{"type":"error","error":{"name":"Error","message":"rate limited"}}',
    );
  });

  it('should round-trip an error part with an Error payload', () => {
    expect(
      parseTranscriptionStreamPart(
        serializeTranscriptionStreamPart({
          type: 'error',
          error: new TypeError('bad input'),
        }) ?? '',
      ),
    ).toEqual({
      type: 'error',
      error: { name: 'TypeError', message: 'bad input' },
    });
  });

  it('should serialize cross-realm Error payloads with their name and message', () => {
    // `instanceof Error` fails across realms; the brand check catches it.
    const crossRealmError = {
      [Symbol.toStringTag]: 'Error',
      name: 'Error',
      message: 'remote failure',
    };
    expect(
      serializeTranscriptionStreamPart({
        type: 'error',
        error: crossRealmError,
      }),
    ).toBe(
      '{"type":"error","error":{"name":"Error","message":"remote failure"}}',
    );
  });

  it.each<[string, unknown]>([
    ['a bigint payload', { big: BigInt(1) }],
    [
      'a cyclic payload',
      (() => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        return cyclic;
      })(),
    ],
  ])(
    'should return undefined for parts carrying %s (envelope rule 4)',
    (_name, rawValue) => {
      expect(
        serializeTranscriptionStreamPart({
          type: 'raw',
          rawValue,
        }),
      ).toBeUndefined();
    },
  );
});

describe('parseTranscriptionStreamPart', () => {
  it.each<Experimental_TranscriptionModelV4StreamPart>([
    { type: 'stream-start', warnings: [] },
    { type: 'transcript-delta', id: 'seg-1', delta: 'Hel' },
    { type: 'transcript-partial', id: 'seg-1', text: 'Hel' },
    { type: 'transcript-final', id: 'seg-1', text: 'Hello' },
    { type: 'raw', rawValue: { some: 'chunk' } },
    { type: 'error', error: 'model overloaded' },
    {
      type: 'finish',
      text: 'Hello',
      segments: [{ text: 'Hello', startSecond: 0, endSecond: 1 }],
      language: 'en',
    },
  ])('should round-trip a $type part', part => {
    expect(
      parseTranscriptionStreamPart(
        serializeTranscriptionStreamPart(part) ?? '',
      ),
    ).toEqual(part);
  });

  it('should revive response-metadata timestamps to Date', () => {
    const part = parseTranscriptionStreamPart(
      serializeTranscriptionStreamPart({
        type: 'response-metadata',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        modelId: 'openai/gpt-realtime-whisper',
      }) ?? '',
    );

    expect(part).toEqual({
      type: 'response-metadata',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      modelId: 'openai/gpt-realtime-whisper',
    });
    expect(part?.type === 'response-metadata' && part.timestamp).toBeInstanceOf(
      Date,
    );
  });

  it('should keep a missing response-metadata timestamp undefined', () => {
    expect(
      parseTranscriptionStreamPart(
        JSON.stringify({ type: 'response-metadata', modelId: 'model-1' }),
      ),
    ).toEqual({
      type: 'response-metadata',
      timestamp: undefined,
      modelId: 'model-1',
    });
  });

  it('should return undefined for malformed JSON', () => {
    expect(parseTranscriptionStreamPart('{not json')).toBeUndefined();
  });

  it('should return undefined for prototype-pollution payloads', () => {
    const part =
      '{"type":"transcript-delta","id":"seg-1","delta":"Hel","__proto__":{"polluted":true}}';

    expect(parseTranscriptionStreamPart(part)).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([['"a string"'], ['[1, 2]'], ['null'], ['42']])(
    'should return undefined for non-object JSON: %s',
    text => {
      expect(parseTranscriptionStreamPart(text)).toBeUndefined();
    },
  );

  it('should return undefined for unknown part types (forward compat)', () => {
    expect(
      parseTranscriptionStreamPart(
        JSON.stringify({ type: 'some-future-part' }),
      ),
    ).toBeUndefined();
  });

  // Known-type frames with a malformed shape (e.g. from a drifted server
  // version) are rejected rather than passed through: downstream SDK code
  // dereferences the required fields and would otherwise fail with an opaque
  // TypeError mid-stream.
  it.each<[string, Record<string, unknown>]>([
    ['stream-start without warnings', { type: 'stream-start' }],
    [
      'stream-start with non-array warnings',
      { type: 'stream-start', warnings: 'none' },
    ],
    ['transcript-delta without delta', { type: 'transcript-delta', id: 's1' }],
    [
      'transcript-delta with non-string delta',
      { type: 'transcript-delta', delta: 42 },
    ],
    ['transcript-partial without text', { type: 'transcript-partial' }],
    [
      'transcript-partial with non-string text',
      { type: 'transcript-partial', text: 42 },
    ],
    ['transcript-final without text', { type: 'transcript-final' }],
    ['finish without text', { type: 'finish', segments: [] }],
    ['finish without segments', { type: 'finish', text: 'Hello' }],
    [
      'finish with non-array segments',
      { type: 'finish', text: 'Hello', segments: {} },
    ],
    [
      'response-metadata with a non-string timestamp',
      { type: 'response-metadata', timestamp: {} },
    ],
    [
      'response-metadata with an unparsable timestamp',
      { type: 'response-metadata', timestamp: 'not-a-date' },
    ],
    [
      'stream-start with null warning elements',
      { type: 'stream-start', warnings: [null] },
    ],
    [
      'stream-start with non-object warning elements',
      { type: 'stream-start', warnings: ['unsupported'] },
    ],
    [
      'finish with null segment elements',
      { type: 'finish', text: 'Hello', segments: [null] },
    ],
    ['raw without rawValue', { type: 'raw' }],
    ['error without error', { type: 'error' }],
    [
      'stream-start with warning elements missing a type',
      { type: 'stream-start', warnings: [{ message: 'no type' }] },
    ],
    [
      'stream-start with non-string warning types',
      { type: 'stream-start', warnings: [{ type: 42 }] },
    ],
    [
      'transcript-delta with a numeric id',
      { type: 'transcript-delta', delta: 'Hel', id: 42 },
    ],
    [
      'transcript-partial with a non-numeric startSecond',
      { type: 'transcript-partial', text: 'Hel', startSecond: 'zero' },
    ],
    [
      'transcript-final with a numeric id',
      { type: 'transcript-final', text: 'Hello', id: 7 },
    ],
    [
      'transcript-final with a non-numeric endSecond',
      { type: 'transcript-final', text: 'Hello', endSecond: 'one' },
    ],
    [
      'finish with incomplete segment elements',
      { type: 'finish', text: 'Hello', segments: [{}] },
    ],
    [
      'finish with mistyped segment timings',
      {
        type: 'finish',
        text: 'Hello',
        segments: [{ text: 'Hello', startSecond: 'zero', endSecond: 1 }],
      },
    ],
    [
      'finish with a non-string language',
      { type: 'finish', text: 'Hello', segments: [], language: 42 },
    ],
    [
      'finish with a non-numeric durationInSeconds',
      { type: 'finish', text: 'Hello', segments: [], durationInSeconds: '7' },
    ],
    [
      'response-metadata with a non-string modelId',
      { type: 'response-metadata', modelId: 42 },
    ],
  ])('should return undefined for %s', (_name, part) => {
    expect(parseTranscriptionStreamPart(JSON.stringify(part))).toBeUndefined();
  });
});
