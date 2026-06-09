package blockrunseedance

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func ptrInt(i int) *int    { return &i }
func ptrBool(b bool) *bool { return &b }

func TestBuildCreateRequest_TextToVideo(t *testing.T) {
	seed := &dto.SeedanceVideoRequest{
		Content:       []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "a neon city"}},
		Resolution:    "720p",
		Duration:      ptrInt(5),
		GenerateAudio: ptrBool(true),
	}
	body := buildBlockrunSeedanceCreateRequest(seed, blockrunExtensions{}, "bytedance/seedance-2.0-fast")
	if body.Prompt != "a neon city" || body.Model != "bytedance/seedance-2.0-fast" {
		t.Fatalf("prompt/model mismatch: %+v", body)
	}
	if body.Resolution != "720p" || body.DurationSeconds == nil || *body.DurationSeconds != 5 {
		t.Fatalf("resolution/duration mismatch: %+v", body)
	}
	if body.GenerateAudio == nil || *body.GenerateAudio != true {
		t.Fatalf("generate_audio should be explicit true: %+v", body)
	}
	if body.ImageURL != "" || body.RealFaceAssetID != "" {
		t.Fatalf("no image/asset expected: %+v", body)
	}
}

// Newly-forwarded upstream-supported params: ratio -> aspect_ratio, seed,
// watermark, return_last_frame must all be carried onto the gateway body.
func TestBuildCreateRequest_ForwardsUpstreamParams(t *testing.T) {
	seed := &dto.SeedanceVideoRequest{
		Content:         []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "a neon city"}},
		Ratio:           "16:9",
		Seed:            ptrInt(42),
		Watermark:       ptrBool(false),
		ReturnLastFrame: ptrBool(true),
	}
	body := buildBlockrunSeedanceCreateRequest(seed, blockrunExtensions{}, "bytedance/seedance-2.0")
	if body.AspectRatio != "16:9" {
		t.Fatalf("ratio should map to aspect_ratio: %q", body.AspectRatio)
	}
	if body.Seed == nil || *body.Seed != 42 {
		t.Fatalf("seed should be forwarded: %+v", body.Seed)
	}
	if body.Watermark == nil || *body.Watermark != false {
		t.Fatalf("watermark should be forwarded (explicit false): %+v", body.Watermark)
	}
	if body.ReturnLastFrame == nil || *body.ReturnLastFrame != true {
		t.Fatalf("return_last_frame should be forwarded: %+v", body.ReturnLastFrame)
	}
}

func TestBuildCreateRequest_ImageToVideoAndAsset(t *testing.T) {
	seed := &dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "wave"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/y.jpg?a=1&b=2"}},
		},
	}
	body := buildBlockrunSeedanceCreateRequest(seed, blockrunExtensions{RealFaceAssetID: "ta_abc"}, "bytedance/seedance-2.0")
	if body.ImageURL != "https://x/y.jpg?a=1&b=2" {
		t.Fatalf("image url mismatch: %q", body.ImageURL)
	}
	if body.RealFaceAssetID != "ta_abc" {
		t.Fatalf("asset id mismatch: %q", body.RealFaceAssetID)
	}
}

func TestValidateSeedanceValues_AssetMutualExclusion(t *testing.T) {
	// image + asset 同时给 → 报错
	err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/y.jpg"}},
		}},
		blockrunExtensions{RealFaceAssetID: "ta_abc"}, "seedance-2.0")
	if err == nil {
		t.Fatal("expected mutual-exclusion error")
	}
}

func TestValidateSeedanceValues_AssetModelRestriction(t *testing.T) {
	// 1.5-pro 不支持 real_face_asset_id → 报错
	err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "hi"}}},
		blockrunExtensions{RealFaceAssetID: "ta_abc"}, "seedance-1.5-pro")
	if err == nil {
		t.Fatal("expected model-restriction error for 1.5-pro asset")
	}
}

func TestValidateSeedanceValues_AssetPrefix(t *testing.T) {
	err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "hi"}}},
		blockrunExtensions{RealFaceAssetID: "abc"}, "seedance-2.0")
	if err == nil {
		t.Fatal("expected ta_ prefix error")
	}
}

// FIX #4/#12: BlockRun Seedance only does text-to-video and single-image-to-video.
// Any video/audio input, a second seed image, or first/last-frame image roles
// must be rejected at submit time (fail fast, before the asset block).
func TestValidateSeedanceValues_RejectsUnsupportedInputs(t *testing.T) {
	text := dto.SeedanceContentItem{Type: dto.SeedanceContentText, Text: "hi"}
	img := func(url, role string) dto.SeedanceContentItem {
		return dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: url}, Role: role}
	}

	cases := []struct {
		name    string
		content []dto.SeedanceContentItem
		wantSub string
	}{
		{
			name:    "video input",
			content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/v.mp4"}}},
			wantSub: "video input is not supported",
		},
		{
			name:    "audio input",
			content: []dto.SeedanceContentItem{text, {Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/a.mp3"}}},
			wantSub: "audio input is not supported",
		},
		{
			name:    "two images",
			content: []dto.SeedanceContentItem{img("https://x/1.jpg", ""), img("https://x/2.jpg", "")},
			wantSub: "only a single seed image is supported",
		},
		{
			name:    "first/last frame roles",
			content: []dto.SeedanceContentItem{img("https://x/1.jpg", dto.SeedanceRoleFirstFrame)},
			wantSub: "first_frame/last_frame image roles are not supported",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSeedanceValues(
				&dto.SeedanceVideoRequest{Content: tc.content},
				blockrunExtensions{}, "seedance-2.0")
			if err == nil {
				t.Fatalf("expected error for %s", tc.name)
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Fatalf("error %q should contain %q", err.Error(), tc.wantSub)
			}
		})
	}
}

// FIX #10: resolution must be validated against the supported set.
func TestValidateSeedanceValues_RejectsBadResolution(t *testing.T) {
	err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{
			Content:    []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "hi"}},
			Resolution: "999p",
		},
		blockrunExtensions{}, "seedance-2.0")
	if err == nil {
		t.Fatal("expected unsupported resolution error")
	}
}

// FIX #4/#10: a plain text request, a single-image request, and a supported
// resolution must all pass validation.
func TestValidateSeedanceValues_AcceptsSupported(t *testing.T) {
	// plain text
	if err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "hi"}}},
		blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("plain text should pass: %v", err)
	}
	// single image + 720p resolution
	if err := validateSeedanceValues(
		&dto.SeedanceVideoRequest{
			Content:    []dto.SeedanceContentItem{{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/1.jpg"}}},
			Resolution: "720p",
		},
		blockrunExtensions{}, "seedance-2.0"); err != nil {
		t.Fatalf("single image + 720p should pass: %v", err)
	}
}

func TestValidateResolution(t *testing.T) {
	// Widened allowlist incl. 540p/1K/2K, case-insensitive.
	for _, r := range []string{"", "360p", "480p", "540p", "720p", "1080p", "1k", "1K", "2k", "2K", "4k", "4K", "720P", "540P"} {
		if err := validateResolution(r); err != nil {
			t.Fatalf("validateResolution(%q) should pass: %v", r, err)
		}
	}
	for _, r := range []string{"999p", "8k", "foo"} {
		if err := validateResolution(r); err == nil {
			t.Fatalf("validateResolution(%q) should fail", r)
		}
	}
}

// droppedSeedanceFields must no longer report the now-forwarded params
// (ratio/seed/watermark/return_last_frame) but must still report the officially
// unsupported ones (camera_fixed/frames/callback_url).
func TestDroppedSeedanceFields(t *testing.T) {
	r := &dto.SeedanceVideoRequest{
		Ratio:           "16:9",
		Seed:            ptrInt(7),
		Watermark:       ptrBool(true),
		ReturnLastFrame: ptrBool(true),
		CameraFixed:     ptrBool(true),
		Frames:          ptrInt(120),
		CallbackURL:     "https://example/cb",
	}
	dropped := droppedSeedanceFields(r)
	got := strings.Join(dropped, ",")
	for _, forwarded := range []string{"ratio", "seed", "watermark", "return_last_frame"} {
		for _, d := range dropped {
			if d == forwarded {
				t.Fatalf("%q is forwarded now and must not be reported as dropped: %v", forwarded, dropped)
			}
		}
	}
	for _, unsupported := range []string{"camera_fixed", "frames", "callback_url"} {
		if !strings.Contains(got, unsupported) {
			t.Fatalf("%q is unsupported and must be reported as dropped: %v", unsupported, dropped)
		}
	}
}

// FIX #9: the upstream client always includes a "prompt" key, even for an
// image-only request where the prompt is empty; the marshaled body must keep it.
func TestBuildCreateRequest_AlwaysSendsPromptKey(t *testing.T) {
	seed := &dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/1.jpg"}},
		},
	}
	body := buildBlockrunSeedanceCreateRequest(seed, blockrunExtensions{}, "bytedance/seedance-2.0")
	if body.Prompt != "" {
		t.Fatalf("expected empty prompt for image-only request, got %q", body.Prompt)
	}
	data, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	if !strings.Contains(string(data), `"prompt"`) {
		t.Fatalf("marshaled body must always contain prompt key: %s", string(data))
	}
}
