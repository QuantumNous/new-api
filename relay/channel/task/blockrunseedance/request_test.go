package blockrunseedance

import (
	"testing"

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
