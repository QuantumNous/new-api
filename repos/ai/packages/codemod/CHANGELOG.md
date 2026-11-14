# @ai-sdk/codemod

## 4.0.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs
- 9f12cd2: feat(codemods): add codemods for v6 to v7 migration
- 9f0e36c: trigger release for all packages after provenance setup
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b8396f0: trigger initial beta release
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling

## 4.0.0-beta.8

### Patch Changes

- 9f12cd2: feat(codemods): add codemods for v6 to v7 migration

## 4.0.0-beta.7

### Patch Changes

- b8396f0: trigger initial beta release

## 4.0.0-canary.6

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.

## 4.0.0-canary.5

### Patch Changes

- 0c4c275: trigger initial canary release

## 4.0.0-beta.4

### Patch Changes

- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles

## 4.0.0-beta.3

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup

## 4.0.0-beta.2

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling

## 4.0.0-beta.1

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs

## 4.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

## 3.0.3

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package

## 3.0.2

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 3.0.1

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`

## 3.0.0

### Major Changes

- dee8b05: ai SDK 6 beta

### Minor Changes

- 78928cb: release: start 5.1 beta

### Patch Changes

- 10128fd: feat(codemods): v5 -> v6 codemods
- 9f3216e: feat(codemod): add remaining codemods for v5 -> v6 migration
- 32044aa: feat(codemods): add codemods for providerMetadata key change
- b586bf4: chore(codemod): add codemod for making convertToModelMessages async
- 9061dc0: feat: image editing
- 7e4eb2e: chore(codemod): add codemod for destructuring the toModelOutput param
- 740d4bf: feat(codemod): add usechat input state transformation for v5
- 437ab50: feat(codemod): add usechat api to transport transformation
- 9b4457c: feat(codemod): add tool invocations migration to v5 codemods
- adbeac4: feat(codemod): add datastream to uimessagestream transformation

## 3.0.0-beta.8

### Patch Changes

- 9061dc0: feat: image editing

## 3.0.0-beta.7

### Patch Changes

- b586bf4: chore(codemod): add codemod for making convertToModelMessages async

## 3.0.0-beta.6

### Patch Changes

- 7e4eb2e: chore(codemod): add codemod for destructuring the toModelOutput param

## 3.0.0-beta.5

### Patch Changes

- 32044aa: feat(codemods): add codemods for providerMetadata key change

## 3.0.0-beta.4

### Patch Changes

- 9f3216e: feat(codemod): add remaining codemods for v5 -> v6 migration

## 3.0.0-beta.3

### Patch Changes

- 10128fd: feat(codemods): v5 -> v6 codemods

## 3.0.0-beta.2

### Major Changes

- dee8b05: ai SDK 6 beta

## 2.1.0-beta.1

### Patch Changes

- 740d4bf: feat(codemod): add usechat input state transformation for v5
- 437ab50: feat(codemod): add usechat api to transport transformation
- 9b4457c: feat(codemod): add tool invocations migration to v5 codemods
- adbeac4: feat(codemod): add datastream to uimessagestream transformation

## 2.1.0-beta.0

### Minor Changes

- 78928cb: release: start 5.1 beta

## 2.0.10

### Patch Changes

- 4627f55: fix(codemod): remove generate text codemod

## 2.0.9

### Patch Changes

- c82e85a: fix(codemod): handle import alias for maxStep-stopWhen

## 2.0.8

### Patch Changes

- 8aadbc9: feat(codemod): add not implemented comment and warnings

## 2.0.7

### Patch Changes

- 5dc1c62: fix(codemod): Language Model V2 Import

  Migration: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#language-model-v2-import

  Codemod behavior before the fix

  ```diff
  - import { LanguageModelV2 } from 'ai';
  + import { LanguageModelV2 } from '@ai-sdk/provider';
  ```

  After

  ```diff
  + import { LanguageModelV2 } from 'ai';
  - import { LanguageModelV2 } from '@ai-sdk/provider';
  ```

- 7ae8e57: fix(codemod): avoid false positive in `v5/restructure-file-stream-parts`
- 237a8cc: fix(codemod): Do not replace `delta.type` value from `'text-delta'` to `'text'`

## 2.0.6

### Patch Changes

- 7faddf1: feat(codemod): add zod import v3 transformation
- 5f85d6f: add codemod for getErrorMessage to onError in toUIMessageStreamResponse

## 2.0.5

### Patch Changes

- bc330ec: feat(codemod): add DataStream to UIMessage method renaming codemod

## 2.0.4

### Patch Changes

- 3841377: Added a codemod to change `maxSteps` to `stopWhen`

## 2.0.3

### Patch Changes

- 58fff3f: fixes generateText text property transform

## 2.0.2

### Patch Changes

- 23a1916: fix Message transform for generic types

## 2.0.1

### Patch Changes

- 3d6a91b: ### new codemode for: "`createIdGenerator()` now requires a size argument"

  The codemod added in this change addresses the following change in v5

  Before:

  ```ts
  import { createIdGenerator } from "ai";

  const generator = createIdGenerator({ prefix: "msg" });
  const id2 = generator(16); // Custom size at call time
  ```

  After:

  ```ts
  import { createIdGenerator } from "ai";

  const generator32 = createIdGenerator({ size: 32 });
  const id1 = generator32(); // Fixed size from creation

  const generator16 = createIdGenerator({ prefix: "msg", size: 16 });
  const id2 = generator16(); // Fixed size from creation
  ```

- 094c4ca: ### Codemod for: "`IDGenerator` type renamed to `IdGenerator`"

  This change adds a new codemod which handles the change from

  ```ts
  import { IDGenerator } from "ai";
  ```

  to

  ```ts
  import { IdGenerator } from "ai";
  ```

## 2.0.0

### Major Changes

- d5f588f: AI SDK 5

### Patch Changes

- b0446d4: release AI SDK 5.0 codemods package
- df983e6: feat(codemods): added v4→v5 migration codemods
- 4726e71: fix(codemod): correct import-LanguageModelV2-from-provider-package direction and quote preservation
- 4e01854: v5 - AI SDK 5.0 codemods package

## 2.0.0-beta.4

### Patch Changes

- df983e6: feat(codemods): added v4→v5 migration codemods

## 2.0.0-beta.3

### Patch Changes

- 4726e71: fix(codemod): correct import-LanguageModelV2-from-provider-package direction and quote preservation

## 2.0.0-beta.2

### Patch Changes

- 4e01854: v5 - AI SDK 5.0 codemods package

## 2.0.0-beta.1

### Patch Changes

- b0446d4: release AI SDK 5.0 codemods package

## 2.0.0-canary.0

### Major Changes

- d5f588f: AI SDK 5

## 1.2.0

### Minor Changes

- 5bc638d: AI SDK 4.2

## 1.1.0

### Minor Changes

- 62ba5ad: release: AI SDK 4.1

## 1.0.3

### Patch Changes

- 5ed5e45: chore (config): Use ts-library.json tsconfig for no-UI libs.

## 1.0.2

### Patch Changes

- 5d902a7: feat (packages/codemod): Don't generate duplicate token usage imports.
- c4e1192: fix (codemod): Filter more dirs/files unlikely to need transform.

## 1.0.1

### Patch Changes

- ff0676c: chore (packages/codemod): Remove semver dependency.

## 1.0.0

### Major Changes

- 86b4045: chore (release): bump major version to 1.0 in prep for 4.0 release

### Patch Changes

- 977eb23: feat (packages/codemod): Add codemod to replace continuation steps.
- 7326f22: fix (packages/codemod): Remove package version check pre-upgrade.
- 7c205ba: feat (packages/codemod): Added codemod to rm metadata w/ headers.
- 09f6d27: feat (packages/codemod): Set up package for automated migrations.
- a2e0f02: fix (packages/codemod): Ignore code under dot-prefixed dirs.
- 6b7fd20: feat (packages/codemod): Add codemod to rename formatStreamPart.
- 7e19003: feat (packages/codemod): Add codemod to rm isXXXError methods.
- 4dc9622: feat (packages/codemod): Add codemod to rename parseStreamPart.
- 0df618b: fix (packages/codemod): Only rename baseUrl in create-provider calls.
- bffedb0: feat (packages/codemod): Improve codemod CLI logging.
- 01b8e1c: feat (package/codemod): Add upgrade command to run codemod bundle.
- cb91fe3: feat (packages/codemod): Add codemod to remove provider facades.
- 9c9ae64: feat (packages/codemod): Add codemod to replace token usage types.
- c5ff26d: feat (packages/codemod): Add codemod to remove experimental msg types.
- e2093fe: feat (packages/codemod): Add codemod to replace langchain toAIStream.
- ba0dfc0: feat (packages/codemod): Show progress bar during upgrade.
- 66373dd: fix (packages/codemod): Only mutate files when changes are needed.
- c33e632: feat (packages/codemod): Add codemod to rm experimental_StreamData.
- 030f327: feat (packages/codemod): Add more automated transformations for 4.0.
- b1d9efb: fix (packages/codemod): Only rename nanoid on import from 'ai'.
- 29556ed: feat (packages/codemod): Add script to scaffold new codemod.
- 575e7da: feat (packages/codemod): Add codemod to remove ExperimentalTool.
- 94c51ae: fix (packages/codemod): Only replace ai-sdk provider ctors.
- 1931f4f: feat (providers/codemod): Add codemod to remove deprecated prov reg exports.
- b183ed0: feat (packages/codemod): Improve error handling and logging.
- 2523330: feat (package/codemod): Add codemod to replace roundtrips.
- 194a3eb: feat (packages/codemod): Add codemod to rm experimental useAssistant.
- 45feb29: feat (packages/codemod): codemod to rm await from streamText/Object.

## 1.0.0-canary.7

### Patch Changes

- ba0dfc0: feat (packages/codemod): Show progress bar during upgrade.
- 66373dd: fix (packages/codemod): Only mutate files when changes are needed.

## 1.0.0-canary.6

### Patch Changes

- 7326f22: fix (packages/codemod): Remove package version check pre-upgrade.
- a2e0f02: fix (packages/codemod): Ignore code under dot-prefixed dirs.
- b1d9efb: fix (packages/codemod): Only rename nanoid on import from 'ai'.
- b183ed0: feat (packages/codemod): Improve error handling and logging.
- 45feb29: feat (packages/codemod): codemod to rm await from streamText/Object.

## 1.0.0-canary.5

### Major Changes

- 86b4045: chore (release): bump major version to 1.0 in prep for 4.0 release

### Patch Changes

- 977eb23: feat (packages/codemod): Add codemod to replace continuation steps.
- 7c205ba: feat (packages/codemod): Added codemod to rm metadata w/ headers.
- 6b7fd20: feat (packages/codemod): Add codemod to rename formatStreamPart.
- 7e19003: feat (packages/codemod): Add codemod to rm isXXXError methods.
- 4dc9622: feat (packages/codemod): Add codemod to rename parseStreamPart.
- 0df618b: fix (packages/codemod): Only rename baseUrl in create-provider calls.
- c33e632: feat (packages/codemod): Add codemod to rm experimental_StreamData.
- 575e7da: feat (packages/codemod): Add codemod to remove ExperimentalTool.
- 194a3eb: feat (packages/codemod): Add codemod to rm experimental useAssistant.

## 0.0.1-canary.4

### Patch Changes

- bffedb0: feat (packages/codemod): Improve codemod CLI logging.
- 94c51ae: fix (packages/codemod): Only replace ai-sdk provider ctors.

## 0.0.1-canary.3

### Patch Changes

- cb91fe3: feat (packages/codemod): Add codemod to remove provider facades.
- 9c9ae64: feat (packages/codemod): Add codemod to replace token usage types.
- c5ff26d: feat (packages/codemod): Add codemod to remove experimental msg types.
- e2093fe: feat (packages/codemod): Add codemod to replace langchain toAIStream.
- 29556ed: feat (packages/codemod): Add script to scaffold new codemod.
- 1931f4f: feat (providers/codemod): Add codemod to remove deprecated prov reg exports.
- 2523330: feat (package/codemod): Add codemod to replace roundtrips.

## 0.0.1-canary.2

### Patch Changes

- 01b8e1c: feat (package/codemod): Add upgrade command to run codemod bundle.

## 0.0.1-canary.1

### Patch Changes

- 030f327: feat (packages/codemod): Add more automated transformations for 4.0.

## 0.0.1-canary.0

### Patch Changes

- 09f6d27: feat (packages/codemod): Set up package for automated migrations.
