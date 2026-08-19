# Grok OAuth Before Channel Save

## Context

The Grok Subscription channel currently requires an administrator to save an
empty-key channel before OAuth can begin. The OAuth flow is then bound to that
persisted channel and writes the resulting credential directly to
`Channel.Key`. Codex already supports a simpler creation flow: OAuth can run
before the channel exists, the generated credential is placed in the form, and
the administrator saves the completed channel once.

The Grok Subscription channel does not accept a raw xAI API key. Its key is a
versioned OAuth credential JSON produced either by authorization-code exchange
or refresh-token import. This design does not add API-key compatibility.

## Goals

- Allow Grok OAuth from the create-channel form before a channel ID exists.
- Match the current Codex creation experience: authorize first, then save once.
- Keep the existing callback URL copy/paste step required by xAI's registered
  loopback redirect URI.
- Preserve the existing saved-channel authorization, refresh, and refresh-token
  import behavior.
- Preserve encrypted PKCE verifier storage, hashed state, one-use flow claims,
  expiry, no-store responses, and redacted errors.
- Avoid creating draft or orphaned channels when authorization is cancelled.

## Non-goals

- Automatically capture the `127.0.0.1` callback in the hosted web console.
- Support raw xAI API keys in a Grok Subscription channel.
- Change xAI client ID, scope, redirect URI, PKCE parameters, or token exchange.
- Change the standard xAI/OpenAI-compatible API-key channel path.

## Considered Approaches

### 1. Unbound PKCE flow that returns a form credential — chosen

Permit a Grok PKCE flow with `channel_id = 0`. Completion serializes the OAuth
credential and returns it to the authenticated administrator without writing a
channel. The frontend stores it only in the current form's key field. The
normal create-channel request validates and persists it.

This directly matches Codex, reuses the existing Grok security model, and
creates no persistent channel until the administrator submits the form.

### 2. Create a hidden draft channel before OAuth — rejected

This would preserve the current channel-bound backend flow, but cancellation,
popup blocking, expired flows, and abandoned forms would leave draft channels
that require cleanup and special routing rules.

### 3. Add a separate Grok credential-generator API — rejected

A separate start/complete pair would isolate create mode, but it would duplicate
PKCE validation and token exchange behavior and could drift from saved-channel
reauthorization.

## Backend Design

### Starting a flow

`POST /api/channel/grok/pkce/start` continues to accept `channel_id`.

- `channel_id > 0`: validate that the saved channel exists and is a Grok
  Subscription channel, then create a bound flow as today.
- `channel_id = 0`: create an unbound flow for channel creation without looking
  up or inserting a channel.
- `channel_id < 0` or malformed input: reject the request.

Both modes use the server-owned redirect URI
`http://127.0.0.1:56121/callback` and the same xAI/sub2-compatible parameters.
The flow record stores `ChannelID = 0` for create mode. The verifier remains
encrypted and the state remains hashed.

### Completing a flow

PKCE completion continues to claim the flow once, validate the state in
constant time, decrypt the verifier, exchange the authorization code, and
consume the flow.

Completion returns a result that distinguishes two modes:

- Bound flow (`ChannelID > 0`): persist the serialized credential to the saved
  channel, mark its Grok authentication state active, and return status only.
- Unbound flow (`ChannelID = 0`): serialize the credential and return it as
  `data.key`; do not insert or update a channel or Grok channel-state row.

The complete endpoint remains administrator-only and sets `Cache-Control:
no-store`. Credential values must never be logged or included in error text.

### Saving the new channel

The existing create-channel request receives the generated credential in the
normal `channel.key` field. Existing Grok credential parsing validates it.
When a Grok Subscription channel is created with a valid non-empty credential,
the channel and an `active` Grok channel-state projection are created as one
database transaction so the newly saved channel is immediately routable and does
not display a misleading pending badge.

Creating a Grok channel with an empty key remains supported for administrators
who intentionally want a pending channel and plan to authorize it later.

## Frontend Design

The Grok authorization section is visible in both create and edit mode.

### Create mode

- The Authorize button opens the existing Grok OAuth dialog with no channel ID.
- The dialog retains the current steps: open xAI, copy the final loopback
  callback URL, paste it, and complete authorization.
- On success, `data.key` is placed into React Hook Form state via `setValue`.
- The credential is not displayed in plaintext, copied automatically, written
  to local storage, or sent anywhere until the administrator submits the form.
- The form shows an "Authorized — not saved" status.
- Closing or cancelling the create drawer discards the form credential and
  creates no channel.
- The administrator must still click Create Channel to persist the channel.

### Edit mode

The dialog receives the existing channel ID. Completion continues to persist
the credential server-side, invalidate the channel detail query, and show the
active status. Refresh and refresh-token import are unchanged.

## Error Handling

- Popup blocking keeps the existing copy-authorization-link fallback.
- Invalid callback URLs are rejected before completion.
- Missing, expired, consumed, or state-mismatched flows return sanitized errors.
- Token exchange failures do not populate the form and do not create a channel.
- If final channel creation fails validation, the generated credential remains
  only in the open form so the administrator can correct non-secret fields and
  retry; closing the drawer discards it.
- A failed bound-flow persistence must not be reported as successful.

## Security

- Only authenticated administrators can start or complete the flow.
- PKCE verifier encryption, state hashing, one-use claiming, and ten-minute
  expiry remain unchanged for both modes.
- Returning the serialized credential in create mode is an intentional parity
  decision with Codex. Exposure is limited to the authenticated administrator's
  current form and a no-store response.
- No tokens, verifier, authorization code, or callback URL are logged.
- Saved-channel flows never return the channel credential to the browser.

## Testing

Backend coverage will prove:

- Unbound start accepts `channel_id = 0` and creates no channel.
- Negative channel IDs and invalid bound channel IDs are rejected.
- Unbound completion returns a valid serialized credential, consumes the flow,
  and performs no channel write.
- Bound completion keeps its existing direct-persistence behavior and does not
  return a key.
- State mismatch and replay protections work in both modes.
- Creating a Grok channel with the generated key yields enabled abilities and
  an active authentication-state projection.
- Empty-key pending channel creation remains supported.

Frontend coverage will prove:

- Create mode renders Authorize before a channel ID exists.
- Successful create-mode OAuth writes the returned key into form state and
  shows "Authorized — not saved".
- The key is persisted only through the final create-channel submission.
- Edit mode still invokes the bound flow and refreshes channel status.
- Cancelling create mode leaves no persisted channel-side effects.

## Acceptance Criteria

- An administrator can open a new Grok Subscription channel form, complete
  OAuth, and then create the channel with one final save.
- No placeholder channel is created before that final save.
- The saved channel is immediately active and routable.
- Existing Grok edit, reauthorization, refresh, and import behavior is unchanged.
- Raw xAI API keys remain rejected for Grok Subscription channels.
