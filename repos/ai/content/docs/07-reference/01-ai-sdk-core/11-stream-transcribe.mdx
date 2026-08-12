---
title: experimental_streamTranscribe
description: API Reference for experimental_streamTranscribe.
---

# `experimental_streamTranscribe()`

<Note type="warning">
  `experimental_streamTranscribe` is an experimental feature.
</Note>

Streams a transcript from live raw audio using a transcription model with
streaming support.

```ts
import { experimental_streamTranscribe as streamTranscribe } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = streamTranscribe({
  model: openai.transcription('gpt-realtime-whisper'),
  audio: audioStream, // ReadableStream<Uint8Array | string>
  inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
});

for await (const part of result.fullStream) {
  if (part.type === 'transcript-delta') {
    process.stdout.write(part.delta);
  }
}

console.log(await result.text);
```

## Import

<Snippet
  text={`import { experimental_streamTranscribe as streamTranscribe } from "ai"`}
  prompt={false}
/>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'model',
      type: 'TranscriptionModelV4',
      description:
        "The transcription model to use. The model must support streaming (`doStream`). String model IDs resolve through the global provider (AI Gateway by default), which supports streaming transcription for supported models (e.g. `openai/gpt-realtime-whisper`, `xai/grok-stt`): `experimental_streamTranscribe({ model: 'openai/gpt-realtime-whisper', ... })`.",
    },
    {
      name: 'audio',
      type: 'ReadableStream<Uint8Array | string>',
      description:
        'Raw audio chunks to transcribe. `Uint8Array` chunks contain raw audio bytes; `string` chunks contain base64-encoded raw audio bytes.',
    },
    {
      name: 'inputAudioFormat',
      type: '{ type: string; rate?: number }',
      description:
        'The input audio format for the raw audio chunks, e.g. `{ type: "audio/pcm", rate: 24000 }`. Supported types are provider-specific (e.g. `audio/pcm`, `audio/pcmu`, `audio/pcma`).',
    },
    {
      name: 'providerOptions',
      type: 'Record<string, JSONObject>',
      isOptional: true,
      description: 'Additional provider-specific options.',
    },
    {
      name: 'abortSignal',
      type: 'AbortSignal',
      isOptional: true,
      description: 'An optional abort signal to cancel the call.',
    },
    {
      name: 'headers',
      type: 'Record<string, string>',
      isOptional: true,
      description:
        'Additional HTTP/WebSocket headers, if supported by the provider.',
    },
    {
      name: 'includeRawChunks',
      type: 'boolean',
      isOptional: true,
      description:
        'When true, the provider includes raw provider chunks in the stream as `raw` parts.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'fullStream',
      type: 'AsyncIterableStream<TranscriptionStreamPart>',
      description:
        'A single-consumer live stream of transcription parts: `transcript-delta`, `transcript-partial`, `transcript-final`, `raw`, and `error`. Access it once, before any result promise, when both stream parts and final results are needed. Accessing a result promise first consumes the stream internally and makes `fullStream` unavailable.',
    },
    {
      name: 'text',
      type: 'Promise<string>',
      description: 'The complete transcribed text from the audio input.',
    },
    {
      name: 'segments',
      type: 'Promise<Array<{ text: string; startSecond: number; endSecond: number }>>',
      description:
        'Final transcript segments with timing information, if available.',
    },
    {
      name: 'language',
      type: 'Promise<string | undefined>',
      description:
        'The language of the transcript in ISO-639-1 format, if available.',
    },
    {
      name: 'durationInSeconds',
      type: 'Promise<number | undefined>',
      description: 'The duration of the transcript in seconds, if available.',
    },
    {
      name: 'warnings',
      type: 'Promise<Warning[]>',
      description:
        'Warnings for the call, e.g. unsupported settings. Resolves when the provider emits the stream start.',
    },
    {
      name: 'responses',
      type: 'Promise<Array<TranscriptionModelResponseMetadata>>',
      description: 'Response metadata (timestamp, model ID, headers).',
    },
    {
      name: 'providerMetadata',
      type: 'Promise<Record<string, JSONObject>>',
      description: 'Additional provider-specific metadata.',
    },
  ]}
/>

<Note>
  The result promises settle as the stream is consumed. If you stop consuming
  `fullStream` early (e.g. `break` out of the loop), the underlying provider
  connection is closed and pending result promises reject.
</Note>

## Wire format (experimental)

Streaming transcription over WebSocket is serialized with the experimental
transcription-stream envelope defined in `@ai-sdk/provider-utils`
(`experimental_parseTranscriptionStreamClientFrame`,
`experimental_serializeTranscriptionStreamPart`,
`experimental_parseTranscriptionStreamPart`): the client sends one
`transcription-stream.start` TEXT frame, audio as BINARY frames, and a
`transcription-stream.audio-done` TEXT frame; each server TEXT frame is one
JSON-serialized transcription stream part. AI Gateway implements the server
side of this envelope.
