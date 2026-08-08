# OIDC Discovery Backend Proxy Design

## Problem

The global OIDC settings form fetches the configured Well-Known URL directly
from the browser when the form is saved. When the identity provider does not
allow the dashboard origin through CORS, endpoint discovery fails before any
settings are persisted.

The custom OAuth provider flow already exposes a root-only backend endpoint at
`POST /api/custom-oauth-provider/discovery`. The endpoint validates the target
URL, fetches the discovery document from the server, parses the JSON response,
and returns it to the authenticated administrator.

## Design

Promote the existing frontend discovery request and its response type from the
custom OAuth submodule to a shared authentication module. Both the global OIDC
settings form and the custom OAuth provider form will call the same shared
client function.

The global OIDC save flow will:

1. Keep the existing `http://` or `https://` validation for the Well-Known URL.
2. Send the URL to the existing same-origin backend discovery endpoint.
3. Require a successful API response containing a discovery document.
4. Map `authorization_endpoint`, `token_endpoint`, and `userinfo_endpoint` to
   the corresponding global OIDC settings.
5. Persist the settings only after discovery succeeds.

No new backend route or database change is required. The existing RootAuth
middleware continues to restrict discovery requests to root administrators.

## Error Handling

Network failures, rejected URLs, non-successful upstream responses, malformed
JSON, and missing discovery data all stop the save operation. The form keeps
its current values and shows the existing localized failure notification.

The browser will no longer contact the identity provider directly, so the
provider does not need to allow the dashboard origin through CORS.

## Testing

Add focused frontend coverage for the shared discovery request and endpoint
mapping behavior. Verify that the request targets the same-origin backend API
and that the three supported endpoint fields are populated from the returned
document.

Run the affected frontend tests, TypeScript type checking, lint, and the
production build.

## Out Of Scope

- Adding or changing identity-provider CORS headers.
- Creating another discovery endpoint.
- Changing the OIDC login or token exchange flow.
- Changing backend discovery URL validation or network-access policy.
