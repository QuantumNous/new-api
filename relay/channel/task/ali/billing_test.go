package ali

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestProcessAliOtherRatios_UsesHardcodedFallback(t *testing.T) {
	ratio_setting.InitRatioSettings()

	// Test with no config override — should use hardcoded values
	req := &AliVideoRequest{
		Model: "wan2.5-t2v-preview",
		Parameters: &AliVideoParameters{
			Resolution: "720P",
		},
	}

	ratios, err := ProcessAliOtherRatios(req)
	if err != nil {
		t.Fatalf("ProcessAliOtherRatios returned error: %v", err)
	}

	if got := ratios["resolution-720P"]; got != 2 {
		t.Fatalf("resolution-720P ratio = %v, want 2", got)
	}
}

func TestProcessAliOtherRatios_InvalidSize(t *testing.T) {
	ratio_setting.InitRatioSettings()

	req := &AliVideoRequest{
		Model: "wan2.5-t2v-preview",
		Parameters: &AliVideoParameters{
			Size: "9999*9999", // invalid size
		},
	}

	_, err := ProcessAliOtherRatios(req)
	if err == nil {
		t.Fatal("expected error for invalid size, got nil")
	}
}

func TestProcessAliOtherRatios_UnknownModel(t *testing.T) {
	ratio_setting.InitRatioSettings()

	req := &AliVideoRequest{
		Model: "unknown-model-v1",
		Parameters: &AliVideoParameters{
			Resolution: "720P",
		},
	}

	ratios, err := ProcessAliOtherRatios(req)
	if err != nil {
		t.Fatalf("ProcessAliOtherRatios returned error: %v", err)
	}

	// Unknown model — no resolution entry
	if got := ratios["resolution-720P"]; got != 0 {
		t.Fatalf("resolution-720P ratio = %v, want 0 (unknown model)", got)
	}
}

func TestProcessAliOtherRatios_UsesConfigOverride(t *testing.T) {
	ratio_setting.InitRatioSettings()

	// Set a config override for wan2.5-t2v-preview
	jsonStr := `{"wan2.5-t2v-preview": {"480P": 1, "720P": 5, "1080P": 10}}`
	if err := ratio_setting.UpdateVideoResolutionRatioByJSONString(jsonStr); err != nil {
		t.Fatalf("failed to set config: %v", err)
	}

	req := &AliVideoRequest{
		Model: "wan2.5-t2v-preview",
		Parameters: &AliVideoParameters{
			Resolution: "720P",
		},
	}

	ratios, err := ProcessAliOtherRatios(req)
	if err != nil {
		t.Fatalf("ProcessAliOtherRatios returned error: %v", err)
	}

	// Config override should be used instead of hardcoded value (2)
	if got := ratios["resolution-720P"]; got != 5 {
		t.Fatalf("resolution-720P ratio = %v, want 5 (config override)", got)
	}
}

func TestVideoResolutionRatio_DefaultValues(t *testing.T) {
	ratio_setting.InitRatioSettings()

	// Verify default values exist
	ratios, ok := ratio_setting.GetVideoResolutionRatio("wan2.5-t2v-preview")
	if !ok {
		t.Fatal("wan2.5-t2v-preview not found in default VideoResolutionRatio")
	}
	if ratios["480P"] != 1 {
		t.Fatalf("480P default = %v, want 1", ratios["480P"])
	}
	if ratios["720P"] != 2 {
		t.Fatalf("720P default = %v, want 2", ratios["720P"])
	}

	// Verify unknown model returns false
	_, ok = ratio_setting.GetVideoResolutionRatio("nonexistent-model")
	if ok {
		t.Fatal("nonexistent-model should not be found")
	}
}
