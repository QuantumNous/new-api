---
title: AssemblyAI
description: Learn how to use the AssemblyAI provider for the AI SDK.
---

# AssemblyAI Provider

The [AssemblyAI](https://assemblyai.com/) provider contains transcription model support for the AssemblyAI transcription API.

## Setup

The AssemblyAI provider is available in the `@ai-sdk/assemblyai` module. You can install it with

<InstallPackages packages="@ai-sdk/assemblyai" />

## Provider Instance

You can import the default provider instance `assemblyai` from `@ai-sdk/assemblyai`:

```ts
import { assemblyai } from '@ai-sdk/assemblyai';
```

If you need a customized setup, you can import `createAssemblyAI` from `@ai-sdk/assemblyai` and create a provider instance with your settings:

```ts
import { createAssemblyAI } from '@ai-sdk/assemblyai';

const assemblyai = createAssemblyAI({
  // custom settings, e.g.
  fetch: customFetch,
});
```

You can use the following optional settings to customize the AssemblyAI provider instance:

- **apiKey** _string_

  API key that is being sent using the `Authorization` header.
  It defaults to the `ASSEMBLYAI_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.
  Defaults to the global `fetch` function.
  You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.

## Transcription Models

You can create models that call the [AssemblyAI transcription API](https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file/typescript)
using the `.transcription()` factory method.

The first argument is the model id, e.g. `universal-3-5-pro`.

```ts
const model = assemblyai.transcription('universal-3-5-pro');
```

The `best` model is a **deprecated** legacy model, sent using AssemblyAI's
deprecated `speech_model` request parameter. It still works, but using it emits a
deprecation warning — prefer `universal-3-5-pro`. The older `nano` model has been
removed by AssemblyAI and is no longer available. All newer models are sent using
the [`speech_models`](https://www.assemblyai.com/docs/pre-recorded-audio/select-the-speech-model)
request parameter, which the provider selects automatically based on the model id.

`universal-3-pro` and `universal-2` are fully supported and continue to work, but
using them emits an informational warning (not a deprecation) suggesting
`universal-3-5-pro`, AssemblyAI's latest flagship model.

You can also pass additional provider-specific options using the `providerOptions` argument. For example, supplying the `contentSafety` option will enable content safety filtering.

```ts highlight="7"
import { transcribe } from 'ai';
import { assemblyai } from '@ai-sdk/assemblyai';
import { type AssemblyAITranscriptionModelOptions } from '@ai-sdk/assemblyai';
import { readFile } from 'fs/promises';

const result = await transcribe({
  model: assemblyai.transcription('universal-3-5-pro'),
  audio: await readFile('audio.mp3'),
  providerOptions: {
    assemblyai: {
      contentSafety: true,
    } satisfies AssemblyAITranscriptionModelOptions,
  },
});
```

The following provider options are available:

- **audioEndAt** _number_

  End time of the audio in milliseconds.
  Optional.

- **audioStartFrom** _number_

  Start time of the audio in milliseconds.
  Optional.

- **autoChapters** _boolean_

  Whether to automatically generate chapters for the transcription.
  Optional.

- **autoHighlights** _boolean_

  Whether to automatically generate highlights for the transcription.
  Optional.

- **boostParam** _enum_

  Boost parameter for `wordBoost`.
  Allowed values: `'low'`, `'default'`, `'high'`.
  **Deprecated** — only applies to the deprecated `wordBoost`; use `keytermsPrompt` instead.
  Optional.

- **contentSafety** _boolean_

  Whether to enable content safety filtering.
  Optional.

- **contentSafetyConfidence** _number_

  Confidence threshold for content safety filtering (25-100).
  Optional.

- **customSpelling** _array of objects_

  Custom spelling rules for the transcription.
  Each object has `from` (array of strings) and `to` (string) properties.
  Optional.

- **disfluencies** _boolean_

  Whether to include disfluencies (um, uh, etc.) in the transcription.
  Optional.

- **domain** _string_

  Enable a domain-specific model for specialized terminology.
  Currently supports `'medical-v1'` (Medical Mode).
  Optional.

- **entityDetection** _boolean_

  Whether to detect entities in the transcription.
  Optional.

- **filterProfanity** _boolean_

  Whether to filter profanity in the transcription.
  Optional.

- **formatText** _boolean_

  Whether to format the text in the transcription.
  Optional.

- **iabCategories** _boolean_

  Whether to include IAB categories in the transcription.
  Optional.

- **keytermsPrompt** _array of strings_

  Domain-specific keyterms to boost recognition for (max 6 words per phrase).
  Replaces `wordBoost` for newer models — supported by `universal-3-pro`,
  `universal-3-5-pro`, and `slam-1` (and `universal-2` when enabled).
  Optional.

- **languageCode** _string_

  Language code for the audio.
  Supports numerous ISO-639-1 and ISO-639-3 language codes.
  Optional.

- **languageConfidenceThreshold** _number_

  Confidence threshold for language detection.
  Optional.

- **languageDetection** _boolean_

  Whether to enable language detection.
  Optional.

- **languageDetectionOptions** _object_

  Options for automatic language detection: `expectedLanguages` (array of
  strings), `fallbackLanguage` (string), `codeSwitching` (boolean),
  `codeSwitchingConfidenceThreshold` (number, 0-1).
  Optional.

- **multichannel** _boolean_

  Whether to process multiple audio channels separately.
  Optional.

- **prompt** _string_

  Natural-language context (up to 1,500 words) to steer the model.
  Only supported by `universal-3-pro`, `universal-3-5-pro`, and `slam-1`.
  Optional.

- **punctuate** _boolean_

  Whether to add punctuation to the transcription.
  Optional.

- **redactPii** _boolean_

  Whether to redact personally identifiable information.
  Optional.

- **redactPiiAudio** _boolean_

  Whether to redact PII in the audio file.
  Optional.

- **redactPiiAudioOptions** _object_

  Options for PII-redacted audio: `returnRedactedNoSpeechAudio` (boolean),
  `overrideAudioRedactionMethod` (`'silence'`). Requires `redactPiiAudio`.
  Optional.

- **redactPiiAudioQuality** _enum_

  Quality of the redacted audio file.
  Allowed values: `'mp3'`, `'wav'`.
  Optional.

- **redactPiiPolicies** _array of enums_

  Policies for PII redaction, specifying which types of information to redact.
  Supports numerous types like `'person_name'`, `'phone_number'`, etc.
  Optional.

- **redactPiiReturnUnredacted** _boolean_

  Return the original unredacted transcript alongside the redacted one.
  Requires `redactPii`.
  Optional.

- **redactPiiSub** _enum_

  Substitution method for redacted PII.
  Allowed values: `'entity_name'`, `'hash'`.
  Optional.

- **redactStaticEntities** _object_

  Map of user-defined labels to exact terms to redact, e.g.
  `{ INTERNAL_TOOL: ['Bearclaw'] }`. Applied on top of standard PII redaction.
  Requires `redactPii`.
  Optional.

- **removeAudioTags** _enum_

  Remove inline annotations from rich transcripts.
  Allowed values: `'all'` (all annotations), `'speaker'` (speaker cues only).
  Universal-3 Pro models.
  Optional.

- **sentimentAnalysis** _boolean_

  Whether to perform sentiment analysis on the transcription.
  Optional.

- **speakerLabels** _boolean_

  Whether to label different speakers in the transcription.
  Optional.

- **speakerOptions** _object_

  Options for speaker diarization: `minSpeakersExpected` (number),
  `maxSpeakersExpected` (number).
  Optional.

- **speakersExpected** _number_

  Expected number of speakers in the audio.
  Optional.

- **speechThreshold** _number_

  Threshold for speech detection (0-1).
  Optional.

- **summarization** _boolean_

  Whether to generate a summary of the transcription.
  Optional.

- **summaryModel** _enum_

  Model to use for summarization.
  Allowed values: `'informative'`, `'conversational'`, `'catchy'`.
  Optional.

- **summaryType** _enum_

  Type of summary to generate.
  Allowed values: `'bullets'`, `'bullets_verbose'`, `'gist'`, `'headline'`, `'paragraph'`.
  Optional.

- **temperature** _number_

  Sampling temperature (0-1) controlling randomness.
  Universal-3 Pro models.
  Optional.

- **webhookAuthHeaderName** _string_

  Name of the authentication header for webhook requests.
  Optional.

- **webhookAuthHeaderValue** _string_

  Value of the authentication header for webhook requests.
  Optional.

- **webhookUrl** _string_

  URL to send webhook notifications to.
  Optional.

- **wordBoost** _array of strings_

  List of words to boost in the transcription.
  **Deprecated** — rejected by `universal-3-pro`, `universal-3-5-pro`, and `slam-1`
  (works only on `universal-2`/`best`); use `keytermsPrompt` instead.
  Optional.

### Speaker diarization and audio-intelligence results

The AI SDK's `transcribe` result exposes `text`, `segments`, `language`, and
`durationInSeconds`. AssemblyAI's richer results — speaker diarization and
audio-intelligence features — don't fit that shape, so they are surfaced in two
places:

- **`providerMetadata.assemblyai`** — structured results for the features you
  enabled: `utterances` (speaker-diarized segments, when `speakerLabels` is set),
  `entities`, `sentimentAnalysisResults`, `contentSafetyLabels`,
  `iabCategoriesResult`, and `autoHighlightsResult`.
- **`response.body`** — the complete, raw AssemblyAI transcript response, so any
  field not surfaced above (e.g. `chapters`, word-level `speaker` labels) is
  still available.

Note: timings inside `providerMetadata` and `response.body` (e.g.
`utterances[].start`) are in **milliseconds**, matching the AssemblyAI API —
whereas the top-level `segments` use **seconds**.

```ts
import { transcribe } from 'ai';
import { assemblyai } from '@ai-sdk/assemblyai';
import { readFile } from 'fs/promises';

const result = await transcribe({
  model: assemblyai.transcription('universal-3-5-pro'),
  audio: await readFile('audio.mp3'),
  providerOptions: {
    assemblyai: {
      speakerLabels: true,
      entityDetection: true,
    },
  },
});

const { utterances, entities } = result.providerMetadata?.assemblyai ?? {};
// utterances: [{ speaker: 'A', text: '…', start, end, … }, …]  (start/end in ms)
```

The following AssemblyAI features are **deprecated** by the API and not surfaced
in `providerMetadata` (their output remains on the raw `response.body` if
enabled): Summarization, Auto Chapters, and Custom Topics. Note also that some
features are language-gated (e.g. sentiment analysis is English-centric); see
AssemblyAI's documentation for per-language availability.

### Model Capabilities

| Model               | Transcription | Duration  | Segments  | Language  |
| ------------------- | ------------- | --------- | --------- | --------- |
| `universal-3-5-pro` | <Check />     | <Check /> | <Check /> | <Check /> |
| `universal-3-pro`   | <Check />     | <Check /> | <Check /> | <Check /> |
| `universal-2`       | <Check />     | <Check /> | <Check /> | <Check /> |
| `best`              | <Check />     | <Check /> | <Check /> | <Check /> |
