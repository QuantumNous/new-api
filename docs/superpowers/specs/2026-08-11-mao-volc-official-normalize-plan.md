# Mao Volc Official Content Normalize Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect VolcEngine official `content[]` video requests on mao channel and convert them into catertx flat fields, reading `role` for first_frame / last_frame / reference_images.

**Architecture:** New `volc_normalize.go` in `relay/channel/task/mao/` (patterned on 7tai, but role-aware). Hook before `buildUpstreamPayload` in `BuildRequestBody`. Delete `content` after convert. Keep resolution for adaptive model mapping.

**Tech Stack:** Go, gjson, gin, `common.SysLog`, existing mao payload builder.

**Spec:** `docs/superpowers/specs/2026-08-11-mao-volc-official-normalize-design.md`

---

### Task 1: volc_normalize helpers + unit tests (TDD)

**Files:**
- Create: `relay/channel/task/mao/volc_normalize.go`
- Create: `relay/channel/task/mao/volc_normalize_test.go`

**Step 1: Write failing tests**

```go
package mao

import (
	"encoding/json"
	"testing"
)

func TestIsVolcOfficialContent(t *testing.T) {
	ok := []byte(`{"content":[{"type":"text","text":"hi"}]}`)
	if !isVolcOfficialContent(ok) {
		t.Fatal("expected true")
	}
	bad := []byte(`{"content":[{"type":"other"}]}`)
	if isVolcOfficialContent(bad) {
		t.Fatal("expected false")
	}
}

func TestNormalizeVolcOfficialInBodyMap_Roles(t *testing.T) {
	raw := []byte(`{
	  "model":"guanzhuan-seedance2.0",
	  "content":[
	    {"type":"text","text":"run"},
	    {"type":"image_url","role":"first_frame","image_url":{"url":"https://a/first.jpg"}},
	    {"type":"image_url","role":"last_frame","image_url":{"url":"https://a/last.jpg"}},
	    {"type":"image_url","role":"reference_image","image_url":{"url":"https://a/ref.png"}},
	    {"type":"video_url","video_url":{"url":"https://a/v.mp4"}},
	    {"type":"audio_url","audio_url":{"url":"https://a/a.mp3"}}
	  ],
	  "resolution":"1080p"
	}`)
	var body map[string]interface{}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	if body["prompt"] != "run" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
	if body["image"] != "https://a/first.jpg" {
		t.Fatalf("image=%v", body["image"])
	}
	if body["last_frame"] != "https://a/last.jpg" {
		t.Fatalf("last_frame=%v", body["last_frame"])
	}
	md, _ := body["metadata"].(map[string]interface{})
	refs, _ := md["reference_images"].([]interface{})
	if len(refs) != 1 || refs[0] != "https://a/ref.png" {
		t.Fatalf("refs=%v", refs)
	}
	if body["generate_audio"] != true {
		t.Fatalf("generate_audio=%v", body["generate_audio"])
	}
	if md["watermark"] != false && body["watermark"] != false {
		// watermark may be top-level or metadata — accept either per impl, but default false must be present
	}
	if _, ok := body["content"]; ok {
		t.Fatal("content should be deleted")
	}
	if body["resolution"] != "1080p" {
		t.Fatal("resolution must be preserved")
	}
}

func TestNormalizeVolcOfficialInBodyMap_NoRoleImageGoesToReference(t *testing.T) {
	raw := []byte(`{"content":[{"type":"image_url","image_url":{"url":"https://a/x.png"}}]}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	normalizeVolcOfficialInBodyMap(body, raw)
	md, _ := body["metadata"].(map[string]interface{})
	refs, _ := md["reference_images"].([]interface{})
	if len(refs) != 1 {
		t.Fatalf("refs=%v", refs)
	}
}

func TestNormalizeVolcOfficialInBodyMap_KeepsExistingPrompt(t *testing.T) {
	raw := []byte(`{"prompt":"keep","content":[{"type":"text","text":"new"}]}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	normalizeVolcOfficialInBodyMap(body, raw)
	if body["prompt"] != "keep" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
}

func TestNormalizeVolcOfficialInBodyMap_NonVolcNoop(t *testing.T) {
	raw := []byte(`{"prompt":"x","image":"https://a.jpg"}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	if normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("should not normalize")
	}
}
```

Adjust watermark assertion to match chosen storage (prefer set top-level `watermark=false` and `generate_audio=true` so existing `buildUpstreamPayload` merges generate_audio into metadata; also merge watermark into metadata in normalize OR set `metadata.watermark`).

**Recommended impl for flags:** set top-level `generate_audio` / `watermark` on body; extend `buildUpstreamPayload` to also merge top-level `watermark` into metadata (if not already). Check payload.go — currently only merges `generate_audio`. Add watermark merge in Task 2 if needed.

**Step 2:** `go test ./relay/channel/task/mao/ -count=1 -run Volc` expect FAIL

**Step 3: Implement `volc_normalize.go`**

```go
type volcNormalized struct {
	Prompt            string
	FirstFrame        string
	LastFrame         string
	ReferenceImages   []string
	VideoURLs         []string
	AudioURLs         []string
	GenerateAudio     bool
	Watermark         bool
	HasGenerateAudio  bool // true if top-level key present in raw
	HasWatermark      bool
}

func isVolcOfficialContent(raw []byte) bool // same as 7tai
func extractVolcMediaURL(...) string      // same as 7tai
func parseVolcOfficialContent(raw []byte) *volcNormalized // READ role
func normalizeVolcOfficialInBodyMap(body map[string]interface{}, raw []byte) bool
```

`parseVolcOfficialContent` role rules:
- `first_frame` → FirstFrame
- `last_frame` → LastFrame  
- `reference_image` or empty/other → ReferenceImages
- GenerateAudio default true; Watermark default false; if raw has keys, use values

`normalizeVolcOfficialInBodyMap`:
- if !isVolcOfficial → false
- apply fields to body map
- ensure metadata map for reference_images / watermark
- delete content
- SysLog with counts
- return true

**Use gjson** like 7tai. For writing body map use plain maps. Prefer `common` only if marshaling needed.

**Step 4:** tests PASS

**Step 5: Commit**

```bash
git add relay/channel/task/mao/volc_normalize.go relay/channel/task/mao/volc_normalize_test.go
git commit -m "feat: mao volc official content normalize helpers"
```

---

### Task 2: Hook into BuildRequestBody + watermark merge

**Files:**
- Modify: `relay/channel/task/mao/adaptor.go`
- Modify: `relay/channel/task/mao/payload.go` (merge top-level watermark into metadata)
- Optional test: integration-style test calling buildUpstreamPayload after normalize

**Step 1: In BuildRequestBody** after `readRequestBodyMap`:

```go
body, err := readRequestBodyMap(c)
// ...
if raw, err := ... from storage; err == nil {
    normalizeVolcOfficialInBodyMap(body, raw)
} else {
    // try remarshal body as raw for detect
    if b, e := common.Marshal(body); e == nil {
        normalizeVolcOfficialInBodyMap(body, b)
    }
}
```

Simplest: always `common.Marshal(body)` after read as raw for detect (body already parsed). Or read storage bytes first:

```go
var raw []byte
if storage, err := common.GetBodyStorage(c); err == nil {
    raw, _ = storage.Bytes()
}
body, err := readRequestBodyMap(c)
...
if len(raw) > 0 {
    normalizeVolcOfficialInBodyMap(body, raw)
}
```

**Step 2: payload.go** — merge top-level `watermark` into metadata like `generate_audio`:

```go
if v, ok := cloned["watermark"]; ok {
    if md == nil { md = map[string]interface{}{} }
    md["watermark"] = v
}
```

**Step 3:** Add test that normalize + buildUpstreamPayload yields `sd-2-0-1080p` and no content.

**Step 4:** `go test ./relay/channel/task/mao/ -count=1`

**Step 5: Commit**

```bash
git commit -m "feat: wire mao volc normalize into BuildRequestBody"
```

---

### Task 3: Final verify

```bash
go test ./relay/channel/task/mao/ -count=1
go build -o NUL .
```

Manual: POST volcano-style JSON to `/v1/video/generations` with mao channel; confirm upstream body has flat fields and mapped model.

---

## Notes

- Do not force resolution tiers.
- Do not touch 83zi/7tai.
- JSON via `common.Marshal` when cloning/writing business JSON.
- Multipart path: no volc normalize (ValidateMultipartDirect still OK for non-volc).
