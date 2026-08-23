package gemini

import "testing"

func TestIsImagenPredictModel(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{"imagen-4.0-generate-001", true},
		{"google/imagen-4.0-generate-001", true},
		{"models/imagen-4.0-fast-generate-001", true},
		{"nano-banana-2", false},
		{"gemini-2.5-pro", false},
	}
	for _, tt := range tests {
		if got := IsImagenPredictModel(tt.model); got != tt.want {
			t.Fatalf("IsImagenPredictModel(%q)=%v, want %v", tt.model, got, tt.want)
		}
	}
}

func TestIsGenerateContentImageModel(t *testing.T) {
	supports := func(model string) bool { return model == "gemini-2.0-flash-exp" }

	tests := []struct {
		model string
		want  bool
	}{
		{"imagen-4.0-generate-001", false},
		{"google/imagen-4.0-generate-001", false},
		{"nano-banana-2", true},
		{"nano banana2", true},
		{"google/nano-banana-2", true},
		{"nano-banana-pro-preview", true},
		{"gemini-3-pro-image", true},
		{"gemini-2.5-flash-image-preview", true},
		{"gemini-2.0-flash-exp", true},
		{"gemini-2.5-pro", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsGenerateContentImageModel(tt.model, supports); got != tt.want {
			t.Fatalf("IsGenerateContentImageModel(%q)=%v, want %v", tt.model, got, tt.want)
		}
	}
}

func TestAspectRatioAndImageSizeMapping(t *testing.T) {
	if got := AspectRatioFromOpenAIImageSize("1792x1024"); got != "16:9" {
		t.Fatalf("aspect ratio=%s", got)
	}
	if got := AspectRatioFromOpenAIImageSize("3:2"); got != "3:2" {
		t.Fatalf("aspect ratio passthrough=%s", got)
	}
	if got := ImageSizeFromOpenAIQuality("hd"); got != "2K" {
		t.Fatalf("quality hd=%s", got)
	}
	if got := ImageSizeFromOpenAIQuality("4K"); got != "4K" {
		t.Fatalf("quality 4K=%s", got)
	}
}
