package dto

import "testing"

func TestGeminiFlashImageResolutionPriceRatio(t *testing.T) {
	t.Parallel()
	cases := map[string]float64{
		"":      1.0,
		"0.5K":  1.0,
		"1k":    1.0,
		"2K":    4.0 / 3.0,
		"4k":    2.0,
	}
	for res, want := range cases {
		if got := GeminiFlashImageResolutionPriceRatio(res); got != want {
			t.Fatalf("GeminiFlashImageResolutionPriceRatio(%q) = %v, want %v", res, got, want)
		}
	}
}

func TestImageRequestGetTokenCountMeta_geminiFlashImage(t *testing.T) {
	t.Parallel()
	req := &ImageRequest{
		Model:      "gemini-3.1-flash-image-preview",
		Prompt:     "test",
		Resolution: "2K",
	}
	meta := req.GetTokenCountMeta()
	if meta.ImagePriceRatio != 4.0/3.0 {
		t.Fatalf("expected 2K ratio 4/3, got %v", meta.ImagePriceRatio)
	}
}
