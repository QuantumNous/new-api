# MiniMax OpenAI Response Sanitization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix MiniMax OpenAI-format text responses so provider-specific fields do not leak into strict OpenAI clients.

**Architecture:** Keep the fix local to the MiniMax adaptor. MiniMax already delegates text response handling to the OpenAI adaptor; the implementation will force the existing OpenAI DTO formatting path before delegation.

**Tech Stack:** Go 1.22+, Gin test context, `github.com/stretchr/testify/require` and `assert`.

---

### Task 1: Non-Streaming Regression Test

**Files:**
- Modify: `relay/channel/minimax/adaptor_test.go`

- [ ] **Step 1: Write the failing test**

Add a test that sends a MiniMax-style non-streaming response with extra top-level and message fields through `Adaptor.DoResponse`. Assert the recorded response keeps OpenAI fields and omits MiniMax-only fields.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./relay/channel/minimax -run TestDoResponseForOpenAITextStripsMiniMaxFields -count=1`

Expected before implementation: FAIL because `input_sensitive`, `base_resp`, `name`, or `audio_content` appears in the response body.

### Task 2: Streaming Regression Test

**Files:**
- Modify: `relay/channel/minimax/adaptor_test.go`

- [ ] **Step 1: Write the failing test**

Add a streaming test that sends SSE chunks containing MiniMax-only `delta.name`, `delta.audio_content`, and a final chunk containing `choices[].message`. Assert the downstream SSE omits those fields and still emits `[DONE]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./relay/channel/minimax -run TestDoResponseForOpenAIStreamStripsMiniMaxFieldsAndMessage -count=1`

Expected before implementation: FAIL because raw SSE chunks are forwarded with `name`, `audio_content`, or `message`.

### Task 3: Minimal Implementation

**Files:**
- Modify: `relay/channel/minimax/adaptor.go`
- Modify: `relay/channel/openai/relay-openai.go`

- [ ] **Step 1: Force formatting for MiniMax OpenAI text responses**

In `Adaptor.DoResponse`, before delegating to `openai.Adaptor`, set `info.ChannelSetting.ForceFormat = true` when:

- `info.RelayFormat` is `types.RelayFormatOpenAI`
- `info.RelayMode` is `constant.RelayModeChatCompletions`

- [ ] **Step 2: Run targeted tests**

In `OpenaiHandler`, when `forceFormat` is true, clear `simpleResponse.Choices[i].Message.Name` before marshalling the response.

- [ ] **Step 3: Run targeted tests**

Run: `go test ./relay/channel/minimax -count=1`

Expected after implementation: PASS.

### Task 4: Related Verification

**Files:**
- No production edits expected.

- [ ] **Step 1: Run delegated OpenAI handler tests**

Run: `go test ./relay/channel/openai -count=1`

Expected: PASS.

- [ ] **Step 2: Run touched relay package tests**

Run: `go test ./relay/channel/minimax ./relay/channel/openai -count=1`

Expected: PASS.

- [ ] **Step 3: Inspect diff**

Run: `git diff -- relay/channel/minimax/adaptor.go relay/channel/minimax/adaptor_test.go docs/superpowers/specs/2026-07-04-minimax-openai-response-sanitize-design.md docs/superpowers/plans/2026-07-04-minimax-openai-response-sanitize.md`

Expected: Only the planned MiniMax adaptor, tests, and docs changed.
