# @ai-sdk/devtools

## 1.0.6

### Patch Changes

- 5be55f1: Use an explicit latest tag in the DevTools viewer command so it starts from monorepo workspaces where DevTools is only installed transitively.

## 1.0.5

### Patch Changes

- 27d294d: feat(ai): group orphaned tool calls after tool approvals under parent span

## 1.0.4

### Patch Changes

- c29e0d7: chore (devtools): remove leftover `module` field from package.json (dual CJS/ESM publishing was removed in AI SDK 7)

## 1.0.3

### Patch Changes

- Updated dependencies [0f93c57]
  - @ai-sdk/provider@4.0.3

## 1.0.2

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - @ai-sdk/provider@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1

## 1.0.0

### Major Changes

- 1949571: feat(ai): make experimental_telemetry stable
- 6542d93: feat(ai): change naming nomenclature for `*TelemetryIntegration` to `*Telemetry`
- cf93359: feat(ai): remove/refactor event data sent via callbacks
- 116c89f: feat(ai): remove telemetry data from the user-facing event data
- 8359612: Start v7 pre-release

### Patch Changes

- 19736ee: feat(ai): rename onStepFinish to onStepEnd
- 4757690: feat(ai): rename onObjectStepFinish to onObjectStepEnd
- 7bf7d7f: feat(ai): enable:true for telemetry by default
- b567a6c: dependency updates
- ddfcdc7: Fix `ToolItem` expand/collapse logic: chevron now shows whenever there's expandable content (parameters or description), expanded view shows full description plus parameters, collapsed view shows truncated description only.
- b05f5ee: fix: bump hono to ^4.12.25 to resolve CVE-2026-54290 (CORS Middleware reflects any Origin with credentials when origin defaults to the wildcard)
- ee7bb67: fix(devtools): add pointer cursor to DevTools buttons
- 98627e5: feat(ai): remove onChunk event from telemetry
- 29d8cf4: feat(ai): rename the core-event types
- 32ce45c: fix(devtools): secure devtools viewer api access
- 275674e: fix(devtools): validate viewer database paths
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 0c4c275: trigger initial canary release
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- b8396f0: trigger initial beta release
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- e27ed76: feat(devtools): add new devtools integration for telemetry

## 1.0.0-beta.33

### Patch Changes

- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20

## 1.0.0-beta.32

### Patch Changes

- b05f5ee: fix: bump hono to ^4.12.25 to resolve CVE-2026-54290 (CORS Middleware reflects any Origin with credentials when origin defaults to the wildcard)

## 1.0.0-beta.31

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider@4.0.0-beta.19

## 1.0.0-canary.30

### Patch Changes

- 32ce45c: fix(devtools): secure devtools viewer api access
- 275674e: fix(devtools): validate viewer database paths

## 1.0.0-canary.29

### Patch Changes

- 4757690: feat(ai): rename onObjectStepFinish to onObjectStepEnd

## 1.0.0-canary.28

### Patch Changes

- 19736ee: feat(ai): rename onStepFinish to onStepEnd

## 1.0.0-canary.27

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18

## 1.0.0-canary.26

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - @ai-sdk/provider@4.0.0-canary.17

## 1.0.0-canary.25

### Patch Changes

- b567a6c: dependency updates

## 1.0.0-canary.24

### Patch Changes

- ee7bb67: fix(devtools): add pointer cursor to DevTools buttons

## 1.0.0-canary.23

### Patch Changes

- 98627e5: feat(ai): remove onChunk event from telemetry

## 1.0.0-canary.22

### Patch Changes

- ddfcdc7: Fix `ToolItem` expand/collapse logic: chevron now shows whenever there's expandable content (parameters or description), expanded view shows full description plus parameters, collapsed view shows truncated description only.

## 1.0.0-canary.21

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider@4.0.0-canary.16

## 1.0.0-canary.20

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider@4.0.0-canary.15

## 1.0.0-beta.19

### Patch Changes

- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
  - @ai-sdk/provider@4.0.0-beta.14

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [9f0e36c]
  - @ai-sdk/provider@4.0.0-beta.13

## 1.0.0-beta.17

### Major Changes

- cf93359: feat(ai): remove/refactor event data sent via callbacks
- 116c89f: feat(ai): remove telemetry data from the user-facing event data

### Patch Changes

- 29d8cf4: feat(ai): rename the core-event types

## 1.0.0-beta.16

### Major Changes

- 1949571: feat(ai): make experimental_telemetry stable
- 6542d93: feat(ai): change naming nomenclature for `*TelemetryIntegration` to `*Telemetry`

## 1.0.0-beta.15

### Patch Changes

- 7bf7d7f: feat(ai): enable:true for telemetry by default

## 1.0.0-beta.14

### Patch Changes

- Updated dependencies [ff5eba1]
  - @ai-sdk/provider@4.0.0-beta.12

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [ef992f8]
  - @ai-sdk/provider@4.0.0-beta.11

## 1.0.0-beta.12

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling

## 1.0.0-beta.11

### Patch Changes

- e27ed76: feat(devtools): add new devtools integration for telemetry

## 1.0.0-beta.10

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [e311194]
  - @ai-sdk/provider@4.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
  - @ai-sdk/provider@4.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider@4.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [c29a26f]
  - @ai-sdk/provider@4.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies [1f509d4]
  - @ai-sdk/provider@4.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [3887c70]
  - @ai-sdk/provider@4.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [776b617]
  - @ai-sdk/provider@4.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [f7d4f01]
  - @ai-sdk/provider@4.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [5c2a5a2]
  - @ai-sdk/provider@4.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- 8359612: Start v7 pre-release

### Patch Changes

- Updated dependencies [8359612]
  - @ai-sdk/provider@4.0.0-beta.0

## 0.0.15

### Patch Changes

- 4c3a932: Use explicit AI_SDK_DEVTOOLS_DEV env flag for dev mode detection

## 0.0.14

### Patch Changes

- d14f0aa: chore (devtools): include skill instructions in readme

## 0.0.13

### Patch Changes

- b2e7fe2: Fix dev mode detection to prevent false positives when repos are in paths containing '/src/'

## 0.0.12

### Patch Changes

- Updated dependencies [7168375]
  - @ai-sdk/provider@3.0.8

## 0.0.11

### Patch Changes

- Updated dependencies [53f6731]
  - @ai-sdk/provider@3.0.7

## 0.0.10

### Patch Changes

- Updated dependencies [2810850]
  - @ai-sdk/provider@3.0.6

## 0.0.9

### Patch Changes

- 87e5e2a: Fix typo in README.md: `devToolsMiddleware` should be called as a function `devToolsMiddleware()`.

## 0.0.8

### Patch Changes

- 4de5a1d: chore: excluded tests from src folder in npm package
- Updated dependencies [4de5a1d]
  - @ai-sdk/provider@3.0.5

## 0.0.7

### Patch Changes

- 8dc54db: chore: add src folders to package bundle

## 0.0.6

### Patch Changes

- Updated dependencies [5c090e7]
  - @ai-sdk/provider@3.0.4

## 0.0.5

### Patch Changes

- Updated dependencies [1b11dcb]
  - @ai-sdk/provider@3.0.3

## 0.0.4

### Patch Changes

- Updated dependencies [d937c8f]
  - @ai-sdk/provider@3.0.2

## 0.0.3

### Patch Changes

- 863d34f: fix: trigger release to update `@latest`
- Updated dependencies [863d34f]
  - @ai-sdk/provider@3.0.1

## 0.0.2

### Patch Changes

- 4c527d5: fix (devtools): step output text and bin name

## 0.0.1

### Patch Changes

- 8e9300f: Initial release of package
- 4e9f4f5: fix: handle extended token usage format with cache and reasoning breakdowns
- Updated dependencies
  - @ai-sdk/provider@3.0.0

## 0.0.1-beta.7

### Patch Changes

- Updated dependencies [475189e]
  - @ai-sdk/provider@3.0.0-beta.32

## 0.0.1-beta.6

### Patch Changes

- Updated dependencies [2625a04]
  - @ai-sdk/provider@3.0.0-beta.31

## 0.0.1-beta.5

### Patch Changes

- Updated dependencies [cbf52cd]
  - @ai-sdk/provider@3.0.0-beta.30

## 0.0.1-beta.4

### Patch Changes

- Updated dependencies [9549c9e]
  - @ai-sdk/provider@3.0.0-beta.29

## 0.0.1-beta.3

### Patch Changes

- Updated dependencies [9061dc0]
  - @ai-sdk/provider@3.0.0-beta.28

## 0.0.1-beta.2

### Patch Changes

- Updated dependencies [366f50b]
  - @ai-sdk/provider@3.0.0-beta.27

## 0.0.1-beta.1

### Patch Changes

- 4e9f4f5: fix: handle extended token usage format with cache and reasoning breakdowns

## 0.0.1-beta.0

### Patch Changes

- 8e9300f: Initial release of package
