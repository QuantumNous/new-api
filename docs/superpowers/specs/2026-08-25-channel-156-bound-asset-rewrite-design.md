# Channel 156 Bound Asset Rewrite Design

## Goal

Allow a queued Seedance request routed through channel 156 to replace a Flatkey public `asset://` reference with that channel's already-bound upstream asset URI and submit the request normally.

## Root cause

The selected-channel middleware correctly resolves the platform asset ID to the active channel binding. Binding-based providers return `asset://<upstream-asset-id>`, while URL-native providers return a signed HTTPS URL. The ModelAPI Seedance adaptor currently validates every rewrite value as HTTPS-only, so it rejects the binding-based value locally before provider submission.

## Security boundary

The adaptor may accept an upstream asset URI only for as many media occurrences as were actually rewritten from platform asset references through the server-created asset rewrite map. Exact value membership alone is insufficient because another media item in the same request could otherwise smuggle the same URI directly. A client-provided upstream asset URI without matching rewrite provenance remains invalid. Upstream asset URIs must use the exact `asset://` scheme, contain one bounded identifier, and contain no path, userinfo, query, fragment, whitespace, or control characters.

## Data flow

1. The request contains the caller-owned Flatkey public asset ID.
2. Asset resolution validates ownership, readiness, selected target, selected channel, and active binding.
3. The selected-channel middleware stores `public asset URI -> upstream asset URI` in the request context.
4. The ModelAPI adaptor rewrites only matching public references.
5. Validation accepts either HTTPS media or an upstream asset URI backed by one unconsumed rewrite occurrence from the request.
6. The upstream request receives the upstream asset URI; the public ID is never forwarded.

## Compatibility

- URL-native ModelAPI assets continue to use HTTPS rewrites.
- Plain HTTPS media requests are unchanged.
- Direct or malformed `asset://` input remains rejected.
- Other channel adaptors and binding/materialization behavior are unchanged.

## Verification

- A regression test must fail before the fix when the rewrite map contains a valid upstream asset URI.
- The test must pass after the fix and confirm the wire payload contains the upstream URI, not the public asset ID.
- Negative tests must reject direct, malformed, and untrusted upstream asset URIs.
- The affected adaptor, middleware, controller, service, and model tests must pass before deployment.
- Production verification must show create accepted, an upstream task ID persisted, and the task reaches a terminal success state.
