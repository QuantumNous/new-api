---
title: Rev.ai
description: Learn how to use the Rev.ai provider for the AI SDK.
---

# Rev.ai Provider

The [Rev.ai](https://www.rev.ai/) provider contains language model support for the Rev.ai transcription API.

## Setup

The Rev.ai provider is available in the `@ai-sdk/revai` module. You can install it with

<InstallPackages packages="@ai-sdk/revai" />

## Provider Instance

You can import the default provider instance `revai` from `@ai-sdk/revai`:

```ts
import { revai } from '@ai-sdk/revai';
```

If you need a customized setup, you can import `createRevai` from `@ai-sdk/revai` and create a provider instance with your settings:

```ts
import { createRevai } from '@ai-sdk/revai';

const revai = createRevai({
  // custom settings, e.g.
  fetch: customFetch,
});
```

You can use the following optional settings to customize the Rev.ai provider instance:

- **apiKey** _string_

  API key that is being sent using the `Authorization` header.
  It defaults to the `REVAI_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.
  Defaults to the global `fetch` function.
  You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.

## Transcription Models

You can create models that call the [Rev.ai transcription API](https://www.rev.ai/docs/api/transcription)
using the `.transcription()` factory method.

The first argument is the model id e.g. `machine`.

```ts
const model = revai.transcription('machine');
```

You can also pass additional provider-specific options using the `providerOptions` argument. For example, supplying the input language in ISO-639-1 (e.g. `en`) format can sometimes improve transcription performance if known beforehand.

```ts highlight="7"
import { transcribe } from 'ai';
import { revai } from '@ai-sdk/revai';
import { type RevaiTranscriptionModelOptions } from '@ai-sdk/revai';
import { readFile } from 'fs/promises';

const result = await transcribe({
  model: revai.transcription('machine'),
  audio: await readFile('audio.mp3'),
  providerOptions: {
    revai: { language: 'en' } satisfies RevaiTranscriptionModelOptions,
  },
});
```

The following provider options are available:

- **metadata** _string_

  Optional metadata string to associate with the transcription job.

- **notification_config** _object_

  Configuration for webhook notifications when job is complete.
  - **url** _string_ - URL to send the notification to.
  - **auth_headers** _object_ - Optional authorization headers for the notification request.
    - **Authorization** _string_ - Authorization header value.

- **delete_after_seconds** _integer_

  Number of seconds after which the job will be automatically deleted.

- **verbatim** _boolean_

  Whether to include filler words and false starts in the transcription.

- **rush** _boolean_

  [HIPAA Unsupported] Whether to prioritize the job for faster processing. Only available for human transcriber option.

- **test_mode** _boolean_

  Whether to run the job in test mode. Default is `false`.

- **segments_to_transcribe** _Array_

  Specific segments of the audio to transcribe.
  - **start** _number_ - Start time of the segment in seconds.
  - **end** _number_ - End time of the segment in seconds.

- **speaker_names** _Array_

  Names to assign to speakers in the transcription.
  - **display_name** _string_ - Display name for the speaker.

- **skip_diarization** _boolean_

  Whether to skip speaker diarization. Default is `false`.

- **skip_postprocessing** _boolean_

  Whether to skip post-processing steps. Only available for English and Spanish languages. Default is `false`.

- **skip_punctuation** _boolean_

  Whether to skip adding punctuation to the transcription. Default is `false`.

- **remove_disfluencies** _boolean_

  Whether to remove disfluencies (um, uh, etc.) from the transcription. Default is `false`.

- **remove_atmospherics** _boolean_

  Whether to remove atmospheric sounds (like `<laugh>`, `<affirmative>`) from the transcription. Default is `false`.

- **filter_profanity** _boolean_

  Whether to filter profanity from the transcription by replacing characters with asterisks except for the first and last. Default is `false`.

- **speaker_channels_count** _integer_

  Number of speaker channels in the audio. Only available for English, Spanish and French languages.

- **speakers_count** _integer_

  Expected number of speakers in the audio. Only available for English, Spanish and French languages.

- **diarization_type** _string_

  Type of diarization to use. Possible values: "standard" (default), "premium".

- **custom_vocabulary_id** _string_

  ID of a custom vocabulary to use for the transcription, submitted through the Custom Vocabularies API.

- **custom_vocabularies** _Array_

  Custom vocabularies to use for the transcription.

- **strict_custom_vocabulary** _boolean_

  Whether to strictly enforce custom vocabulary.

- **summarization_config** _object_

  Configuration for generating a summary of the transcription.
  - **model** _string_ - Model to use for summarization. Possible values: "standard" (default), "premium".
  - **type** _string_ - Format of the summary. Possible values: "paragraph" (default), "bullets".
  - **prompt** _string_ - Custom prompt for the summarization (mutually exclusive with type).

- **translation_config** _object_

  Configuration for translating the transcription.
  - **target_languages** _Array_ - Target languages for translation. Each item is an object with:
    - **language** _string_ - Language code. Possible values: "en", "en-us", "en-gb", "ar", "pt", "pt-br", "pt-pt", "fr", "fr-ca", "es", "es-es", "es-la", "it", "ja", "ko", "de", "ru".
  - **model** _string_ - Model to use for translation. Possible values: "standard" (default), "premium".

- **language** _string_

  Language of the audio content, provided as an ISO 639-1 language code. Default is "en".

- **forced_alignment** _boolean_

  Whether to perform forced alignment, which provides improved accuracy for per-word timestamps.
  Default is `false`.

  Currently supported languages:
  - English (en, en-us, en-gb)
  - French (fr)
  - Italian (it)
  - German (de)
  - Spanish (es)

  Note: This option is not available in low-cost environments.

### Model Capabilities

| Model      | Transcription | Duration  | Segments  | Language  |
| ---------- | ------------- | --------- | --------- | --------- |
| `machine`  | <Check />     | <Check /> | <Check /> | <Check /> |
| `low_cost` | <Check />     | <Check /> | <Check /> | <Check /> |
| `fusion`   | <Check />     | <Check /> | <Check /> | <Check /> |
