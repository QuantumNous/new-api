# Task 5 Report: Grok Subscription Image Pass-Through, Header Isolation, Price

## Recovery Note

- Recovered interrupted uncommitted edits in `relay/channel/api_request.go`, `relay/channel/api_request_test.go`, `relay/image_handler.go`, `relay/image_handler_test.go`, `setting/ratio_setting/model_ratio.go`, and `setting/ratio_setting/model_ratio_test.go`.
- No existing Task 5 report or saved RED/GREEN log was present; `.superpowers/sdd/2026-08-20-grok-subscription-media/progress.md` stopped at Task 4.
- Preserved the committed Task 4 debug redaction work. `relay/channel/groksubscription/constants.go` already contained `GrokImageModel` and included it in `DefaultModelList` at base `36a8b94a2993068c10055daaa6856b8f9dae6d3d`, so no Task 5 edit was needed there.

## Changes

- `relay/image_handler.go`
  - Replaced the Codex-only pass-through bypass with `shouldForceImageConversion`.
  - Forces local conversion for both Codex and Grok Subscription image requests even when global or channel pass-through is enabled.
  - Maps non-typed Codex/Grok Subscription conversion failures to local HTTP 400 with skip-retry, preserving typed adaptor errors as-is.

- `relay/image_handler_test.go`
  - Added regression coverage for Grok Subscription image requests under global and channel pass-through flags.
  - The test proves conversion validation still runs and returns local 400 skip-retry for invalid Grok image `response_format`.

- `relay/channel/api_request.go`
  - Disabled Header Override processing for `APITypeGrokSubscription`.
  - This is the accepted hardened behavior: it covers media type 113 and also documents text-path isolation.

- `relay/channel/api_request_test.go`
  - Added text and media regression coverage proving configured Header Override cannot replace `Authorization` or inject CLI/custom headers for Grok Subscription requests.

- `setting/ratio_setting/model_ratio.go`
  - Added default `ModelPrice` for `grok-imagine-image-2.0` at `0.04` USD per image.
  - Left existing Grok video prices unchanged and added no quality/resolution multipliers.

- `setting/ratio_setting/model_ratio_test.go`
  - Added coverage that `grok-imagine-image-2.0` has positive default price, is in the Grok Subscription adaptor known model list, and uses `n` as a single multiplier in the per-call price calculation.

## TDD Evidence

Fresh RED checks were run in a temporary base worktree at `36a8b94a2993068c10055daaa6856b8f9dae6d3d` with the final Task 5 tests copied in:

- `go test ./relay -run 'TestImageHelper.*Grok|TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1`
  - RED: `TestImageHelperGrokPassThroughStillRunsConversionValidation` failed on both global and channel pass-through cases with `status = 500, want 400`.

- `go test ./relay/channel -run 'TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1`
  - RED: `TestGrokSubscriptionHeaderOverrideDisabledForTextAndMedia` failed because `Authorization` became `Bearer override` instead of the adaptor-set OAuth bearer for both text and media.

- `go test ./setting/ratio_setting -run 'Test.*GrokImagineImage' -count=1`
  - RED: `TestGrokImagineImageDefaultPriceModelListAndNMultiplier` failed at the default-price assertion because `grok-imagine-image-2.0` was absent from `defaultModelPrice`.

GREEN checks in the task worktree:

- `go test ./relay -run 'TestImageHelper.*Grok|TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1` passed.
- `go test ./relay/channel -run 'TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1` passed.
- `go test ./setting/ratio_setting -run 'Test.*GrokImagineImage' -count=1` passed.

## Verification

- `gofmt -w relay/image_handler.go relay/image_handler_test.go relay/channel/api_request.go relay/channel/api_request_test.go setting/ratio_setting/model_ratio.go setting/ratio_setting/model_ratio_test.go` completed.
- `git diff --check` passed.
- `go test ./relay -run 'TestImageHelper.*Grok|TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1` passed.
- `go test ./relay/channel -run 'TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1` passed.
- `go test ./setting/ratio_setting -run 'Test.*GrokImagineImage' -count=1` passed.
- `go test ./relay/... -count=1` failed in unrelated packages:
  - `relay/channel/claude`: three OpenAI-to-Claude file-content conversion tests fail.
  - `relay/channel/codex`: `TestConvertImageRequest_RejectsURLResponseFormat` panics in `resolveImageCarrierModel`.
  - `relay/channel/openai`: `TestConvertImageRequest_JimengZhizinanPreservesSupportedExtras` expects `2k` but gets nil.
- The same three unrelated package failures reproduce at base `36a8b94a2993068c10055daaa6856b8f9dae6d3d` with `go test ./relay/channel/claude ./relay/channel/codex ./relay/channel/openai -count=1`, so they are documented as pre-existing and not caused by Task 5.

## Self-Review

- The pass-through bypass is scoped by API type and does not affect non-Codex/non-Grok image channels.
- Typed Grok conversion errors are preserved; non-typed local conversion failures now become local 400 skip-retry as required.
- Header Override suppression is intentionally global for Grok Subscription, with both text and media regression coverage.
- Price change is limited to the new image model; the existing video prices remain unchanged.
- No quality, resolution, or video billing multipliers were added.

## Concerns

- The broader `go test ./relay/... -count=1` suite is not green because of pre-existing failures outside Task 5 scope. Focused Task 5 tests and diff checks pass.
- `relay/channel/groksubscription/constants.go` was listed in the Task 5 brief, but the required model constant and known-list entry were already present at the base commit.
