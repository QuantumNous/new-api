# Codex Fast service tier passthrough design

## Goal

Allow Flatkey administrators to opt a Codex OAuth channel (type `57`) into forwarding a client-supplied `service_tier`, including `service_tier: "fast"`, for GPT-5.5 and GPT-5.4 requests.

## Behavior

- The default remains Standard behavior: Flatkey does not inject `service_tier: "fast"` into requests.
- A client must explicitly send `service_tier: "fast"`.
- The Codex OAuth channel must have the existing `allow_service_tier` setting enabled.
- When that setting is disabled, the existing relay field filter continues to remove `service_tier`.
- No broad request-body passthrough is enabled, so unrelated filtered fields remain protected.

## Implementation

The backend already stores `allow_service_tier` in the generic channel settings and uses it when filtering both Chat Completions and Responses request bodies. The Codex adapter does not independently remove `service_tier`.

The missing capability is confined to the default console frontend:

1. `buildSettingsJSON` currently keeps `allow_service_tier` only for OpenAI (type `1`) and Anthropic (type `14`). Extend this allowlist to Codex OAuth (type `57`).
2. The channel drawer currently renders the existing service-tier passthrough switch only for types `1` and `14`. Render the same switch for type `57`.

This is configuration-only state stored in the database, so multi-node operation requires no new coordination mechanism. All router nodes will read the same persisted channel setting through the existing channel configuration path.

## Validation

- Add a Bun unit test that proves both create and update payloads retain `allow_service_tier: true` for channel type `57`.
- Observe the test fail before changing production code, then pass after the allowlist change.
- Run the frontend typecheck and the relevant Go relay compatibility tests.
- Confirm the final diff does not alter the user's existing `relay/channel/api_request*` changes.

## Cost and rollout

Codex Fast is an explicit higher-credit service tier. GPT-5.5 consumes about 2.5x Standard credits and GPT-5.4 about 2x according to the current Codex documentation. Flatkey pricing or quota policy must account for that upstream multiplier before enabling the channel switch broadly.

## Final model decision

Codex OAuth channel type `57` Fast support is limited to `gpt-5.4` and `gpt-5.5` requests that preserve the independent `service_tier: "fast"` field.
