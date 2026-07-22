# OpenAI / Sora Face-Pass Implementation Plan

> **For agent:** Implement task-by-task. Spec: `docs/superpowers/specs/2026-07-22-openai-sora-face-pass-design.md`

**Goal:** Channel-level face-pass for OpenAI(1) + Sora(55), default on; extract shared `facepass` package; MegaByAI migrates to it.

**Architecture:** New `relay/channel/task/facepass` holds preprocess + Face API upload + image collection helpers. MegaByAI adaptor calls it and still writes `referenceImages`. Sora adaptor reads `openai_face_*` settings and rewrites JSON/multipart image fields before upstream.

**Tech Stack:** Go (Gin), existing megabyai face-pass patterns, classic Semi UI + default React channel forms, `common.Marshal`/`Unmarshal`.

---

### Task 1: Extract `relay/channel/task/facepass` + migrate megabyai

**Files:**
- Create: `relay/channel/task/facepass/options.go` — Options, Enabled helpers (generic, not channel-prefixed)
- Create: `relay/channel/task/facepass/preprocess.go` — move from megabyai `image_preprocess.go`
- Create: `relay/channel/task/facepass/apply.go` — upload + apply pipeline; accept configurable URL body keys + output writer callback OR return processed URLs
- Create: `relay/channel/task/facepass/multipart.go` — collectMultipartImageBlobs
- Create: matching `*_test.go` (move/adapt megabyai tests)
- Modify: `relay/channel/task/megabyai/face_pass.go` — thin wrappers calling facepass; keep `megabyaiFacePassEnabled` reading `MegabyaiFace*` DTO
- Modify: `relay/channel/task/megabyai/adaptor.go` — still call local wrappers
- Delete or gut: megabyai `image_preprocess.go` if fully moved

**API shape (recommended):**

```go
package facepass

type Options struct {
	SingleEye bool
	Size      int // clamped 1–10
}

func Apply(body map[string]interface{}, fileBlobs [][]byte, proxy string, opts Options, urlKeys []string, logPrefix string) (outURLs []string, err error)
func CollectImageURLs(body map[string]interface{}, keys []string) []string
func CollectMultipartImageBlobs(form *multipart.Form, keys []string) ([][]byte, error)
```

Caller decides how to write `outURLs` back (megabyai → `referenceImages`; sora → `images` / rebuild multipart).

**Verify:**
```bash
go test ./relay/channel/task/megabyai/ ./relay/channel/task/facepass/ -count=1
```

---

### Task 2: DTO + sora wire-up

**Files:**
- Modify: `dto/channel_settings.go` — add `OpenaiFacePass *bool`, `OpenaiFaceSingleEye *bool`, `OpenaiFaceSize *int`
- Modify: `relay/channel/task/sora/adaptor.go` — store facePass/opts/proxy on TaskAdaptor; in `BuildRequestBody` after model/duration sync, if facePass && has images → facepass.Apply → rewrite
- Create: `relay/channel/task/sora/face_pass.go` — settings readers + JSON/multipart rewrite helpers
- Create: `relay/channel/task/sora/face_pass_test.go` — default on/off; JSON images replaced; skip when empty

**JSON rewrite:** collect from `images`, `input_reference`, `image`, `referenceImages`; after success write primary key that existed (prefer `images` if array, else `input_reference` string if single); remove other alias keys that were consumed.

**Multipart rewrite:** collect blobs from `input_reference` / `image` / `images` / `file`; if blobs or URL fields present and pass on → process → rebuild multipart: for each processed URL download bytes OR keep WebP from pipeline if Apply returns bytes; simplest path matching megabyai: Apply returns URLs, then for OpenAI multipart either (a) convert to JSON with `images` URLs if upstream accepts, or (b) re-download URLs into file parts. Prefer (b) keep Content-Type multipart when inbound was multipart, putting first image as `input_reference` and extras as `images` URL fields if needed. Seedance OpenAI family uses JSON `images` URLs heavily — ensure JSON path is solid first; multipart file → process → rewrite as JSON `images` only if that matches common upstream (check: sora currently passes multipart through). Safer: rebuild multipart with processed image bytes as `input_reference` (download from face URL).

**Verify:**
```bash
go test ./relay/channel/task/sora/ ./relay/channel/task/facepass/ -count=1
```

---

### Task 3: classic + default channel UI

**Files:**
- Modify: `web/classic/src/components/table/channels/modals/EditChannelModal.jsx` — defaults, load/save, UI for type 1 and 55 (mirror megabyai block)
- Modify: `web/default/src/features/channels/lib/channel-form.ts` — schema + defaults + parse/serialize
- Modify: `web/default/src/features/channels/types.ts`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx` — show when type 1 or 55
- Modify: i18n locales as needed (`en.json` / `zh.json` at minimum; run `bun run i18n:sync` if project expects)

**Verify:** Manual — open channel edit for OpenAI/Sora, see three controls; save and reload persists.

---

### Task 4: Spec status + smoke checklist

- Update design doc status to「实现中/已实现」when done
- Smoke: channel on + image → logs `[openai_face_pass]`; channel off → original URLs upstream

---

### Out of scope

- Request-level face_pass param
- remix face-pass
- Changing Face API base URL
