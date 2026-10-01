---
name: add-function-examples
description: Guide for adding new AI function examples, for testing specific features against the actual provider APIs.
metadata:
  internal: true
---

## Adding Function Examples

Review the changes in the current branch, and identify new or modified features or bug fixes that would benefit from having an example in the `examples/ai-functions` directory. These examples are used for testing specific features against the actual provider APIs, and can also serve as documentation for users.

Determine for which kind of model and top-level function the example should be added. For a language model, the example should be added in two variants, one for `generateText` and one for `streamText`. For any other models kinds, add the example for the relevant top-level function (e.g. `generateImage`, `generateSpeech`).

After creating the example, run `pnpm type-check:full`; fix any errors encountered.
