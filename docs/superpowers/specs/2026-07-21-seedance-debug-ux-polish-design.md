# Seedance Debug Page UX Polish — Design

**Date:** 2026-07-21  
**Scope:** `web/default/public/seedance-debug.html` and `web/classic/public/seedance-debug.html` only  
**Non-goals:** Backend auth middleware changes, React main app, generation protocol, history panel redesign

## Decisions

| Topic | Choice |
|-------|--------|
| Reference asset layout | B — horizontal thumbnails with tag + upload status |
| Model help affordance | A — `?` icon beside model `<select>`, hover tooltip |
| Login flow | Approach 2 — probe local session markers, then fetch user |

## 1. Auth (probe → fetch)

**Problem:** `siteApi` calls `/api/user/self` with cookies only. `UserAuth` requires `New-Api-User`, so requests fail with「未提供 New-Api-User」and the UI hangs on「检测登录中…」.

**Flow:**
1. Probe `localStorage.uid` (same key as main app). No network.
2. Missing uid → guest UI immediately.
3. Present uid → `GET /api/user/self` with `New-Api-User` + `credentials: include`, ~3s timeout.
4. Success → load tokens / session key (same header).
5. Failure / timeout → guest with status message.
6. `loadPlazaModels` runs in parallel with auth (does not await auth).

All logged-in `siteApi` calls attach `New-Api-User` when uid is available.

## 2. Reference assets UI

- `#assetList`: horizontal flex + overflow-x scroll.
- Card (~88px): thumbnail, `@图片N` / `@视频N`, status text; audio shows kind placeholder.
- Top-right circular `×` calls existing `removeAsset`.
- Keep small `@` insert-into-prompt control.
- Click thumbnail (not `×` / `@`) opens asset lightbox (image / video / audio info). Esc / backdrop / close dismisses. Prefer extending or sibling modal to existing `#previewModal`.

## 3. Model help

- Remove always-visible `#modelHint` block.
- Place circular `?` to the right of the model select.
- Hover/focus shows tooltip with plaza description + profile hint (same content as former hint).
- Style aligned with existing `.face-pass .tip` hover pattern.

## Acceptance

- Logged-in users with `uid` in localStorage authenticate without New-Api-User errors; guests appear quickly when uid is absent.
- Assets scroll horizontally; delete via corner `×`; click enlarges.
- Model help only appears on `?` hover; no permanent help strip under the select.
- default and classic public copies stay identical for this page.
