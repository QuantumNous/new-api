# Authenticated IQ Gallery and Active Previews

## 1. Scope / Trigger

Use for `features/iq-tests`, `/iq-tests`, both console navigation modes, active
HTML/SVG previews and IQ administration. Do not change generic HtmlContent.

## 2. Signatures

- `IQTestsPage` lives under the authenticated route, not operator-only routing.
- `useIQViewerScope()` keys user ID, session ID, role, group and permissions;
  `iqKeys.artifact(scope, result)` includes stable pair ID and result revision.
- `buildIQPreviewDocument(artifact)` builds the trusted opaque-frame document.
- `IQ_PREVIEW_SANDBOX = 'allow-scripts'`; `MAX_LIVE_IQ_PREVIEWS = 4`.
- Configuration uses a complete versioned PUT; result/artifact DTOs are owned
  by `types.ts` and `api.ts`. API timestamps are Unix seconds.

## 3. Contracts

- Authentication/permission changes synchronously remount the gallery subtree;
  remove old scope queries on unmount. Never retain another viewer's document.
  Stable result IDs are insufficient cache keys: include task/version/completion.
- Fetch list metadata once per page (poll every 10 seconds while foreground).
  Fetch artifacts lazily for visible cards or the open preview. Compare artifact
  revisions against metadata and fail closed on replacement races.
- Preserve the date/status of old results during a pending/running replacement.
  Members see only backend-authorized groups and no configuration/run controls;
  administrators additionally follow channel RBAC capabilities.
- Never append generated nodes to the host or pass app tokens/user data into
  them. Parse into an inert template, remove untrusted base/meta/forms/frames,
  external scripts and static resource URLs. Preserve self-contained scripts,
  Canvas, SVG references and animations. Do not implement privileged message
  handlers for model code.
- The trusted CSP must precede ALL generated markup/attributes:
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
  img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none';
  object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'`.
- Use iframe srcDoc with sandbox=allow-scripts and referrerPolicy=no-referrer;
  never add allow-same-origin, popups, top navigation, forms or downloads.
  Unmount offscreen/hidden/closed previews; dialogs/settings pause card frames.
- This is NOT a hostile-code VM or a complete network air gap. Scripts may
  consume resources or navigate their own frame. A local browser probe observed
  a dynamic download link falling back to self-navigation; no download sandbox
  capability was granted. Do not misreport this as universal egress prevention.
- Retain exact prompt whitespace and edits after recoverable/stale save errors.
  Daily uses Beijing time. Give interval/daily branches distinct React keys so
  native number/time inputs and react-hook-form refs are not incorrectly reused
  and values survive mode round trips. Render errors accessibly.
- All copy uses English source keys and seven locales. Locale writes go through
  add-missing-keys.mjs and i18n:sync; benchmark prompt data is not UI translation.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Anonymous protected route | Sign-in redirect retaining /iq-tests |
| Session/account/group/permissions change | Unmount old artwork/forms/dialogs |
| Artifact revision mismatch or fetch failure | Honest unavailable state |
| Metadata error | Hide active frames; retryable error, no stale success |
| Config 409 | Preserve edits; require explicit reload/reconciliation |
| Expanded preview | One frame; card frames paused; accessible close lifecycle |
| Mobile viewport | No document overflow; settings fit viewport |
| Model self-navigation / CPU abuse | Document limitation; never claim full isolation |

## 5. Good / Base / Bad Cases

- Good: JSON artifact fetch -> trusted wrapper -> opaque-origin iframe.
- Base: prior terminal artwork remains clearly dated while another run is active.
- Bad: dangerouslySetInnerHTML in the app, tokens in srcDoc, unbounded iframes,
  or reusing another user's artifact cache after an account change.

## 6. Tests Required

- `preview-document.test.ts`: policy ordering, unsafe nodes/URLs, Canvas/SVG
  preservation and size bound; jsdom is construction evidence, not isolation.
- `gallery.test.tsx`: admin/member controls, lazy bounded previews and expanded
  lifecycle, current status, account changes and artifact revision mismatches.
- `settings.test.tsx`: exact prompt/targets/schedule save, mode round-trip values,
  stale-save input preservation and explicit discard/reload.
- `localization.test.ts`: all static/dynamic feature keys in seven locales.
- One local mock-backed browser smoke: real Canvas/SVG render, blocked parent
  DOM/storage/cookies, subresource/fetch/worker/popup/top/form attempts, mobile
  layout, anonymous redirect and member controls. Inspect residual navigation
  honestly instead of asserting a nonexistent universal no-network guarantee.

## 7. Wrong vs Correct

```tsx
// Wrong: granting origin access defeats the credential boundary.
<iframe sandbox='allow-scripts allow-same-origin' srcDoc={artifact} />

// Correct: only the dedicated builder owns the trusted document/policy.
<iframe sandbox='allow-scripts' referrerPolicy='no-referrer'
  srcDoc={buildIQPreviewDocument(artifact)} />
```
