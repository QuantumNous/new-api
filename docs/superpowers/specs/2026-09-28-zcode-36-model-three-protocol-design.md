# ZCode 36-Model Three-Protocol Expansion Design

Date: 2026-09-28

## Goal

Expose one fixed set of 36 text-model identifiers in both ZCode Desktop and
ZCode CLI under all three NewAPI providers:

- Chat: `/v1/chat/completions`
- Responses: `/v1/responses`
- Messages: `/v1/messages`

The work must happen in two ordered phases:

1. Make all 36 identifiers visible in all three ZCode provider lists.
2. Make every identifier genuinely callable through all three protocols.

Phase 1 intentionally permits a temporary state where a visible entry is not
yet callable. Phase 2 closes every such gap before the work is considered
complete.

## Exact Model Set

1. `claude-fable-5-1`
2. `claude-haiku-4-5`
3. `claude-opus-4-6`
4. `claude-opus-4-7`
5. `claude-opus-4-8`
6. `claude-opus-5`
7. `claude-opus-5-5`
8. `claude-sonnet-4-6`
9. `claude-sonnet-5`
10. `deepseek-v4-flash`
11. `deepseek-v4-pro`
12. `deepseekv4.1flash`
13. `deepseekv4.1flash-vision`
14. `doubao-seed-2.0-code`
15. `doubao-seed-2.0-lite`
16. `doubao-seed-2.0-mini`
17. `doubao-seed-2.0-pro`
18. `doubao-seed-2.1-pro`
19. `doubao-seed-2.1-turbo`
20. `doubao-seed-character`
21. `glm-5.1`
22. `glm-5.2`
23. `glm-5.3`
24. `glm-5.3-flash`
25. `gpt-5.5`
26. `gpt-5.6-luna`
27. `gpt-5.6-sol`
28. `gpt-5.6-terra`
29. `gpt-6-astra`
30. `gpt-6-luna`
31. `gpt-6-sol`
32. `grok-4.5`
33. `grok-4.6`
34. `grok-4.7`
35. `kimi-k3`
36. `minimax-m3`

The generic public identifiers `gpt-5.6` and `gpt-6` are not part of this
set. `gpt-5.3-codex-spark` and `doubao-seed-evolving` are explicitly
excluded. Image, video, embedding, 3D, translation, audio, and rerank models
are outside scope.

## Approach

Use a checked, manifest-driven two-stage workflow.

This is preferred over dynamically mirroring `/v1/models`, because the
required physical identifiers include entries that are not currently exposed
as public gateway aliases. It is also preferred over hand-editing the two
ZCode files, because a single manifest makes Desktop and CLI convergence,
idempotence, rollback, and future review testable.

## Phase 1: ZCode Visibility

The synchronizer will treat the exact model set above as its input and update
these existing providers in both ZCode configuration files:

- `newapi-chat`
- `4e71cad5-e14a-4b21-8feb-7727ba10511d`
- `newapi-messages`

The target files are:

- `~/.zcode/v2/config.json`
- `~/.zcode/cli/config.json`

Each provider will contain exactly the same 36 model keys. Existing valid
model metadata will be preserved. Missing metadata will receive the minimum
ZCode language-model defaults already used by the existing synchronizer.
Provider URLs, credentials, headers, the Responses item soft-limit header,
the selected CLI model, and unrelated providers must remain unchanged.

Before writing, the synchronizer will:

1. Parse and validate both files.
2. Verify the three expected provider IDs and kinds.
3. Produce a redacted dry-run diff and expected hashes.
4. Create a private backup of both files.
5. Recheck source hashes immediately before writing.

Writes will be atomic. A partial failure restores both files from the same
backup. A second apply must be a semantic no-op. ZCode will use its normal
provider refresh mechanism; the application will not be patched.

## Phase 2: Real Protocol Support

The gateway will use the same 36-item manifest as the required public
identifier set. For each identifier, a capability record will track:

- exact upstream model identifier;
- audited provider/channel ownership;
- Chat route;
- Responses route;
- Messages route;
- native or converted protocol;
- pricing authority;
- verification state.

Missing protocol routes will be added only when an existing audited provider
can serve that exact physical model. Native routes remain preferred.
Conversion routes may be used only where the existing relay conversion
contract preserves request semantics, streaming, tool calls, usage, billing,
and returned model identity.

No generic `gpt-5.6` or `gpt-6` alias may satisfy a physical-model test.
Requested, mapped, selected-channel, upstream, and returned model identities
must be recorded separately.

An identifier with no authoritative upstream listing, credential-bearing
channel, or pricing fact remains an explicit blocker. The implementation must
not invent an owner, silently map it to a sibling model, or report it as
supported.

## Failure And Safety Rules

- No automatic provider retry during admission tests.
- Never retry an unknown write.
- Treat malformed responses and empty successful text as failures.
- Keep per-protocol support fail-closed.
- Do not remove a target identifier without a new user decision.
- Do not expose credentials, tokens, cookies, raw prompts, or response bodies
  in generated evidence.
- Do not modify or overwrite unrelated dirty worktree files.

Phase 1 changes only local ZCode configuration. Phase 2 may be developed and
verified against a disposable local candidate, but production, v100s, SSH,
registry, workflow dispatch, push, and deployment remain blocked until the
existing Task 9 gate and independent reviews pass.

## Test Strategy

### Synchronizer TDD

Start with failing tests that require:

- exactly 36 model keys in each of the six provider/config combinations;
- removal of generic `gpt-5.6` and `gpt-6`;
- exclusion of non-text models, `gpt-5.3-codex-spark`, and
  `doubao-seed-evolving`;
- preservation of provider options, credentials, headers, selected model,
  and unrelated providers;
- atomic two-file rollback;
- idempotent reapply.

Implement only enough synchronization logic to make those tests pass.

### Phase 1 Verification

- Run the synchronizer in dry-run mode.
- Apply once, verify exact sets and hashes, then apply again as a no-op.
- Refresh ZCode and confirm all three provider lists show 36 entries in both
  Desktop and CLI.
- Restore from backup in a fixture, verify exact bytes, then retain the
  intended applied state.

### Phase 2 Verification

- Generate the protocol matrix directly from the fixed manifest.
- Require 36 Chat, 36 Responses, and 36 Messages profiles.
- Add a failing test before each missing route or conversion repair.
- Run pinned one-attempt canaries for every newly admitted physical model.
- Run the complete 108-profile matrix for three identical rounds.
- Require HTTP success, semantic response validity, exact identity evidence,
  zero unknown writes, reconciled quota/accounting, and no residual test
  resources.

The final result is successful only when all 36 identifiers are both visible
and callable through all three protocols.
