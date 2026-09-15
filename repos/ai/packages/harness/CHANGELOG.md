# @ai-sdk/harness

## 1.0.36

### Patch Changes

- Updated dependencies [70f18c3]
- Updated dependencies [cd06458]
  - ai@7.0.31
  - @ai-sdk/provider-utils@5.0.11

## 1.0.35

### Patch Changes

- ai@7.0.30

## 1.0.34

### Patch Changes

- ai@7.0.29

## 1.0.33

### Patch Changes

- Updated dependencies [0bc8d4f]
  - ai@7.0.28

## 1.0.32

### Patch Changes

- Updated dependencies [ac01b79]
- Updated dependencies [31c7be8]
- Updated dependencies [2696562]
  - ai@7.0.27
  - @ai-sdk/provider-utils@5.0.10

## 1.0.31

### Patch Changes

- Updated dependencies [27d294d]
  - ai@7.0.26

## 1.0.30

### Patch Changes

- Updated dependencies [4be62c1]
- Updated dependencies [7805e4a]
- Updated dependencies [7805e4a]
- Updated dependencies [f8e82fd]
- Updated dependencies [cd12954]
  - @ai-sdk/provider-utils@5.0.9
  - ai@7.0.25

## 1.0.29

### Patch Changes

- Updated dependencies [e193290]
- Updated dependencies [e193290]
  - @ai-sdk/provider-utils@5.0.8
  - ai@7.0.24

## 1.0.28

### Patch Changes

- Updated dependencies [930f949]
  - ai@7.0.23

## 1.0.27

### Patch Changes

- Updated dependencies [8f89c25]
  - ai@7.0.22

## 1.0.26

### Patch Changes

- Updated dependencies [308a519]
  - ai@7.0.21

## 1.0.25

### Patch Changes

- 44e988a: fix(harness): fix harness tool approval regression

## 1.0.24

### Patch Changes

- Updated dependencies [b9ac19f]
- Updated dependencies [a4186d6]
  - ai@7.0.20

## 1.0.23

### Patch Changes

- 39c8276: fix(harness): improve opaque sandbox bridge error handling
- 91fe6d8: fix(harness): emit `finish-step` stream parts correctly per the underlying model steps
- 0be5014: fix(harness): fix obsolete portions of harness package readme

## 1.0.22

### Patch Changes

- Updated dependencies [be7f05a]
- Updated dependencies [ee55a07]
- Updated dependencies [aad737d]
- Updated dependencies [0f93c57]
  - ai@7.0.19
  - @ai-sdk/provider@4.0.3
  - @ai-sdk/provider-utils@5.0.7

## 1.0.21

### Patch Changes

- Updated dependencies [ac306ed]
  - @ai-sdk/provider-utils@5.0.6
  - ai@7.0.18

## 1.0.20

### Patch Changes

- b7aa06a: fix(harness): include step numbers on harness step-end telemetry events.
  - ai@7.0.17

## 1.0.19

### Patch Changes

- Updated dependencies [a8f9b6d]
  - ai@7.0.16

## 1.0.18

### Patch Changes

- ai@7.0.15

## 1.0.17

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - ai@7.0.14
  - @ai-sdk/provider@4.0.2
  - @ai-sdk/provider-utils@5.0.5

## 1.0.16

### Patch Changes

- ai@7.0.13

## 1.0.15

### Patch Changes

- Updated dependencies [ecfeb6f]
- Updated dependencies [a193137]
- Updated dependencies [c6f5e62]
  - ai@7.0.12
  - @ai-sdk/provider-utils@5.0.4

## 1.0.14

### Patch Changes

- Updated dependencies [0a87626]
  - ai@7.0.11

## 1.0.13

### Patch Changes

- Updated dependencies [8c616f0]
  - ai@7.0.10
  - @ai-sdk/provider-utils@5.0.3

## 1.0.12

### Patch Changes

- 7859cea: feat(harness): add tool filtering via `activeTools` and `inactiveTools`
- c857346: feat(harness): add utility functions for certain duplicated layers in harnesses

## 1.0.11

### Patch Changes

- ai@7.0.9

## 1.0.10

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - ai@7.0.8
  - @ai-sdk/provider-utils@5.0.2

## 1.0.9

### Patch Changes

- Updated dependencies [d598481]
  - ai@7.0.7

## 1.0.8

### Patch Changes

- Updated dependencies [989402d]
  - ai@7.0.6

## 1.0.7

### Patch Changes

- Updated dependencies [a2750db]
  - ai@7.0.5

## 1.0.6

### Patch Changes

- Updated dependencies [6a436e3]
  - @ai-sdk/provider-utils@5.0.1
  - ai@7.0.4

## 1.0.5

### Patch Changes

- ai@7.0.3

## 1.0.4

### Patch Changes

- c493634: fix(harness): fix harness Zod usage to be v3/v4 compatible

## 1.0.3

### Patch Changes

- 51d10a0: feat(harness): add `prepareSandboxForHarness` utility to prepare a caller-owned sandbox for one or more harnesses

## 1.0.2

### Patch Changes

- ai@7.0.2

## 1.0.1

### Patch Changes

- ai@7.0.1

## 1.0.0

### Major Changes

- 9d6dbe0: feat(harness): add sandbox specific expansion for harness abstraction, add `sandbox-just-bash` and `sandbox-vercel`

### Patch Changes

- e5d4a24: chore(harness): update ws package
- aae0138: fix(harness): make listening for sandbox bridge readiness compatible with Bun
- be83911: fix(harness): reject bridge startup when the WebSocket port cannot be bound
- 3d87086: fix(harness): guard against invalid resuming a session vs continuing a turn
- d77bed4: chore(harness): separate harness spec types (v1) from consumer-facing types
- 21d3d60: feat(harness): implement harness specification
- 3d9a50c: feat(harness): implement harness adapters for Claude Code, Codex, Pi
- 57e0a59: fix(harness): ensure finish chunk's total usage is actually coming from total usage
- 6c7a3e5: Start the `1.0.0` canary release line for the experimental harness and sandbox packages. They were unintentionally published as `0.0.0-canary.*` because they were scaffolded with a `0.0.0-canary.0` premajor version, which semver could not advance past on a major bump.
- 1ea15a3: fix(harness): fix various bugs with harness skills not being correctly processed by the harness adapters
- a83a367: feat(harness): allow pre-snapshot `sandboxConfig.onBootstrap` callback in `HarnessAgent`
- b8396f0: trigger initial beta release
- 534dac6: fix(harness): fix incomplete OIDC token support for AI Gateway auth in harness adapters

## 1.0.0-beta.27

### Patch Changes

- ai@7.0.0-beta.187

## 1.0.0-beta.26

### Patch Changes

- a83a367: feat(harness): allow pre-snapshot `sandboxConfig.onBootstrap` callback in `HarnessAgent`

## 1.0.0-beta.25

### Patch Changes

- ai@7.0.0-beta.186

## 1.0.0-beta.24

### Patch Changes

- Updated dependencies [75763b0]
  - ai@7.0.0-beta.185

## 1.0.0-beta.23

### Patch Changes

- 57e0a59: fix(harness): ensure finish chunk's total usage is actually coming from total usage

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - ai@7.0.0-beta.184
  - @ai-sdk/provider-utils@5.0.0-beta.50

## 1.0.0-beta.21

### Patch Changes

- ai@7.0.0-beta.183

## 1.0.0-beta.20

### Patch Changes

- e5d4a24: chore(harness): update ws package
- Updated dependencies [cc6ab90]
  - ai@7.0.0-beta.182

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [6a2caf9]
  - ai@7.0.0-beta.181

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [81a284b]
  - ai@7.0.0-beta.180

## 1.0.0-beta.17

### Patch Changes

- 534dac6: fix(harness): fix incomplete OIDC token support for AI Gateway auth in harness adapters

## 1.0.0-beta.16

### Patch Changes

- ai@7.0.0-beta.179

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [b097c52]
  - ai@7.0.0-beta.178

## 1.0.0-beta.14

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider-utils@5.0.0-beta.49
  - @ai-sdk/provider@4.0.0-beta.19
  - ai@7.0.0-beta.177

## 1.0.0-canary.13

### Patch Changes

- ai@7.0.0-canary.176

## 1.0.0-canary.12

### Patch Changes

- Updated dependencies [6ec57f5]
  - ai@7.0.0-canary.175

## 1.0.0-canary.11

### Patch Changes

- be83911: fix(harness): reject bridge startup when the WebSocket port cannot be bound

## 1.0.0-canary.10

### Patch Changes

- ai@7.0.0-canary.174

## 1.0.0-canary.9

### Patch Changes

- ai@7.0.0-canary.173

## 1.0.0-canary.8

### Patch Changes

- aae0138: fix(harness): make listening for sandbox bridge readiness compatible with Bun

## 1.0.0-canary.7

### Patch Changes

- 3d87086: fix(harness): guard against invalid resuming a session vs continuing a turn
- 1ea15a3: fix(harness): fix various bugs with harness skills not being correctly processed by the harness adapters
- Updated dependencies [aeda373]
- Updated dependencies [25a64f8]
- Updated dependencies [375fdd7]
- Updated dependencies [f18b08f]
- Updated dependencies [b4507d5]
  - @ai-sdk/provider-utils@5.0.0-canary.48
  - ai@7.0.0-canary.172

## 1.0.0-canary.6

### Patch Changes

- Updated dependencies [89ad56f]
- Updated dependencies [f9a496f]
- Updated dependencies [3295831]
  - ai@7.0.0-canary.171

## 1.0.0-canary.5

### Patch Changes

- d77bed4: chore(harness): separate harness spec types (v1) from consumer-facing types
- Updated dependencies [bae5e2b]
- Updated dependencies [69d7128]
  - ai@7.0.0-canary.170
  - @ai-sdk/provider-utils@5.0.0-canary.47

## 1.0.0-canary.4

### Patch Changes

- 3d9a50c: feat(harness): implement harness adapters for Claude Code, Codex, Pi

## 1.0.0-canary.3

### Patch Changes

- 21d3d60: feat(harness): implement harness specification
- Updated dependencies [a5018ab]
- Updated dependencies [21d3d60]
- Updated dependencies [426dbbb]
- Updated dependencies [7fd3360]
  - ai@7.0.0-canary.169

## 1.0.0-canary.2

### Patch Changes

- 6c7a3e5: Start the `1.0.0` canary release line for the experimental harness and sandbox packages. They were unintentionally published as `0.0.0-canary.*` because they were scaffolded with a `0.0.0-canary.0` premajor version, which semver could not advance past on a major bump.

## 0.0.0-canary.1

### Major Changes

- 9d6dbe0: feat(harness): add sandbox specific expansion for harness abstraction, add `sandbox-just-bash` and `sandbox-vercel`
