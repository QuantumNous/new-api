# HTML/SVG Preview Security and Lightweight Isolation

## User Decision

The user wants finished text-model HTML/SVG artwork, not image generation. After asking about sandbox complexity, the user accepted lightweight browser-native isolation with animation/Canvas support. This does not authorize building additional VM/container infrastructure or promise arbitrary-code-hosting security.

## Sources Consulted

- MDN iframe reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
- MDN Content-Security-Policy reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy

Read during planning using the browser tool. Relevant source statements:

- Without `allow-same-origin`, the embedded resource is treated as a special origin that fails same-origin checks, potentially preventing storage/cookie/API access.
- `allow-scripts` permits embedded script execution but does not itself allow popups.
- Top navigation, forms, downloads, and storage permissions are independent sandbox capabilities; do not grant them for previews.
- `srcdoc` uses `about:srcdoc`, and relative URLs use the embedding document's URL as the base. Therefore omitting an explicit external URL does not make model-generated relative resource references safe.
- CSP `default-src` is a fallback for fetch directives; `connect-src` controls script-interface loads. Those rules are not a categorical guarantee against every document self-navigation.
- Multiple CSP policies only further restrict a document; an extra policy cannot loosen an already-enforced trusted policy. Trusted policy placement and browser support still need testing.

## Repository Implications

`web/src/components/html-content.tsx:86` forbids scripts for generic rich content. Do not alter that global component to support IQ artifacts. Use a dedicated preview component and policy builder.

The parent application holds authenticated state. Do not place model markup in the application document, include tokens/user data in frame content, grant `allow-same-origin`, or honor arbitrary iframe `postMessage` requests. Artifact retrieval is an authenticated API operation performed by the parent; the frame only receives the selected artwork string.

Normalization/extraction must not fetch external links, invoke model-provided tools, or treat arbitrary `/mnt/...` file paths as local project paths. Use bounded parsing without loading network resources. Fenced HTML/SVG and full HTML containing nested SVG are expected inputs.

## Required Verification

- Direct and fenced HTML/SVG render, with self-contained Canvas/JavaScript and CSS animations.
- Frame cannot read `parent.document`, host storage, tokens, or privileged app data.
- External script/image/style/font/fetch/frame/worker/resource loads are blocked under the trusted policy; inline/data assets intended for the artwork still work.
- No popup/top-navigation/forms/download/storage permissions; no model-supplied CSP/base/refresh metadata that weakens the trusted wrapper.
- Main application remains the owner of dialogs, routing, and authentication; arbitrary frame messages cannot trigger privileged host requests.
- No publicly accessible HTML artifact URL or same-origin raw HTML response that bypasses parent-side isolation.

## Explicit Limitations

A browser iframe sandbox is an origin/capability boundary, not a CPU/memory quota or a hardened VM. With active scripts, do not claim guaranteed termination, zero browser impact, or universal prevention of every self-navigation/outbound request. External-subresource controls and parent-credential isolation are testable goals; a complete network air gap would be a stronger, separately scoped requirement.

If these boundaries cannot be demonstrated in the target browsers, stop and surface the limitation. Do not quietly render model HTML unsandboxed as a fallback. Stronger infrastructure or disabling active JavaScript would require a new product decision.
