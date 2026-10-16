# @ai-sdk/prodia

## 2.0.12

### Patch Changes

- Updated dependencies [cd06458]
  - @ai-sdk/provider-utils@5.0.11

## 2.0.11

### Patch Changes

- Updated dependencies [31c7be8]
  - @ai-sdk/provider-utils@5.0.10

## 2.0.10

### Patch Changes

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9

## 2.0.9

### Patch Changes

- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8

## 2.0.8

### Patch Changes

- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 2.0.7

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6

## 2.0.6

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 2.0.5

### Patch Changes

- Updated dependencies [c6f5e62]
  - @ai-sdk/provider-utils@5.0.4

## 2.0.4

### Patch Changes

- Updated dependencies [8c616f0]
  - @ai-sdk/provider-utils@5.0.3

## 2.0.3

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - @ai-sdk/provider-utils@5.0.2

## 2.0.2

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1

## 2.0.1

### Patch Changes

- ba6d510: chore: fix deprecated use of zod `.passthrough()`

## 2.0.0

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- 8359612: Start v7 pre-release
- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs
- 77600ba: chore(provider/prodia): update provider to use v4 types
- 9f0e36c: trigger release for all packages after provenance setup
- 5259a95: chore: add warning for providers that do not support new reasoning parameter
- 6e8917f: fix(prodia): validate user-supplied image URLs before fetching (SSRF)

  The Prodia video model's `resolveVideoFileData` fetched a user-supplied `image` URL directly with `fetch()`, bypassing the SDK's SSRF guard. An attacker who could supply the image URL could make the server request internal endpoints (e.g. cloud metadata) and have the response uploaded to Prodia's API. The URL is now downloaded via `downloadBlob`, which routes through `validateDownloadUrl` and rejects private/internal addresses, matching the pattern used by other providers.

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b8396f0: trigger initial beta release
- e2bdcd6: feat(provider/prodia): Add LanguageModel and VideoModel support to the Prodia provider.

  - **LanguageModel**: Supports Nano Banana (`inference.nano-banana.img2img.v2`) for img2img generation with text+image output via multipart form-data requests. Implements both `doGenerate` and `doStream`.
  - **VideoModel**: Supports Wan 2.2 Lightning for text-to-video (`inference.wan2-2.lightning.txt2vid.v0`) and image-to-video (`inference.wan2-2.lightning.img2vid.v0`) generation.
  - Extract shared multipart parsing and error handling infrastructure into `prodia-api.ts`.

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

## 2.0.0-beta.54

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 2.0.0-beta.53

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19

## 2.0.0-canary.52

### Patch Changes

- Updated dependencies [aeda373]
- Updated dependencies [375fdd7]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48

## 2.0.0-canary.51

### Patch Changes

- 6e8917f: fix(prodia): validate user-supplied image URLs before fetching (SSRF)

  The Prodia video model's `resolveVideoFileData` fetched a user-supplied `image` URL directly with `fetch()`, bypassing the SDK's SSRF guard. An attacker who could supply the image URL could make the server request internal endpoints (e.g. cloud metadata) and have the response uploaded to Prodia's API. The URL is now downloaded via `downloadBlob`, which routes through `validateDownloadUrl` and rejects private/internal addresses, matching the pattern used by other providers.

- Updated dependencies [bae5e2b]
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 2.0.0-canary.50

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 2.0.0-canary.49

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
  - @ai-sdk/provider-utils@5.0.0-canary.45

## 2.0.0-canary.48

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44

## 2.0.0-canary.47

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 2.0.0-canary.46

### Patch Changes

- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42

## 2.0.0-canary.45

### Patch Changes

- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - @ai-sdk/provider-utils@5.0.0-canary.41

## 2.0.0-canary.44

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40

## 2.0.0-canary.43

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39

## 2.0.0-canary.42

### Patch Changes

- Updated dependencies [ca446f8]
  - @ai-sdk/provider-utils@5.0.0-canary.38

## 2.0.0-canary.41

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37

## 2.0.0-canary.40

### Patch Changes

- Updated dependencies [ca39020]
  - @ai-sdk/provider-utils@5.0.0-canary.36

## 2.0.0-canary.39

### Patch Changes

- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35

## 2.0.0-canary.38

### Patch Changes

- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
  - @ai-sdk/provider-utils@5.0.0-canary.34

## 2.0.0-canary.37

### Patch Changes

- Updated dependencies [2427d88]
  - @ai-sdk/provider-utils@5.0.0-canary.33

## 2.0.0-canary.36

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16

## 2.0.0-canary.35

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15

## 2.0.0-beta.34

### Major Changes

- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- Updated dependencies [08d2129]
  - @ai-sdk/provider-utils@5.0.0-beta.30

## 2.0.0-beta.33

### Patch Changes

- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 2.0.0-beta.32

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 2.0.0-beta.31

### Patch Changes

- Updated dependencies [785fe16]
- Updated dependencies [67df0a0]
- Updated dependencies [befb78c]
- Updated dependencies [0458559]
- Updated dependencies [5852c0a]
- Updated dependencies [fc92055]
  - @ai-sdk/provider-utils@5.0.0-beta.27

## 2.0.0-beta.30

### Patch Changes

- Updated dependencies [2e98477]
  - @ai-sdk/provider-utils@5.0.0-beta.26

## 2.0.0-beta.29

### Patch Changes

- Updated dependencies [eea8d98]
  - @ai-sdk/provider-utils@5.0.0-beta.25

## 2.0.0-beta.28

### Patch Changes

- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24

## 2.0.0-beta.27

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23

## 2.0.0-beta.26

### Patch Changes

- Updated dependencies [083947b]
  - @ai-sdk/provider-utils@5.0.0-beta.22

## 2.0.0-beta.25

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21

## 2.0.0-beta.24

### Patch Changes

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- Updated dependencies [b3976a2]
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider-utils@5.0.0-beta.20
  - @ai-sdk/provider@4.0.0-beta.12

## 2.0.0-beta.23

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11
  - @ai-sdk/provider-utils@5.0.0-beta.19

## 2.0.0-beta.22

### Patch Changes

- Updated dependencies [90e2d8a]
  - @ai-sdk/provider-utils@5.0.0-beta.18

## 2.0.0-beta.21

### Patch Changes

- Updated dependencies [3ae1786]
  - @ai-sdk/provider-utils@5.0.0-beta.17

## 2.0.0-beta.20

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - @ai-sdk/provider-utils@5.0.0-beta.16

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9
  - @ai-sdk/provider-utils@5.0.0-beta.15

## 2.0.0-beta.18

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8
  - @ai-sdk/provider-utils@5.0.0-beta.14

## 2.0.0-beta.17

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - @ai-sdk/provider-utils@5.0.0-beta.13

## 2.0.0-beta.16

### Patch Changes

- Updated dependencies [46d1149]
  - @ai-sdk/provider-utils@5.0.0-beta.12

## 2.0.0-beta.15

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider-utils@5.0.0-beta.11
  - @ai-sdk/provider@4.0.0-beta.7

## 2.0.0-beta.14

### Patch Changes

- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- Updated dependencies [c29a26f]
  - @ai-sdk/provider-utils@5.0.0-beta.10
  - @ai-sdk/provider@4.0.0-beta.6

## 2.0.0-beta.13

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs

## 2.0.0-beta.12

### Patch Changes

- Updated dependencies [2e17091]
  - @ai-sdk/provider-utils@5.0.0-beta.9

## 2.0.0-beta.11

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - @ai-sdk/provider-utils@5.0.0-beta.8

## 2.0.0-beta.10

### Patch Changes

- Updated dependencies [1f509d4]
  - @ai-sdk/provider-utils@5.0.0-beta.7
  - @ai-sdk/provider@4.0.0-beta.5

## 2.0.0-beta.9

### Patch Changes

- 5259a95: chore: add warning for providers that do not support new reasoning parameter

## 2.0.0-beta.8

### Patch Changes

- Updated dependencies [3887c70]
  - @ai-sdk/provider-utils@5.0.0-beta.6
  - @ai-sdk/provider@4.0.0-beta.4

## 2.0.0-beta.7

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider-utils@5.0.0-beta.5
  - @ai-sdk/provider@4.0.0-beta.3

## 2.0.0-beta.6

### Patch Changes

- Updated dependencies [61753c3]
  - @ai-sdk/provider-utils@5.0.0-beta.4

## 2.0.0-beta.5

### Patch Changes

- e2bdcd6: feat(provider/prodia): Add LanguageModel and VideoModel support to the Prodia provider.
  - **LanguageModel**: Supports Nano Banana (`inference.nano-banana.img2img.v2`) for img2img generation with text+image output via multipart form-data requests. Implements both `doGenerate` and `doStream`.
  - **VideoModel**: Supports Wan 2.2 Lightning for text-to-video (`inference.wan2-2.lightning.txt2vid.v0`) and image-to-video (`inference.wan2-2.lightning.img2vid.v0`) generation.
  - Extract shared multipart parsing and error handling infrastructure into `prodia-api.ts`.

## 2.0.0-beta.4

### Patch Changes

- Updated dependencies [f7d4f01]
  - @ai-sdk/provider-utils@5.0.0-beta.3
  - @ai-sdk/provider@4.0.0-beta.2

## 2.0.0-beta.3

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1
  - @ai-sdk/provider-utils@5.0.0-beta.2

## 2.0.0-beta.2

### Patch Changes

- 77600ba: chore(provider/prodia): update provider to use v4 types

## 2.0.0-beta.1

### Patch Changes

- Updated dependencies [531251e]
  - @ai-sdk/provider-utils@5.0.0-beta.1

## 2.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0
  - @ai-sdk/provider-utils@5.0.0-beta.0

## 1.0.21

### Patch Changes

- Updated dependencies [ad4cfc2]
  - @ai-sdk/provider-utils@4.0.19

## 1.0.20

### Patch Changes

- Updated dependencies [824b295]
  - @ai-sdk/provider-utils@4.0.18

## 1.0.19

### Patch Changes

- Updated dependencies [08336f1]
  - @ai-sdk/provider-utils@4.0.17

## 1.0.18

### Patch Changes

- Updated dependencies [58bc42d]
  - @ai-sdk/provider-utils@4.0.16

## 1.0.17

### Patch Changes

- 67b0c8e: feat(provider/prodia): add price param to API requests

## 1.0.16

### Patch Changes

- Updated dependencies [4024a3a]
  - @ai-sdk/provider-utils@4.0.15

## 1.0.15

### Patch Changes

- 99fbed8: feat: normalize provider specific model options type names and ensure they are exported

## 1.0.14

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8
  - @ai-sdk/provider-utils@4.0.14

## 1.0.13

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7
  - @ai-sdk/provider-utils@4.0.13

## 1.0.12

### Patch Changes

- Updated dependencies [96936e5]
  - @ai-sdk/provider-utils@4.0.12

## 1.0.11

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider-utils@4.0.11
  - @ai-sdk/provider@3.0.6

## 1.0.10

### Patch Changes

- 1524271: chore: add skill information to README files

## 1.0.9

### Patch Changes

- 3988c08: docs: fix incorrect and outdated provider docs

## 1.0.8

### Patch Changes

- Updated dependencies [462ad00]
  - @ai-sdk/provider-utils@4.0.10

## 1.0.7

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5
  - @ai-sdk/provider-utils@4.0.9

## 1.0.6

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 1.0.5

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4
  - @ai-sdk/provider-utils@4.0.8

## 1.0.4

### Patch Changes

- Updated dependencies [46f46e4]
  - @ai-sdk/provider-utils@4.0.7

## 1.0.3

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider-utils@4.0.6
  - @ai-sdk/provider@3.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [34d1c8a]
  - @ai-sdk/provider-utils@4.0.5

## 1.0.1

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2
  - @ai-sdk/provider-utils@4.0.4

## 1.0.0

### Major Changes

- bb3d30e: feat(provider/prodia): Create Prodia provider package
