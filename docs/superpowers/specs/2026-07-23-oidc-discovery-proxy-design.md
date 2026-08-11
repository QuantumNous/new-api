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

The discovery URL is administrator-controlled but still becomes a server-side
request target. The endpoint must therefore use the repository's protected
fetch client so the configured SSRF policy is applied both before dialing and
after redirects. Deployments that intentionally use private identity providers
can allow those targets through the existing fetch settings; this flow does not
introduce a separate OIDC-specific allowlist.

## Design

Promote the existing frontend discovery request and its response type from the
custom OAuth submodule to a shared authentication module. Both the global OIDC
settings form and the custom OAuth provider form will call the same shared
client function.

The global OIDC save flow will:

1. Keep the existing `http://` or `https://` validation for the Well-Known URL.
2. Send the URL to the existing same-origin backend discovery endpoint.
3. Require a successful API response containing a discovery document.
4. Require non-empty string values for `authorization_endpoint`,
   `token_endpoint`, and `userinfo_endpoint`.
5. Map those three values to the corresponding global OIDC settings.
6. Persist the settings only after discovery and validation succeed.

No new backend route or database change is required. The existing RootAuth
middleware continues to restrict discovery requests to root administrators.
The backend endpoint will replace its standalone HTTP client with
`service.GetSSRFProtectedHTTPClient`, preserving its request timeout while
reusing the shared URL, DNS, redirect, port, and private-address policy.

## Error Handling

Network failures, SSRF policy rejections, non-successful upstream responses,
malformed JSON, missing discovery data, and missing or blank required endpoint
fields all stop the save operation. The form keeps its current values, does not
invoke the settings mutation, and shows the existing localized failure
notification.

The browser will no longer contact the identity provider directly, so the
provider does not need to allow the dashboard origin through CORS.

## Testing

Add focused frontend coverage for the shared discovery request, validation,
and endpoint mapping behavior. Verify that the request targets the same-origin
backend API and that the three supported endpoint fields are populated from a
complete document. Cover unsuccessful API responses, absent discovery data,
malformed or incomplete endpoint data, and preservation of existing form
values by asserting that the settings mutation is not called on failure.

Add focused backend coverage showing that discovery fetches use the shared
protected client and that rejected targets cannot reach the upstream request
path. Reuse existing SSRF policy fixtures rather than duplicating address
classification rules in controller tests.

Run the affected frontend tests, TypeScript type checking, lint, and the
production build.

## Out Of Scope

- Adding or changing identity-provider CORS headers.
- Creating another discovery endpoint.
- Changing the OIDC login or token exchange flow.
- Adding a separate OIDC-specific SSRF policy or persistence setting.
