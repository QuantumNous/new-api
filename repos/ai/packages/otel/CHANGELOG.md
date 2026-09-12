# @ai-sdk/otel

## 1.0.31

### Patch Changes

- Updated dependencies [70f18c3]
- Updated dependencies [cd06458]
  - ai@7.0.31

## 1.0.30

### Patch Changes

- ai@7.0.30

## 1.0.29

### Patch Changes

- ai@7.0.29

## 1.0.28

### Patch Changes

- Updated dependencies [0bc8d4f]
  - ai@7.0.28

## 1.0.27

### Patch Changes

- Updated dependencies [ac01b79]
- Updated dependencies [2696562]
  - ai@7.0.27

## 1.0.26

### Patch Changes

- 27d294d: feat(ai): group orphaned tool calls after tool approvals under parent span
- Updated dependencies [27d294d]
  - ai@7.0.26

## 1.0.25

### Patch Changes

- Updated dependencies [7805e4a]
- Updated dependencies [f8e82fd]
  - ai@7.0.25

## 1.0.24

### Patch Changes

- Updated dependencies [e193290]
  - ai@7.0.24

## 1.0.23

### Patch Changes

- Updated dependencies [930f949]
  - ai@7.0.23

## 1.0.22

### Patch Changes

- Updated dependencies [8f89c25]
  - ai@7.0.22

## 1.0.21

### Patch Changes

- Updated dependencies [308a519]
  - ai@7.0.21

## 1.0.20

### Patch Changes

- Updated dependencies [b9ac19f]
- Updated dependencies [a4186d6]
  - ai@7.0.20

## 1.0.19

### Patch Changes

- Updated dependencies [be7f05a]
- Updated dependencies [ee55a07]
- Updated dependencies [aad737d]
- Updated dependencies [0f93c57]
  - ai@7.0.19
  - @ai-sdk/provider@4.0.3

## 1.0.18

### Patch Changes

- ai@7.0.18

## 1.0.17

### Patch Changes

- ai@7.0.17

## 1.0.16

### Patch Changes

- Updated dependencies [a8f9b6d]
  - ai@7.0.16

## 1.0.15

### Patch Changes

- ai@7.0.15

## 1.0.14

### Patch Changes

- 5c5c0f5: Add experimental streaming transcription support for transcription models, including OpenAI `gpt-realtime-whisper` and xAI WebSocket STT.
- Updated dependencies [5c5c0f5]
  - ai@7.0.14
  - @ai-sdk/provider@4.0.2

## 1.0.13

### Patch Changes

- ai@7.0.13

## 1.0.12

### Patch Changes

- Updated dependencies [ecfeb6f]
- Updated dependencies [a193137]
  - ai@7.0.12

## 1.0.11

### Patch Changes

- Updated dependencies [0a87626]
  - ai@7.0.11

## 1.0.10

### Patch Changes

- Updated dependencies [8c616f0]
  - ai@7.0.10

## 1.0.9

### Patch Changes

- ai@7.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [0274f34]
  - @ai-sdk/provider@4.0.1
  - ai@7.0.8

## 1.0.7

### Patch Changes

- Updated dependencies [d598481]
  - ai@7.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [989402d]
  - ai@7.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [a2750db]
  - ai@7.0.5

## 1.0.4

### Patch Changes

- ai@7.0.4

## 1.0.3

### Patch Changes

- ai@7.0.3

## 1.0.2

### Patch Changes

- ai@7.0.2

## 1.0.1

### Patch Changes

- ai@7.0.1

## 1.0.0

### Major Changes

- 6542d93: feat(ai): change naming nomenclature for `*TelemetryIntegration` to `*Telemetry`
- cf93359: feat(ai): remove/refactor event data sent via callbacks
- 8284dfa: feat(otel): rename OpenTelemetry to LegacyOpenTelemetry
- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.
- 116c89f: feat(ai): remove telemetry data from the user-facing event data
- b3c9f6a: feat(ai): create new opentelemetry package (@ai-sdk/otel)

### Patch Changes

- b94d22f: Sanitize OpenTelemetry span array attributes so they no longer emit invalid OTLP values (arrays containing `undefined`/`null`/objects, or arrays mixing primitive types). Such values previously failed telemetry ingestion with `deserializing message invalid value: map, expected map with a single key` and flooded function logs with errors.
- 19736ee: feat(ai): rename onStepFinish to onStepEnd
- 4757690: feat(ai): rename onObjectStepFinish to onObjectStepEnd
- 382d53b: refactoring: rename context to runtimeContext
- 7bf7d7f: feat(ai): enable:true for telemetry by default
- c025d60: feat(otel): add option for custom span attributes
- 1db29c8: feat(ai): break `CallSettings` apart into `LanguageModelCallOptions` and `RequestOptions`
- eea8d98: refactoring: rename tool execution events
- 5d0f18e: feat(ai): move opentelemetry to new package
- 1582efa: chore(ai): remove the metadata field from the telemetry settings
- 98627e5: feat(ai): remove onChunk event from telemetry
- 9f0e36c: trigger release for all packages after provenance setup
- 1e200eb: fix(otel): ensure nested context object creates separate attribute
- 29d8cf4: feat(ai): rename the core-event types
- 18651f6: feat(otel): add opt-in options for supplemental AI SDK attributes on OpenTelemetry spans
- e4182bd: chore: rm export of OutputInterface
- 1043274: feat(ai): add a ModelCall start/end event
- 476e1ca: feat(ai): remove telemetry dependency on onChunk callback
- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- 594029e: feat(ai): wrap the model call in telemetry context
- eaf849f: Rename rerank telemetry finish callback to `onRerankEnd`.
- 0c4c275: trigger initial canary release
- fc15550: feat(otel): add the genAI semantic otel integration
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- 8565dcb: fix: rename onEmbedFinish to onEmbedEnd
- 152c67c: feat(otel): add a step level span
- e1bfb9c: feat(ai): remove unnecessary data from events
- 334ae5d: Update step performance metrics with explicit effective, input, output, and total token throughput fields.
- b8396f0: trigger initial beta release
- d5cac7c: feat(otel): emit performance metrics via gen ai semantics
- c3d4019: chore(ai): rename 'TelemetrySettings' to 'TelemetryOptions'
- e92fc45: feat(ai): introduce onAbort hook to close telemetry spans
- 083947b: feat(ai): separate toolsContext from context
- 64de016: feat(otel): rename GenAIOpenTelemetry to OpenTelemetry
- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling

## 1.0.0-beta.133

### Patch Changes

- ai@7.0.0-beta.187

## 1.0.0-beta.132

### Patch Changes

- ai@7.0.0-beta.186

## 1.0.0-beta.131

### Patch Changes

- Updated dependencies [75763b0]
  - ai@7.0.0-beta.185

## 1.0.0-beta.130

### Patch Changes

- b94d22f: Sanitize OpenTelemetry span array attributes so they no longer emit invalid OTLP values (arrays containing `undefined`/`null`/objects, or arrays mixing primitive types). Such values previously failed telemetry ingestion with `deserializing message invalid value: map, expected map with a single key` and flooded function logs with errors.
- d5cac7c: feat(otel): emit performance metrics via gen ai semantics
- Updated dependencies [0416e3e]
  - @ai-sdk/provider@4.0.0-beta.20
  - ai@7.0.0-beta.184

## 1.0.0-beta.129

### Patch Changes

- ai@7.0.0-beta.183

## 1.0.0-beta.128

### Patch Changes

- Updated dependencies [cc6ab90]
  - ai@7.0.0-beta.182

## 1.0.0-beta.127

### Patch Changes

- Updated dependencies [6a2caf9]
  - ai@7.0.0-beta.181

## 1.0.0-beta.126

### Patch Changes

- Updated dependencies [81a284b]
  - ai@7.0.0-beta.180

## 1.0.0-beta.125

### Patch Changes

- ai@7.0.0-beta.179

## 1.0.0-beta.124

### Patch Changes

- Updated dependencies [b097c52]
  - ai@7.0.0-beta.178

## 1.0.0-beta.123

### Patch Changes

- b8396f0: trigger initial beta release
- Updated dependencies [b8396f0]
  - @ai-sdk/provider@4.0.0-beta.19
  - ai@7.0.0-beta.177

## 1.0.0-canary.122

### Patch Changes

- ai@7.0.0-canary.176

## 1.0.0-canary.121

### Patch Changes

- Updated dependencies [6ec57f5]
  - ai@7.0.0-canary.175

## 1.0.0-canary.120

### Patch Changes

- ai@7.0.0-canary.174

## 1.0.0-canary.119

### Patch Changes

- ai@7.0.0-canary.173

## 1.0.0-canary.118

### Patch Changes

- Updated dependencies [25a64f8]
- Updated dependencies [375fdd7]
- Updated dependencies [f18b08f]
- Updated dependencies [b4507d5]
  - ai@7.0.0-canary.172

## 1.0.0-canary.117

### Patch Changes

- Updated dependencies [89ad56f]
- Updated dependencies [f9a496f]
- Updated dependencies [3295831]
  - ai@7.0.0-canary.171

## 1.0.0-canary.116

### Patch Changes

- Updated dependencies [bae5e2b]
- Updated dependencies [69d7128]
  - ai@7.0.0-canary.170

## 1.0.0-canary.115

### Patch Changes

- Updated dependencies [a5018ab]
- Updated dependencies [21d3d60]
- Updated dependencies [426dbbb]
- Updated dependencies [7fd3360]
  - ai@7.0.0-canary.169

## 1.0.0-canary.114

### Patch Changes

- Updated dependencies [1e4b350]
  - ai@7.0.0-canary.168

## 1.0.0-canary.113

### Patch Changes

- 4757690: feat(ai): rename onObjectStepFinish to onObjectStepEnd
- Updated dependencies [4757690]
- Updated dependencies [eeefc3f]
- Updated dependencies [b79b6a8]
  - ai@7.0.0-canary.167

## 1.0.0-canary.112

### Patch Changes

- 19736ee: feat(ai): rename onStepFinish to onStepEnd
- e4182bd: chore: rm export of OutputInterface
- Updated dependencies [19736ee]
- Updated dependencies [d66ae02]
- Updated dependencies [e4182bd]
  - ai@7.0.0-canary.166

## 1.0.0-canary.111

### Patch Changes

- Updated dependencies [ce769dd]
  - @ai-sdk/provider@4.0.0-canary.18
  - ai@7.0.0-canary.165

## 1.0.0-canary.110

### Patch Changes

- ai@7.0.0-canary.164

## 1.0.0-canary.109

### Patch Changes

- Updated dependencies [ee798eb]
- Updated dependencies [c907622]
  - ai@7.0.0-canary.163

## 1.0.0-canary.108

### Patch Changes

- ai@7.0.0-canary.162

## 1.0.0-canary.107

### Patch Changes

- ai@7.0.0-canary.161

## 1.0.0-canary.106

### Patch Changes

- ai@7.0.0-canary.160

## 1.0.0-canary.105

### Patch Changes

- Updated dependencies [b5092f5]
  - ai@7.0.0-canary.159

## 1.0.0-canary.104

### Patch Changes

- Updated dependencies [bcce2dd]
  - ai@7.0.0-canary.158

## 1.0.0-canary.103

### Patch Changes

- ai@7.0.0-canary.157

## 1.0.0-canary.102

### Patch Changes

- 1e200eb: fix(otel): ensure nested context object creates separate attribute
- e92fc45: feat(ai): introduce onAbort hook to close telemetry spans
- Updated dependencies [023550e]
- Updated dependencies [e92fc45]
  - ai@7.0.0-canary.156

## 1.0.0-canary.101

### Patch Changes

- Updated dependencies [e67d80e]
- Updated dependencies [6cca112]
- Updated dependencies [82fc0ab]
- Updated dependencies [76fd58c]
  - ai@7.0.0-canary.155

## 1.0.0-canary.100

### Patch Changes

- 594029e: feat(ai): wrap the model call in telemetry context
- Updated dependencies [594029e]
  - ai@7.0.0-canary.154

## 1.0.0-canary.99

### Patch Changes

- Updated dependencies [6c93e36]
  - ai@7.0.0-canary.153

## 1.0.0-canary.98

### Patch Changes

- ai@7.0.0-canary.152

## 1.0.0-canary.97

### Patch Changes

- ai@7.0.0-canary.151

## 1.0.0-canary.96

### Patch Changes

- ai@7.0.0-canary.150

## 1.0.0-canary.95

### Patch Changes

- Updated dependencies [e3d9c0e]
  - ai@7.0.0-canary.149

## 1.0.0-canary.94

### Patch Changes

- Updated dependencies [2852a84]
  - ai@7.0.0-canary.148

## 1.0.0-canary.93

### Patch Changes

- ai@7.0.0-canary.147

## 1.0.0-canary.92

### Patch Changes

- ai@7.0.0-canary.146

## 1.0.0-canary.91

### Patch Changes

- ai@7.0.0-canary.145

## 1.0.0-canary.90

### Patch Changes

- 7fc6bd6: Raise minimum supported Node.js version to 22. Supported versions: 22, 24, and 26.
- Updated dependencies [7fc6bd6]
  - ai@7.0.0-canary.144
  - @ai-sdk/provider@4.0.0-canary.17

## 1.0.0-canary.89

### Patch Changes

- Updated dependencies [a6617c5]
  - ai@7.0.0-canary.143

## 1.0.0-canary.88

### Patch Changes

- Updated dependencies [62d6481]
  - ai@7.0.0-canary.142

## 1.0.0-canary.87

### Patch Changes

- Updated dependencies [e3a0419]
  - ai@7.0.0-canary.141

## 1.0.0-canary.86

### Patch Changes

- ai@7.0.0-canary.140

## 1.0.0-canary.85

### Patch Changes

- 334ae5d: Update step performance metrics with explicit effective, input, output, and total token throughput fields.
- Updated dependencies [334ae5d]
- Updated dependencies [28dfa06]
- Updated dependencies [e93fa91]
  - ai@7.0.0-canary.139

## 1.0.0-canary.84

### Patch Changes

- ai@7.0.0-canary.138

## 1.0.0-canary.83

### Patch Changes

- 98627e5: feat(ai): remove onChunk event from telemetry
- 476e1ca: feat(ai): remove telemetry dependency on onChunk callback
- Updated dependencies [98627e5]
- Updated dependencies [476e1ca]
  - ai@7.0.0-canary.137

## 1.0.0-canary.82

### Patch Changes

- Updated dependencies [a7de9c9]
  - ai@7.0.0-canary.136

## 1.0.0-canary.81

### Patch Changes

- ai@7.0.0-canary.135

## 1.0.0-canary.80

### Patch Changes

- Updated dependencies [ed74dae]
- Updated dependencies [f4cc8eb]
- Updated dependencies [e80ada0]
- Updated dependencies [1dca341]
- Updated dependencies [2605e5f]
  - ai@7.0.0-canary.134

## 1.0.0-canary.79

### Patch Changes

- Updated dependencies [38ca8dc]
- Updated dependencies [6d76710]
  - ai@7.0.0-canary.133

## 1.0.0-canary.78

### Patch Changes

- eaf849f: Rename rerank telemetry finish callback to `onRerankEnd`.
- 8565dcb: fix: rename onEmbedFinish to onEmbedEnd
- Updated dependencies [eaf849f]
- Updated dependencies [8565dcb]
  - ai@7.0.0-canary.132

## 1.0.0-canary.77

### Patch Changes

- Updated dependencies [b67525f]
- Updated dependencies [ca446f8]
- Updated dependencies [bcacd48]
  - ai@7.0.0-canary.131

## 1.0.0-canary.76

### Patch Changes

- ai@7.0.0-canary.130

## 1.0.0-canary.75

### Patch Changes

- Updated dependencies [d1b3786]
  - ai@7.0.0-canary.129

## 1.0.0-canary.74

### Patch Changes

- ai@7.0.0-canary.128

## 1.0.0-canary.73

### Patch Changes

- c025d60: feat(otel): add option for custom span attributes
- Updated dependencies [e95e38d]
- Updated dependencies [016e877]
- Updated dependencies [ca99fea]
- Updated dependencies [d775a57]
- Updated dependencies [538c12b]
  - ai@7.0.0-canary.127

## 1.0.0-canary.72

### Patch Changes

- ai@7.0.0-canary.126

## 1.0.0-canary.71

### Patch Changes

- Updated dependencies [fd4f578]
- Updated dependencies [31f69de]
- Updated dependencies [7c71ac6]
- Updated dependencies [c0c8ca2]
- Updated dependencies [5faf71c]
- Updated dependencies [69254e0]
- Updated dependencies [3015fc3]
- Updated dependencies [eee1166]
- Updated dependencies [7dbf992]
  - ai@7.0.0-canary.125

## 1.0.0-canary.70

### Patch Changes

- Updated dependencies [69aeb0e]
- Updated dependencies [48e92f3]
  - ai@7.0.0-canary.124

## 1.0.0-canary.69

### Patch Changes

- Updated dependencies [7392266]
- Updated dependencies [4bb4dbc]
  - ai@7.0.0-canary.123

## 1.0.0-canary.68

### Patch Changes

- Updated dependencies [79b2468]
- Updated dependencies [c22750c]
  - ai@7.0.0-canary.122

## 1.0.0-canary.67

### Patch Changes

- Updated dependencies [2427d88]
- Updated dependencies [5588abd]
- Updated dependencies [6dd6b83]
  - ai@7.0.0-canary.121

## 1.0.0-canary.66

### Patch Changes

- Updated dependencies [5463d0d]
  - @ai-sdk/provider@4.0.0-canary.16
  - ai@7.0.0-canary.120

## 1.0.0-canary.65

### Patch Changes

- ai@7.0.0-canary.119

## 1.0.0-canary.64

### Patch Changes

- Updated dependencies [47e65d6]
  - ai@7.0.0-canary.118

## 1.0.0-canary.63

### Patch Changes

- 0c4c275: trigger initial canary release
- Updated dependencies [0c4c275]
  - @ai-sdk/provider@4.0.0-canary.15
  - ai@7.0.0-canary.117

## 1.0.0-beta.62

### Patch Changes

- ai@7.0.0-beta.116

## 1.0.0-beta.61

### Patch Changes

- Updated dependencies [08d2129]
- Updated dependencies [202f107]
  - ai@7.0.0-beta.115

## 1.0.0-beta.60

### Patch Changes

- 18651f6: feat(otel): add opt-in options for supplemental AI SDK attributes on OpenTelemetry spans
- 9bd6512: feat(provider): change file part data property to be tagged with a type and remove the image part type
- 258c093: chore: ensure consistent import handling and avoid import duplicates or cycles
- Updated dependencies [43a6750]
- Updated dependencies [81caa5d]
- Updated dependencies [1f7db50]
- Updated dependencies [9bd6512]
- Updated dependencies [258c093]
- Updated dependencies [6147cdf]
  - ai@7.0.0-beta.114
  - @ai-sdk/provider@4.0.0-beta.14

## 1.0.0-beta.59

### Patch Changes

- 9f0e36c: trigger release for all packages after provenance setup
- Updated dependencies [9f0e36c]
  - ai@7.0.0-beta.113
  - @ai-sdk/provider@4.0.0-beta.13

## 1.0.0-beta.58

### Major Changes

- cf93359: feat(ai): remove/refactor event data sent via callbacks
- 8284dfa: feat(otel): rename OpenTelemetry to LegacyOpenTelemetry
- 116c89f: feat(ai): remove telemetry data from the user-facing event data

### Patch Changes

- 29d8cf4: feat(ai): rename the core-event types
- 1043274: feat(ai): add a ModelCall start/end event
- 152c67c: feat(otel): add a step level span
- e1bfb9c: feat(ai): remove unnecessary data from events
- 64de016: feat(otel): rename GenAIOpenTelemetry to OpenTelemetry
- Updated dependencies [5f3749c]
- Updated dependencies [0a51f7d]
- Updated dependencies [71d3022]
- Updated dependencies [67df0a0]
- Updated dependencies [4181cfe]
- Updated dependencies [51ce232]
- Updated dependencies [cf93359]
- Updated dependencies [befb78c]
- Updated dependencies [29d8cf4]
- Updated dependencies [58a2ad7]
- Updated dependencies [37d69b2]
- Updated dependencies [1043274]
- Updated dependencies [7f59f04]
- Updated dependencies [7677c1e]
- Updated dependencies [116c89f]
- Updated dependencies [f58f9bc]
- Updated dependencies [e1bfb9c]
- Updated dependencies [e87d71b]
- Updated dependencies [9d486aa]
- Updated dependencies [9b0bc8a]
- Updated dependencies [fc92055]
- Updated dependencies [4e095b0]
  - ai@7.0.0-beta.112

## 1.0.0-beta.57

### Major Changes

- 6542d93: feat(ai): change naming nomenclature for `*TelemetryIntegration` to `*Telemetry`

### Patch Changes

- Updated dependencies [f319fde]
- Updated dependencies [1949571]
- Updated dependencies [511902c]
- Updated dependencies [6542d93]
- Updated dependencies [2e98477]
- Updated dependencies [876fd3e]
- Updated dependencies [f32c750]
  - ai@7.0.0-beta.111

## 1.0.0-beta.56

### Patch Changes

- Updated dependencies [72cb801]
  - ai@7.0.0-beta.110

## 1.0.0-beta.55

### Patch Changes

- eea8d98: refactoring: rename tool execution events
- Updated dependencies [ec98264]
- Updated dependencies [eea8d98]
- Updated dependencies [75ef93e]
  - ai@7.0.0-beta.109

## 1.0.0-beta.54

### Patch Changes

- ai@7.0.0-beta.108

## 1.0.0-beta.53

### Patch Changes

- Updated dependencies [350ea38]
  - ai@7.0.0-beta.107

## 1.0.0-beta.52

### Patch Changes

- ai@7.0.0-beta.106

## 1.0.0-beta.51

### Patch Changes

- Updated dependencies [33d099c]
  - ai@7.0.0-beta.105

## 1.0.0-beta.50

### Patch Changes

- Updated dependencies [2a74d43]
  - ai@7.0.0-beta.104

## 1.0.0-beta.49

### Patch Changes

- 382d53b: refactoring: rename context to runtimeContext
- 7bf7d7f: feat(ai): enable:true for telemetry by default
- c3d4019: chore(ai): rename 'TelemetrySettings' to 'TelemetryOptions'
- 083947b: feat(ai): separate toolsContext from context
- Updated dependencies [382d53b]
- Updated dependencies [7bf7d7f]
- Updated dependencies [c3d4019]
- Updated dependencies [083947b]
  - ai@7.0.0-beta.103

## 1.0.0-beta.48

### Patch Changes

- ai@7.0.0-beta.102

## 1.0.0-beta.47

### Patch Changes

- Updated dependencies [4873966]
  - ai@7.0.0-beta.101

## 1.0.0-beta.46

### Patch Changes

- Updated dependencies [add1126]
  - ai@7.0.0-beta.100

## 1.0.0-beta.45

### Patch Changes

- Updated dependencies [2a9c144]
  - ai@7.0.0-beta.99

## 1.0.0-beta.44

### Patch Changes

- ai@7.0.0-beta.98

## 1.0.0-beta.43

### Patch Changes

- Updated dependencies [208d045]
  - ai@7.0.0-beta.97

## 1.0.0-beta.42

### Patch Changes

- ai@7.0.0-beta.96

## 1.0.0-beta.41

### Patch Changes

- Updated dependencies [c4f4b5f]
  - ai@7.0.0-beta.95

## 1.0.0-beta.40

### Patch Changes

- 1582efa: chore(ai): remove the metadata field from the telemetry settings
- Updated dependencies [1582efa]
  - ai@7.0.0-beta.94

## 1.0.0-beta.39

### Patch Changes

- Updated dependencies [bc47739]
  - ai@7.0.0-beta.93

## 1.0.0-beta.38

### Patch Changes

- ai@7.0.0-beta.92

## 1.0.0-beta.37

### Patch Changes

- ai@7.0.0-beta.91

## 1.0.0-beta.36

### Patch Changes

- 1db29c8: feat(ai): break `CallSettings` apart into `LanguageModelCallOptions` and `RequestOptions`
- Updated dependencies [1db29c8]
  - ai@7.0.0-beta.90

## 1.0.0-beta.35

### Patch Changes

- Updated dependencies [ff5eba1]
  - @ai-sdk/provider@4.0.0-beta.12
  - ai@7.0.0-beta.89

## 1.0.0-beta.34

### Major Changes

- ef992f8: Remove CommonJS exports from all packages. All packages are now ESM-only (`"type": "module"`). Consumers using `require()` must switch to ESM `import` syntax.

### Patch Changes

- Updated dependencies [ef992f8]
  - ai@7.0.0-beta.88
  - @ai-sdk/provider@4.0.0-beta.11

## 1.0.0-beta.33

### Patch Changes

- ai@7.0.0-beta.87

## 1.0.0-beta.32

### Patch Changes

- Updated dependencies [5a6f514]
  - ai@7.0.0-beta.86

## 1.0.0-beta.31

### Patch Changes

- Updated dependencies [57bf606]
  - ai@7.0.0-beta.85

## 1.0.0-beta.30

### Patch Changes

- 90e2d8a: chore: fix unused vars not being flagged by our lint tooling
- Updated dependencies [90e2d8a]
  - ai@7.0.0-beta.84

## 1.0.0-beta.29

### Patch Changes

- ai@7.0.0-beta.83

## 1.0.0-beta.28

### Patch Changes

- Updated dependencies [e27ed76]
  - ai@7.0.0-beta.82

## 1.0.0-beta.27

### Patch Changes

- Updated dependencies [2fe1099]
- Updated dependencies [f04adcb]
  - ai@7.0.0-beta.81

## 1.0.0-beta.26

### Patch Changes

- Updated dependencies [3ae1786]
  - ai@7.0.0-beta.80

## 1.0.0-beta.25

### Patch Changes

- Updated dependencies [6866afe]
  - ai@7.0.0-beta.79

## 1.0.0-beta.24

### Patch Changes

- Updated dependencies [f372547]
  - ai@7.0.0-beta.78

## 1.0.0-beta.23

### Patch Changes

- Updated dependencies [2add429]
  - ai@7.0.0-beta.77

## 1.0.0-beta.22

### Patch Changes

- Updated dependencies [fcc6869]
  - ai@7.0.0-beta.76

## 1.0.0-beta.21

### Patch Changes

- Updated dependencies [176466a]
  - @ai-sdk/provider@4.0.0-beta.10
  - ai@7.0.0-beta.75

## 1.0.0-beta.20

### Patch Changes

- Updated dependencies [e311194]
  - ai@7.0.0-beta.74
  - @ai-sdk/provider@4.0.0-beta.9

## 1.0.0-beta.19

### Patch Changes

- ai@7.0.0-beta.73

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [664a0eb]
  - ai@7.0.0-beta.72

## 1.0.0-beta.17

### Patch Changes

- fc15550: feat(otel): add the genAI semantic otel integration
- Updated dependencies [e68be55]
  - ai@7.0.0-beta.71

## 1.0.0-beta.16

### Patch Changes

- ai@7.0.0-beta.70

## 1.0.0-beta.15

### Patch Changes

- Updated dependencies [34bd95d]
- Updated dependencies [008271d]
- Updated dependencies [72223e7]
  - @ai-sdk/provider@4.0.0-beta.8
  - ai@7.0.0-beta.69

## 1.0.0-beta.14

### Patch Changes

- Updated dependencies [b0c2869]
- Updated dependencies [7e26e81]
  - ai@7.0.0-beta.68

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [d1a8bed]
  - ai@7.0.0-beta.67

## 1.0.0-beta.12

### Patch Changes

- ai@7.0.0-beta.66

## 1.0.0-beta.11

### Patch Changes

- ai@7.0.0-beta.65

## 1.0.0-beta.10

### Patch Changes

- ai@7.0.0-beta.64

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [6fd51c0]
  - @ai-sdk/provider@4.0.0-beta.7
  - ai@7.0.0-beta.63

## 1.0.0-beta.8

### Patch Changes

- ai@7.0.0-beta.62

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [c29a26f]
  - @ai-sdk/provider@4.0.0-beta.6
  - ai@7.0.0-beta.61

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [38fc777]
  - ai@7.0.0-beta.60

## 1.0.0-beta.5

### Patch Changes

- ai@7.0.0-beta.59

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [2e17091]
  - ai@7.0.0-beta.58

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [986c6fd]
- Updated dependencies [493295c]
  - ai@7.0.0-beta.57

## 1.0.0-beta.2

### Patch Changes

- ai@7.0.0-beta.56

## 1.0.0-beta.1

### Major Changes

- b3c9f6a: feat(ai): create new opentelemetry package (@ai-sdk/otel)

### Patch Changes

- Updated dependencies [b3c9f6a]
  - ai@7.0.0-beta.55

## 0.0.1-beta.0

### Patch Changes

- 5d0f18e: feat(ai): move opentelemetry to new package
- Updated dependencies [5d0f18e]
  - ai@7.0.0-beta.54
