# @ai-sdk/huggingface

## 2.0.12

### Patch Changes

- Updated dependencies [cd06458]
  - @ai-sdk/provider-utils@5.0.11
  - @ai-sdk/openai-compatible@3.0.12

## 2.0.11

### Patch Changes

- Updated dependencies [0b61267]
  - @ai-sdk/openai-compatible@3.0.11

## 2.0.10

### Patch Changes

- Updated dependencies [31c7be8]
  - @ai-sdk/provider-utils@5.0.10
  - @ai-sdk/openai-compatible@3.0.10

## 2.0.9

### Patch Changes

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9
  - @ai-sdk/openai-compatible@3.0.9

## 2.0.8

### Patch Changes

- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8
  - @ai-sdk/openai-compatible@3.0.8

## 2.0.7

### Patch Changes

- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/openai-compatible@3.0.7
  - @ai-sdk/provider-utils@5.0.7

## 2.0.6

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6
  - @ai-sdk/openai-compatible@3.0.6

## 2.0.5

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5
  - @ai-sdk/openai-compatible@3.0.5

## 2.0.4

### Patch Changes

- Updated dependencies [c6f5e62]
  - @ai-sdk/provider-utils@5.0.4
  - @ai-sdk/openai-compatible@3.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [8c616f0]
  - @ai-sdk/provider-utils@5.0.3
  - @ai-sdk/openai-compatible@3.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - @ai-sdk/openai-compatible@3.0.2
  - @ai-sdk/provider-utils@5.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1
  - @ai-sdk/openai-compatible@3.0.1

## 2.0.0

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- 8359612: Start v7 pre-release
- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs
- 9f0e36c: trigger release for all packages after provenance setup
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b8396f0: trigger initial beta release
- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

## 2.0.0-beta.58

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - @ai-sdk/openai-compatible@3.0.0-beta.58
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 2.0.0-beta.57

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/openai-compatible@3.0.0-beta.57
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19

## 2.0.0-canary.56

### Patch Changes

- Updated dependencies [aeda373]
- Updated dependencies [375fdd7]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48
  - @ai-sdk/openai-compatible@3.0.0-canary.56

## 2.0.0-canary.55

### Patch Changes

- Updated dependencies [bae5e2b]
  - @ai-sdk/provider-utils@5.0.0-canary.47
  - @ai-sdk/openai-compatible@3.0.0-canary.55

## 2.0.0-canary.54

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - @ai-sdk/openai-compatible@3.0.0-canary.54
  - @ai-sdk/provider-utils@5.0.0-canary.46

## 2.0.0-canary.53

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [daf6637]
  - @ai-sdk/provider-utils@5.0.0-canary.45
  - @ai-sdk/openai-compatible@3.0.0-canary.53

## 2.0.0-canary.52

### Patch Changes

- Updated dependencies [6c93e36]
- Updated dependencies [f617ac2]
  - @ai-sdk/provider-utils@5.0.0-canary.44
  - @ai-sdk/openai-compatible@3.0.0-canary.52

## 2.0.0-canary.51

### Patch Changes

- Updated dependencies [9f1e1ba]
  - @ai-sdk/openai-compatible@3.0.0-canary.51

## 2.0.0-canary.50

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/openai-compatible@3.0.0-canary.50
  - @ai-sdk/provider-utils@5.0.0-canary.43
  - @ai-sdk/provider@4.0.0-canary.17

## 2.0.0-canary.49

### Patch Changes

- Updated dependencies [a6617c5]
  - @ai-sdk/provider-utils@5.0.0-canary.42
  - @ai-sdk/openai-compatible@3.0.0-canary.49

## 2.0.0-canary.48

### Patch Changes

- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - @ai-sdk/provider-utils@5.0.0-canary.41
  - @ai-sdk/openai-compatible@3.0.0-canary.48

## 2.0.0-canary.47

### Patch Changes

- Updated dependencies [a7de9c9]
  - @ai-sdk/provider-utils@5.0.0-canary.40
  - @ai-sdk/openai-compatible@3.0.0-canary.47

## 2.0.0-canary.46

### Patch Changes

- Updated dependencies [105f95b]
  - @ai-sdk/provider-utils@5.0.0-canary.39
  - @ai-sdk/openai-compatible@3.0.0-canary.46

## 2.0.0-canary.45

### Patch Changes

- Updated dependencies [ca446f8]
  - @ai-sdk/provider-utils@5.0.0-canary.38
  - @ai-sdk/openai-compatible@3.0.0-canary.45

## 2.0.0-canary.44

### Patch Changes

- Updated dependencies [d848405]
  - @ai-sdk/provider-utils@5.0.0-canary.37
  - @ai-sdk/openai-compatible@3.0.0-canary.44

## 2.0.0-canary.43

### Patch Changes

- Updated dependencies [ca39020]
  - @ai-sdk/provider-utils@5.0.0-canary.36
  - @ai-sdk/openai-compatible@3.0.0-canary.43

## 2.0.0-canary.42

### Patch Changes

- Updated dependencies [f634bac]
  - @ai-sdk/provider-utils@5.0.0-canary.35
  - @ai-sdk/openai-compatible@3.0.0-canary.42

## 2.0.0-canary.41

### Patch Changes

- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
  - @ai-sdk/provider-utils@5.0.0-canary.34
  - @ai-sdk/openai-compatible@3.0.0-canary.41

## 2.0.0-canary.40

### Patch Changes

- Updated dependencies [2427d88]
  - @ai-sdk/provider-utils@5.0.0-canary.33
  - @ai-sdk/openai-compatible@3.0.0-canary.40

## 2.0.0-canary.39

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider-utils@5.0.0-canary.32
  - @ai-sdk/provider@4.0.0-canary.16
  - @ai-sdk/openai-compatible@3.0.0-canary.39

## 2.0.0-canary.38

### Patch Changes

- Updated dependencies [cd9c311]
  - @ai-sdk/openai-compatible@3.0.0-canary.38

## 2.0.0-canary.37

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/openai-compatible@3.0.0-canary.37
  - @ai-sdk/provider-utils@5.0.0-canary.31
  - @ai-sdk/provider@4.0.0-canary.15

## 2.0.0-beta.36

### Patch Changes

- Updated dependencies [e59c955]
  - @ai-sdk/openai-compatible@3.0.0-beta.36

## 2.0.0-beta.35

### Major Changes

- 04e9009: chore: make provider implementations code patterns more consistent, including renaming certain exported symbols

  For all externally exported symbols that were renamed, the old names continue to work via deprecated aliases.

### Patch Changes

- Updated dependencies [08d2129]
- Updated dependencies [04e9009]
  - @ai-sdk/provider-utils@5.0.0-beta.30
  - @ai-sdk/openai-compatible@3.0.0-beta.35

## 2.0.0-beta.34

### Patch Changes

- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [b6783da]
  - @ai-sdk/openai-compatible@3.0.0-beta.34
  - @ai-sdk/provider-utils@5.0.0-beta.29
  - @ai-sdk/provider@4.0.0-beta.14

## 2.0.0-beta.33

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - @ai-sdk/openai-compatible@3.0.0-beta.33
  - @ai-sdk/provider@4.0.0-beta.13
  - @ai-sdk/provider-utils@5.0.0-beta.28

## 2.0.0-beta.32

### Patch Changes

- Updated dependencies [ab81968]
- Updated dependencies [785fe16]
- Updated dependencies [67df0a0]
- Updated dependencies [befb78c]
- Updated dependencies [0458559]
- Updated dependencies [58a2ad7]
- Updated dependencies [5852c0a]
- Updated dependencies [fc92055]
  - @ai-sdk/openai-compatible@3.0.0-beta.32
  - @ai-sdk/provider-utils@5.0.0-beta.27

## 2.0.0-beta.31

### Patch Changes

- Updated dependencies [2e98477]
- Updated dependencies [bfb756d]
  - @ai-sdk/provider-utils@5.0.0-beta.26
  - @ai-sdk/openai-compatible@3.0.0-beta.31

## 2.0.0-beta.30

### Patch Changes

- Updated dependencies [eea8d98]
  - @ai-sdk/provider-utils@5.0.0-beta.25
  - @ai-sdk/openai-compatible@3.0.0-beta.30

## 2.0.0-beta.29

### Patch Changes

- Updated dependencies [f807e45]
  - @ai-sdk/provider-utils@5.0.0-beta.24
  - @ai-sdk/openai-compatible@3.0.0-beta.29

## 2.0.0-beta.28

### Patch Changes

- Updated dependencies [350ea38]
  - @ai-sdk/provider-utils@5.0.0-beta.23
  - @ai-sdk/openai-compatible@3.0.0-beta.28

## 2.0.0-beta.27

### Patch Changes

- Updated dependencies [083947b]
  - @ai-sdk/provider-utils@5.0.0-beta.22
  - @ai-sdk/openai-compatible@3.0.0-beta.27

## 2.0.0-beta.26

### Patch Changes

- Updated dependencies [add1126]
  - @ai-sdk/provider-utils@5.0.0-beta.21
  - @ai-sdk/openai-compatible@3.0.0-beta.26

## 2.0.0-beta.25

### Patch Changes

- b3976a2: Add workflow serialization support to all provider models.

  **`@ai-sdk/provider-utils`:** New `serializeModel()` helper that extracts only serializable properties from a model instance, filtering out functions and objects containing functions. Third-party provider authors can use this to add workflow support to their own models.

  **All providers:** `headers` is now optional in provider config types. This is non-breaking — existing code that passes `headers` continues to work. Custom provider implementations that construct model configs manually can now omit `headers`, which is useful when models are deserialized from a workflow step boundary where auth is provided separately.

  All provider model classes now include `WORKFLOW_SERIALIZE` and `WORKFLOW_DESERIALIZE` static methods, enabling them to cross workflow step boundaries without serialization errors.

- Updated dependencies [b3976a2]
- Updated dependencies [ff5eba1]
  - @ai-sdk/provider-utils@5.0.0-beta.20
  - @ai-sdk/openai-compatible@3.0.0-beta.25
  - @ai-sdk/provider@4.0.0-beta.12

## 2.0.0-beta.24

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/openai-compatible@3.0.0-beta.24
  - @ai-sdk/provider@4.0.0-beta.11
  - @ai-sdk/provider-utils@5.0.0-beta.19

## 2.0.0-beta.23

### Patch Changes

- Updated dependencies [90e2d8a]
  - @ai-sdk/openai-compatible@3.0.0-beta.23
  - @ai-sdk/provider-utils@5.0.0-beta.18

## 2.0.0-beta.22

### Patch Changes

- Updated dependencies [3ae1786]
  - @ai-sdk/provider-utils@5.0.0-beta.17
  - @ai-sdk/openai-compatible@3.0.0-beta.22

## 2.0.0-beta.21

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - @ai-sdk/openai-compatible@3.0.0-beta.21
  - @ai-sdk/provider-utils@5.0.0-beta.16

## 2.0.0-beta.20

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9
  - @ai-sdk/openai-compatible@3.0.0-beta.20
  - @ai-sdk/provider-utils@5.0.0-beta.15

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8
  - @ai-sdk/openai-compatible@3.0.0-beta.19
  - @ai-sdk/provider-utils@5.0.0-beta.14

## 2.0.0-beta.18

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - @ai-sdk/provider-utils@5.0.0-beta.13
  - @ai-sdk/openai-compatible@3.0.0-beta.18

## 2.0.0-beta.17

### Patch Changes

- Updated dependencies [816ff67]
  - @ai-sdk/openai-compatible@3.0.0-beta.17

## 2.0.0-beta.16

### Patch Changes

- Updated dependencies [46d1149]
  - @ai-sdk/provider-utils@5.0.0-beta.12
  - @ai-sdk/openai-compatible@3.0.0-beta.16

## 2.0.0-beta.15

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider-utils@5.0.0-beta.11
  - @ai-sdk/provider@4.0.0-beta.7
  - @ai-sdk/openai-compatible@3.0.0-beta.15

## 2.0.0-beta.14

### Patch Changes

- c29a26f: feat(provider): add support for provider references and uploading files as supported per provider
- Updated dependencies [c29a26f]
  - @ai-sdk/openai-compatible@3.0.0-beta.14
  - @ai-sdk/provider-utils@5.0.0-beta.10
  - @ai-sdk/provider@4.0.0-beta.6

## 2.0.0-beta.13

### Patch Changes

- 38fc777: Add AI Gateway hint to provider READMEs
- Updated dependencies [38fc777]
  - @ai-sdk/openai-compatible@3.0.0-beta.13

## 2.0.0-beta.12

### Patch Changes

- Updated dependencies [2e17091]
  - @ai-sdk/provider-utils@5.0.0-beta.9
  - @ai-sdk/openai-compatible@3.0.0-beta.12

## 2.0.0-beta.11

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - @ai-sdk/provider-utils@5.0.0-beta.8
  - @ai-sdk/openai-compatible@3.0.0-beta.11

## 2.0.0-beta.10

### Patch Changes

- Updated dependencies [1f509d4]
  - @ai-sdk/provider-utils@5.0.0-beta.7
  - @ai-sdk/provider@4.0.0-beta.5
  - @ai-sdk/openai-compatible@3.0.0-beta.10

## 2.0.0-beta.9

### Patch Changes

- Updated dependencies [74d520f]
  - @ai-sdk/openai-compatible@3.0.0-beta.9

## 2.0.0-beta.8

### Patch Changes

- Updated dependencies [3887c70]
  - @ai-sdk/provider-utils@5.0.0-beta.6
  - @ai-sdk/provider@4.0.0-beta.4
  - @ai-sdk/openai-compatible@3.0.0-beta.8

## 2.0.0-beta.7

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider-utils@5.0.0-beta.5
  - @ai-sdk/provider@4.0.0-beta.3
  - @ai-sdk/openai-compatible@3.0.0-beta.7

## 2.0.0-beta.6

### Patch Changes

- Updated dependencies [61753c3]
  - @ai-sdk/provider-utils@5.0.0-beta.4
  - @ai-sdk/openai-compatible@3.0.0-beta.6

## 2.0.0-beta.5

### Patch Changes

- Updated dependencies [f7d4f01]
  - @ai-sdk/provider-utils@5.0.0-beta.3
  - @ai-sdk/provider@4.0.0-beta.2
  - @ai-sdk/openai-compatible@3.0.0-beta.5

## 2.0.0-beta.4

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1
  - @ai-sdk/openai-compatible@3.0.0-beta.4
  - @ai-sdk/provider-utils@5.0.0-beta.2

## 2.0.0-beta.3

### Patch Changes

- Updated dependencies [8f3e1da]
  - @ai-sdk/openai-compatible@3.0.0-beta.3

## 2.0.0-beta.2

### Patch Changes

- Updated dependencies [45b3d76]
- Updated dependencies [f7295cb]
  - @ai-sdk/openai-compatible@3.0.0-beta.2

## 2.0.0-beta.1

### Patch Changes

- Updated dependencies [531251e]
  - @ai-sdk/provider-utils@5.0.0-beta.1
  - @ai-sdk/openai-compatible@3.0.0-beta.1

## 2.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/openai-compatible@3.0.0-beta.0
  - @ai-sdk/provider@4.0.0-beta.0
  - @ai-sdk/provider-utils@5.0.0-beta.0

## 1.0.37

### Patch Changes

- Updated dependencies [ad4cfc2]
  - @ai-sdk/provider-utils@4.0.19
  - @ai-sdk/openai-compatible@2.0.35

## 1.0.36

### Patch Changes

- Updated dependencies [824b295]
  - @ai-sdk/provider-utils@4.0.18
  - @ai-sdk/openai-compatible@2.0.34

## 1.0.35

### Patch Changes

- Updated dependencies [89caf28]
  - @ai-sdk/openai-compatible@2.0.33

## 1.0.34

### Patch Changes

- Updated dependencies [08336f1]
  - @ai-sdk/provider-utils@4.0.17
  - @ai-sdk/openai-compatible@2.0.32

## 1.0.33

### Patch Changes

- Updated dependencies [58bc42d]
  - @ai-sdk/provider-utils@4.0.16
  - @ai-sdk/openai-compatible@2.0.31

## 1.0.32

### Patch Changes

- Updated dependencies [4024a3a]
  - @ai-sdk/provider-utils@4.0.15
  - @ai-sdk/openai-compatible@2.0.30

## 1.0.31

### Patch Changes

- Updated dependencies [99fbed8]
  - @ai-sdk/openai-compatible@2.0.29

## 1.0.30

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8
  - @ai-sdk/openai-compatible@2.0.28
  - @ai-sdk/provider-utils@4.0.14

## 1.0.29

### Patch Changes

- Updated dependencies [9e490ad]
  - @ai-sdk/openai-compatible@2.0.27

## 1.0.28

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7
  - @ai-sdk/openai-compatible@2.0.26
  - @ai-sdk/provider-utils@4.0.13

## 1.0.27

### Patch Changes

- Updated dependencies [96936e5]
  - @ai-sdk/provider-utils@4.0.12
  - @ai-sdk/openai-compatible@2.0.25

## 1.0.26

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider-utils@4.0.11
  - @ai-sdk/provider@3.0.6
  - @ai-sdk/openai-compatible@2.0.24

## 1.0.25

### Patch Changes

- 1524271: chore: add skill information to README files
- Updated dependencies [1524271]
  - @ai-sdk/openai-compatible@2.0.23

## 1.0.24

### Patch Changes

- 3988c08: docs: fix incorrect and outdated provider docs

## 1.0.23

### Patch Changes

- Updated dependencies [9d056e6]
  - @ai-sdk/openai-compatible@2.0.22

## 1.0.22

### Patch Changes

- Updated dependencies [462ad00]
  - @ai-sdk/provider-utils@4.0.10
  - @ai-sdk/openai-compatible@2.0.21

## 1.0.21

### Patch Changes

- Updated dependencies [a1a0175]
  - @ai-sdk/openai-compatible@2.0.20

## 1.0.20

### Patch Changes

- Updated dependencies [6900916]
  - @ai-sdk/openai-compatible@2.0.19

## 1.0.19

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/openai-compatible@2.0.18
  - @ai-sdk/provider@3.0.5
  - @ai-sdk/provider-utils@4.0.9

## 1.0.18

### Patch Changes

- 2b8369d: chore: add docs to package dist

## 1.0.17

### Patch Changes

- 8dc54db: chore: add src folders to package bundle
- Updated dependencies [8dc54db]
  - @ai-sdk/openai-compatible@2.0.17

## 1.0.16

### Patch Changes

- Updated dependencies [78555ad]
  - @ai-sdk/openai-compatible@2.0.16

## 1.0.15

### Patch Changes

- Updated dependencies [7116ef3]
  - @ai-sdk/openai-compatible@2.0.15

## 1.0.14

### Patch Changes

- Updated dependencies [1612a57]
  - @ai-sdk/openai-compatible@2.0.14

## 1.0.13

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4
  - @ai-sdk/openai-compatible@2.0.13
  - @ai-sdk/provider-utils@4.0.8

## 1.0.12

### Patch Changes

- Updated dependencies [78a133a]
  - @ai-sdk/openai-compatible@2.0.12

## 1.0.11

### Patch Changes

- Updated dependencies [46f46e4]
  - @ai-sdk/provider-utils@4.0.7
  - @ai-sdk/openai-compatible@2.0.11

## 1.0.10

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider-utils@4.0.6
  - @ai-sdk/provider@3.0.3
  - @ai-sdk/openai-compatible@2.0.10

## 1.0.9

### Patch Changes

- Updated dependencies [bc02a3c]
  - @ai-sdk/openai-compatible@2.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [78fcb18]
  - @ai-sdk/openai-compatible@2.0.8

## 1.0.7

### Patch Changes

- Updated dependencies [cd7bb0e]
  - @ai-sdk/openai-compatible@2.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [34d1c8a]
  - @ai-sdk/provider-utils@4.0.5
  - @ai-sdk/openai-compatible@2.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [d54c380]
  - @ai-sdk/openai-compatible@2.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2
  - @ai-sdk/openai-compatible@2.0.4
  - @ai-sdk/provider-utils@4.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [0b429d4]
  - @ai-sdk/provider-utils@4.0.3
  - @ai-sdk/openai-compatible@2.0.3

## 1.0.2

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/openai-compatible@2.0.2
  - @ai-sdk/provider@3.0.1
  - @ai-sdk/provider-utils@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [29264a3]
  - @ai-sdk/provider-utils@4.0.1
  - @ai-sdk/openai-compatible@2.0.1

## 1.0.0

### Major Changes

- dee8b05: ai SDK 6 beta
- ec640c6: feat(huggingface): add responses api support

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- 8d9e8ad: chore(provider): remove generics from EmbeddingModelV3

  Before

  ```ts
  model.textEmbeddingModel("my-model-id");
  ```

  After

  ```ts
  model.embeddingModel("my-model-id");
  ```

- 95f65c2: chore: use import \* from zod/v4
- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- 3bd2689: feat: extended token usage
- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- cbf52cd: feat: expose raw finish reason
- 1bbce64: extract reasoning content
- Updated dependencies
  - @ai-sdk/openai-compatible@2.0.0
  - @ai-sdk/provider@3.0.0
  - @ai-sdk/provider-utils@4.0.0

## 1.0.0-beta.56

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32
  - @ai-sdk/openai-compatible@2.0.0-beta.60
  - @ai-sdk/provider-utils@4.0.0-beta.59

## 1.0.0-beta.55

### Patch Changes

- Updated dependencies [2625a04]
  - @ai-sdk/openai-compatible@2.0.0-beta.59
  - @ai-sdk/provider@3.0.0-beta.31
  - @ai-sdk/provider-utils@4.0.0-beta.58

## 1.0.0-beta.54

### Patch Changes

- cbf52cd: feat: expose raw finish reason
- Updated dependencies [cbf52cd]
  - @ai-sdk/openai-compatible@2.0.0-beta.58
  - @ai-sdk/provider@3.0.0-beta.30
  - @ai-sdk/provider-utils@4.0.0-beta.57

## 1.0.0-beta.53

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29
  - @ai-sdk/openai-compatible@2.0.0-beta.57
  - @ai-sdk/provider-utils@4.0.0-beta.56

## 1.0.0-beta.52

### Patch Changes

- Updated dependencies [50b70d6]
  - @ai-sdk/provider-utils@4.0.0-beta.55
  - @ai-sdk/openai-compatible@2.0.0-beta.56

## 1.0.0-beta.51

### Patch Changes

- Updated dependencies [9061dc0]
  - @ai-sdk/openai-compatible@2.0.0-beta.55
  - @ai-sdk/provider-utils@4.0.0-beta.54
  - @ai-sdk/provider@3.0.0-beta.28

## 1.0.0-beta.50

### Patch Changes

- 366f50b: chore(provider): add deprecated textEmbeddingModel and textEmbedding aliases
- Updated dependencies [366f50b]
  - @ai-sdk/openai-compatible@2.0.0-beta.54
  - @ai-sdk/provider@3.0.0-beta.27
  - @ai-sdk/provider-utils@4.0.0-beta.53

## 1.0.0-beta.49

### Patch Changes

- Updated dependencies [763d04a]
  - @ai-sdk/provider-utils@4.0.0-beta.52
  - @ai-sdk/openai-compatible@2.0.0-beta.53

## 1.0.0-beta.48

### Patch Changes

- Updated dependencies [c1efac4]
  - @ai-sdk/provider-utils@4.0.0-beta.51
  - @ai-sdk/openai-compatible@2.0.0-beta.52

## 1.0.0-beta.47

### Patch Changes

- Updated dependencies [32223c8]
  - @ai-sdk/provider-utils@4.0.0-beta.50
  - @ai-sdk/openai-compatible@2.0.0-beta.51

## 1.0.0-beta.46

### Patch Changes

- Updated dependencies [83e5744]
  - @ai-sdk/provider-utils@4.0.0-beta.49
  - @ai-sdk/openai-compatible@2.0.0-beta.50

## 1.0.0-beta.45

### Patch Changes

- Updated dependencies [960ec8f]
  - @ai-sdk/provider-utils@4.0.0-beta.48
  - @ai-sdk/openai-compatible@2.0.0-beta.49

## 1.0.0-beta.44

### Patch Changes

- Updated dependencies [e9e157f]
  - @ai-sdk/provider-utils@4.0.0-beta.47
  - @ai-sdk/openai-compatible@2.0.0-beta.48

## 1.0.0-beta.43

### Patch Changes

- Updated dependencies [81e29ab]
  - @ai-sdk/provider-utils@4.0.0-beta.46
  - @ai-sdk/openai-compatible@2.0.0-beta.47

## 1.0.0-beta.42

### Patch Changes

- 3bd2689: feat: extended token usage
- Updated dependencies [3bd2689]
  - @ai-sdk/openai-compatible@2.0.0-beta.46
  - @ai-sdk/provider@3.0.0-beta.26
  - @ai-sdk/provider-utils@4.0.0-beta.45

## 1.0.0-beta.41

### Patch Changes

- Updated dependencies [53f3368]
  - @ai-sdk/provider@3.0.0-beta.25
  - @ai-sdk/openai-compatible@2.0.0-beta.45
  - @ai-sdk/provider-utils@4.0.0-beta.44

## 1.0.0-beta.40

### Patch Changes

- Updated dependencies [dce03c4]
  - @ai-sdk/provider-utils@4.0.0-beta.43
  - @ai-sdk/provider@3.0.0-beta.24
  - @ai-sdk/openai-compatible@2.0.0-beta.44

## 1.0.0-beta.39

### Patch Changes

- Updated dependencies [3ed5519]
  - @ai-sdk/provider-utils@4.0.0-beta.42
  - @ai-sdk/openai-compatible@2.0.0-beta.43

## 1.0.0-beta.38

### Patch Changes

- Updated dependencies [1bd7d32]
  - @ai-sdk/openai-compatible@2.0.0-beta.42
  - @ai-sdk/provider-utils@4.0.0-beta.41
  - @ai-sdk/provider@3.0.0-beta.23

## 1.0.0-beta.37

### Patch Changes

- 544d4e8: chore(specification): rename v3 provider defined tool to provider tool
- Updated dependencies [544d4e8]
  - @ai-sdk/openai-compatible@2.0.0-beta.41
  - @ai-sdk/provider-utils@4.0.0-beta.40
  - @ai-sdk/provider@3.0.0-beta.22

## 1.0.0-beta.36

### Patch Changes

- Updated dependencies [954c356]
  - @ai-sdk/provider-utils@4.0.0-beta.39
  - @ai-sdk/provider@3.0.0-beta.21
  - @ai-sdk/openai-compatible@2.0.0-beta.40

## 1.0.0-beta.35

### Patch Changes

- Updated dependencies [03849b0]
  - @ai-sdk/provider-utils@4.0.0-beta.38
  - @ai-sdk/openai-compatible@2.0.0-beta.39

## 1.0.0-beta.34

### Patch Changes

- 457318b: chore(provider,ai): switch to SharedV3Warning and unified warnings
- Updated dependencies [457318b]
  - @ai-sdk/openai-compatible@2.0.0-beta.38
  - @ai-sdk/provider@3.0.0-beta.20
  - @ai-sdk/provider-utils@4.0.0-beta.37

## 1.0.0-beta.33

### Patch Changes

- 8d9e8ad: chore(provider): remove generics from EmbeddingModelV3

  Before

  ```ts
  model.textEmbeddingModel("my-model-id");
  ```

  After

  ```ts
  model.embeddingModel("my-model-id");
  ```

- Updated dependencies [8d9e8ad]
  - @ai-sdk/openai-compatible@2.0.0-beta.37
  - @ai-sdk/provider@3.0.0-beta.19
  - @ai-sdk/provider-utils@4.0.0-beta.36

## 1.0.0-beta.32

### Patch Changes

- Updated dependencies [10d819b]
  - @ai-sdk/provider@3.0.0-beta.18
  - @ai-sdk/openai-compatible@2.0.0-beta.36
  - @ai-sdk/provider-utils@4.0.0-beta.35

## 1.0.0-beta.31

### Patch Changes

- Updated dependencies [db913bd]
  - @ai-sdk/provider@3.0.0-beta.17
  - @ai-sdk/openai-compatible@2.0.0-beta.35
  - @ai-sdk/provider-utils@4.0.0-beta.34

## 1.0.0-beta.30

### Patch Changes

- 1bbce64: extract reasoning content

## 1.0.0-beta.29

### Patch Changes

- Updated dependencies [b681d7d]
  - @ai-sdk/provider@3.0.0-beta.16
  - @ai-sdk/openai-compatible@2.0.0-beta.34
  - @ai-sdk/provider-utils@4.0.0-beta.33

## 1.0.0-beta.28

### Patch Changes

- Updated dependencies [32d8dbb]
  - @ai-sdk/provider-utils@4.0.0-beta.32
  - @ai-sdk/openai-compatible@2.0.0-beta.33

## 1.0.0-beta.27

### Patch Changes

- Updated dependencies [bb36798]
  - @ai-sdk/provider@3.0.0-beta.15
  - @ai-sdk/openai-compatible@2.0.0-beta.32
  - @ai-sdk/provider-utils@4.0.0-beta.31

## 1.0.0-beta.26

### Patch Changes

- Updated dependencies [4f16c37]
  - @ai-sdk/provider-utils@4.0.0-beta.30
  - @ai-sdk/openai-compatible@2.0.0-beta.31

## 1.0.0-beta.25

### Patch Changes

- Updated dependencies [af3780b]
  - @ai-sdk/provider@3.0.0-beta.14
  - @ai-sdk/openai-compatible@2.0.0-beta.30
  - @ai-sdk/provider-utils@4.0.0-beta.29

## 1.0.0-beta.24

### Patch Changes

- Updated dependencies [016b111]
  - @ai-sdk/provider-utils@4.0.0-beta.28
  - @ai-sdk/openai-compatible@2.0.0-beta.29

## 1.0.0-beta.23

### Patch Changes

- Updated dependencies [37c58a0]
  - @ai-sdk/provider@3.0.0-beta.13
  - @ai-sdk/openai-compatible@2.0.0-beta.28
  - @ai-sdk/provider-utils@4.0.0-beta.27

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [d1bdadb]
  - @ai-sdk/provider@3.0.0-beta.12
  - @ai-sdk/openai-compatible@2.0.0-beta.27
  - @ai-sdk/provider-utils@4.0.0-beta.26

## 1.0.0-beta.21

### Patch Changes

- Updated dependencies [4c44a5b]
  - @ai-sdk/provider@3.0.0-beta.11
  - @ai-sdk/openai-compatible@2.0.0-beta.26
  - @ai-sdk/provider-utils@4.0.0-beta.25

## 1.0.0-beta.20

### Patch Changes

- 0c3b58b: fix(provider): add specificationVersion to ProviderV3
- Updated dependencies [0c3b58b]
  - @ai-sdk/openai-compatible@2.0.0-beta.25
  - @ai-sdk/provider@3.0.0-beta.10
  - @ai-sdk/provider-utils@4.0.0-beta.24

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [a755db5]
  - @ai-sdk/provider@3.0.0-beta.9
  - @ai-sdk/openai-compatible@2.0.0-beta.24
  - @ai-sdk/provider-utils@4.0.0-beta.23

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [58920e0]
  - @ai-sdk/provider-utils@4.0.0-beta.22
  - @ai-sdk/openai-compatible@2.0.0-beta.23

## 1.0.0-beta.17

### Patch Changes

- Updated dependencies [293a6b7]
  - @ai-sdk/provider-utils@4.0.0-beta.21
  - @ai-sdk/openai-compatible@2.0.0-beta.22

## 1.0.0-beta.16

### Patch Changes

- Updated dependencies [fca786b]
  - @ai-sdk/provider-utils@4.0.0-beta.20
  - @ai-sdk/openai-compatible@2.0.0-beta.21

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [3794514]
  - @ai-sdk/provider-utils@4.0.0-beta.19
  - @ai-sdk/provider@3.0.0-beta.8
  - @ai-sdk/openai-compatible@2.0.0-beta.20

## 1.0.0-beta.14

### Patch Changes

- Updated dependencies [81d4308]
  - @ai-sdk/provider@3.0.0-beta.7
  - @ai-sdk/openai-compatible@2.0.0-beta.19
  - @ai-sdk/provider-utils@4.0.0-beta.18

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [703459a]
  - @ai-sdk/provider-utils@4.0.0-beta.17
  - @ai-sdk/openai-compatible@2.0.0-beta.18

## 1.0.0-beta.12

### Patch Changes

- Updated dependencies [b689220]
  - @ai-sdk/openai-compatible@2.0.0-beta.17

## 1.0.0-beta.11

### Patch Changes

- Updated dependencies [6306603]
  - @ai-sdk/provider-utils@4.0.0-beta.16
  - @ai-sdk/openai-compatible@2.0.0-beta.16

## 1.0.0-beta.10

### Patch Changes

- Updated dependencies [f0b2157]
  - @ai-sdk/provider-utils@4.0.0-beta.15
  - @ai-sdk/openai-compatible@2.0.0-beta.15

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [3b1d015]
  - @ai-sdk/provider-utils@4.0.0-beta.14
  - @ai-sdk/openai-compatible@2.0.0-beta.14

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [d116b4b]
  - @ai-sdk/provider-utils@4.0.0-beta.13
  - @ai-sdk/openai-compatible@2.0.0-beta.13

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [7e32fea]
  - @ai-sdk/provider-utils@4.0.0-beta.12
  - @ai-sdk/openai-compatible@2.0.0-beta.12

## 1.0.0-beta.6

### Patch Changes

- 95f65c2: chore: use import \* from zod/v4
- Updated dependencies
  - @ai-sdk/openai-compatible@2.0.0-beta.11
  - @ai-sdk/provider-utils@4.0.0-beta.11

## 1.0.0-beta.5

### Major Changes

- dee8b05: ai SDK 6 beta

### Patch Changes

- Updated dependencies [dee8b05]
  - @ai-sdk/openai-compatible@2.0.0-beta.10
  - @ai-sdk/provider@3.0.0-beta.6
  - @ai-sdk/provider-utils@4.0.0-beta.10

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [521c537]
  - @ai-sdk/provider-utils@3.1.0-beta.9
  - @ai-sdk/openai-compatible@1.1.0-beta.9

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [e06565c]
  - @ai-sdk/provider-utils@3.1.0-beta.8
  - @ai-sdk/openai-compatible@1.1.0-beta.8

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies
  - @ai-sdk/provider@2.1.0-beta.5
  - @ai-sdk/openai-compatible@1.1.0-beta.7
  - @ai-sdk/provider-utils@3.1.0-beta.7

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies
  - @ai-sdk/openai-compatible@1.1.0-beta.6
  - @ai-sdk/provider-utils@3.1.0-beta.6
  - @ai-sdk/provider@2.1.0-beta.4

## 1.0.0-beta.0

### Major Changes

- ec640c6: feat(huggingface): add responses api support

### Patch Changes

- Updated dependencies
  - @ai-sdk/openai-compatible@1.1.0-beta.5
  - @ai-sdk/provider-utils@3.1.0-beta.5
  - @ai-sdk/provider@2.1.0-beta.3
