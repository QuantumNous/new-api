# Playground Handoff Model Lock Design

Date: 2026-08-10
Status: Approved

## Background

PR #673 made the official model page open the authenticated Playground directly with the source `model` and `prompt`. The direct navigation works, but the Playground model picker remains editable and asynchronous model loading can still replace the handoff selection. The requested behavior is stricter: a model supplied by the model page must remain fixed for that Playground visit, while the prompt must only be placed in the input and must never trigger generation automatically.

## Goals

- Treat a valid `model` query value as the locked model for the current Playground page visit.
- Keep that model selected after the user's model list loads; never fall back to another model.
- Disable model switching while a handoff model is present.
- Put the handoff `prompt` into the input as editable draft text only.
- Preserve fail-closed validation for unknown or unauthorized URL models.

## Non-goals

- Do not auto-submit the prompt or start image, chat, or video generation on page load.
- Do not change backend model authorization.
- Do not change the official website link format introduced by PR #673.
- Do not lock the model for ordinary `/playground` visits that have no handoff model.

## Considered Approaches

### 1. Explicit handoff lock state (selected)

Keep the URL model as explicit handoff state, validate it against the raw user model list, and pass a lock flag to the model picker. Asynchronous loading may validate the model but may not replace it. This directly represents the product requirement and keeps ordinary Playground behavior unchanged.

### 2. Reapply the URL model after every model-list update

An effect could repeatedly overwrite the selected model. This would appear locked but would leave the picker interactive and create visible state churn, so it does not express the intended UI contract.

### 3. Remove the model picker for handoff visits

This is mechanically strong but changes the layout and hides useful context. A disabled picker communicates which model is in use with less UI disruption.

## Design

### Handoff state and validation

The route continues to parse `model` and `prompt`. The Playground seeds its configuration with the trimmed handoff model before asynchronous queries complete. Once the raw user model list is available, the handoff resolver validates the requested model against that list. A valid model remains the selected model and is included in the displayed model options even when chat-oriented filtering would normally hide it, such as `gpt-image-2`.

While validation is pending, submission remains disabled. If the model is unknown or unavailable to the user, the Playground must not select a fallback model and must not send a request. Backend authorization remains the final security boundary.

### Model picker

The Playground input receives an explicit locked state derived from the presence of the handoff model. The model picker remains visible but disabled for the lifetime of that mounted handoff visit. Ordinary Playground visits continue to allow model changes.

### Prompt behavior

The handoff prompt is supplied only as the input's initial editable text. Mounting the route, resolving the model list, or locking the picker must not call any chat, image, or video send function. Generation starts only after the user explicitly submits.

### URL cleanup

Existing one-time handoff search cleanup may remove replay-only query values after they have been consumed. The in-memory handoff model remains authoritative for the current mount, so URL cleanup must not unlock or replace it.

## Testing

- A valid `gpt-image-2` handoff remains selected after asynchronous model data resolves.
- The handoff model picker is disabled; an ordinary Playground picker remains enabled.
- The prompt appears in the input on mount.
- No send or generation function is called merely because the page mounted or model data resolved.
- An unknown or unauthorized handoff model cannot submit and does not fall back to another model.
- Existing explicit user submission still sends the locked model and current edited prompt.

## Deployment and Runtime Impact

This is a console-only frontend change under `web/default`. It does not affect router nodes, the standalone website deployment, backend APIs, shared state, or multi-node coordination. Production requires the `newapi-console` frontend bundle to be built and deployed after merge; router deployment is not required.
