package tokenkit

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Unless marked otherwise, want is the per-image prompt-token cost measured
// through upstream usage (request with the image minus the same request
// without it) on 2026-10-07.
func TestImageTokensMatchUpstreamUsage(t *testing.T) {
	for _, tc := range []struct {
		model  string
		w, h   int
		detail string
		want   int
	}{
		// gpt-5.6: auto means original; high scales the shortest side to 768.
		{"gpt-5.6-luna", 200, 200, "", 59},
		{"gpt-5.6-luna", 1000, 1000, "", 1229},
		{"gpt-5.6-luna", 1000, 1000, "auto", 1229},
		{"gpt-5.6-luna", 1000, 1000, "original", 1229},
		{"gpt-5.6-luna", 1000, 1000, "high", 692},
		{"gpt-5.6-luna", 1000, 1000, "low", 308},
		{"gpt-5.6-luna", 200, 200, "high", 59},
		{"gpt-5.6-luna", 2048, 2048, "", 4916},
		{"gpt-5.6-luna", 2048, 2048, "high", 692},
		{"gpt-5.6-luna", 3840, 2160, "", 9793},
		{"gpt-5.6-luna", 3840, 2160, "high", 1239},
		{"gpt-5.6-luna", 3840, 2160, "low", 173},
		{"gpt-5.6-luna", 600, 3000, "", 2144},
		{"gpt-5.6-luna", 600, 3000, "high", 999},
		{"gpt-5.6-luna", 600, 3000, "low", 77},
		{"gpt-5.6-luna", 8000, 500, "", 4801},
		{"gpt-5.6-luna", 8000, 500, "high", 308},
		{"gpt-5.6-luna", 8000, 500, "low", 20},
		{"gpt-5.6-luna", 3000, 2000, "high", 1066},
		{"gpt-5.6-luna", 1170, 2532, "high", 1498},
		{"gpt-5.6-luna", 1600, 1200, "high", 922},
		// gpt-5.5 original is limited to 6000px and 10,000 patches.
		{"gpt-5.5", 8000, 500, "", 2708},
		{"gpt-5.5", 3840, 2160, "", 9793},
		{"gpt-5.5", 2048, 2048, "high", 692},
		// gpt-6-astra high fits within 2048, then applies a 2,500-patch budget.
		{"gpt-6-astra", 1024, 1024, "high", 1229},
		{"gpt-6-astra", 2048, 2048, "high", 3001},
		{"gpt-6-astra", 3840, 2160, "high", 2765},
		{"gpt-6-astra", 1170, 2532, "high", 2305},
		{"gpt-6-astra", 3000, 2000, "high", 2881},
		{"gpt-6-astra", 2048, 2048, "", 4916},
		{"gpt-6-astra", 3840, 2160, "", 9793},
		{"gpt-6-astra", 600, 3000, "", 2144},
		{"gpt-6-astra", 3840, 2160, "low", 173},
		// Tile-based models follow the documented formula.
		{"gpt-4o", 1000, 1000, "", 85 + 170*4},
		{"gpt-4o", 1000, 1000, "low", 85},
		{"gpt-5.1", 200, 200, "high", 70 + 140},
		// Claude: ceil(w/28) x ceil(h/28) after the tier resize, plus framing.
		{"claude-haiku-4-5", 200, 200, "", 68},
		{"claude-haiku-4-5", 1000, 1000, "", 1300},
		{"claude-haiku-4-5", 1092, 1092, "", 1525},
		{"claude-haiku-4-5", 1920, 1080, "", 1564},
		{"claude-haiku-4-5", 1075, 1520, "", 1555},
		{"claude-haiku-4-5", 2000, 1500, "", 1568},
		{"claude-haiku-4-5", 3840, 2160, "", 1564},
		{"claude-haiku-4-5", 4096, 512, "", 396},
		{"claude-sonnet-5", 200, 200, "", 67},
		{"claude-sonnet-5", 1000, 1000, "", 1299},
		{"claude-sonnet-5", 1092, 1092, "", 1524},
		{"claude-sonnet-5", 1920, 1080, "", 2694},
		{"claude-sonnet-5", 1075, 1520, "", 2148},
		{"claude-sonnet-5", 2000, 1500, "", 3891},
		{"claude-sonnet-5", 3840, 2160, "", 4787},
		{"claude-sonnet-5", 4096, 512, "", 1107},
		// Gemini 2.x tiles.
		{"gemini-2.5-flash", 384, 384, "", 258},
		{"gemini-2.5-flash", 385, 385, "", 1290},
		{"gemini-2.5-flash", 769, 769, "", 1290},
		{"gemini-2.5-flash", 1536, 768, "", 1806},
		{"gemini-2.5-flash", 1537, 768, "", 2322},
		{"gemini-2.5-flash", 1920, 1080, "", 1806},
		{"gemini-2.5-flash", 2000, 2000, "", 2580},
		{"gemini-2.5-flash", 2304, 768, "", 2838},
		{"gemini-2.5-flash", 3000, 1000, "", 2838},
		{"gemini-2.5-flash", 2500, 2500, "", 3354},
		{"gemini-2.5-flash", 4000, 3000, "", 3354},
		// Gemini 3 bills by media resolution (documented values; measured 2-9% lower).
		// An OpenAI detail level is not a Gemini media resolution.
		{"gemini-3.7-flash", 1000, 1000, "", 1120},
		{"gemini-3.7-flash", 1000, 1000, "MEDIA_RESOLUTION_LOW", 280},
		{"gemini-3.7-flash", 1000, 1000, "media_resolution_medium", 560},
		{"gemini-3.7-flash", 3840, 2160, "MEDIA_RESOLUTION_ULTRA_HIGH", 2240},
		{"gemini-3.7-flash", 1000, 1000, "low", 1120},
		// Unknown sizes assume 1024x1024.
		{"gpt-5.6-sol", 0, 0, "", 1229},
		{"claude-opus-4-7", 0, 0, "", 37*37 + 3},
		{"gemini-2.5-flash", -1, 0, "", 1290},
		{"deepseek-v4", 1000, 1000, "", 520},
	} {
		got := ImageTokens(tc.model, Image{Width: tc.w, Height: tc.h, Detail: tc.detail})
		assert.Equal(t, tc.want, got, "%s %dx%d detail=%q", tc.model, tc.w, tc.h, tc.detail)
	}
}

// Image dimensions come from client-supplied headers; the cost stays bounded.
func TestImageTokensBoundForgedSizes(t *testing.T) {
	const huge = 1 << 30
	assert.Equal(t, 36001, ImageTokens("gpt-5.6-sol", Image{Width: huge, Height: huge}))
	// The largest square within the visual-token budget: 39x39 and 69x69 patches.
	assert.Equal(t, 39*39+4, ImageTokens("claude-sonnet-4-6", Image{Width: huge, Height: huge}))
	assert.Equal(t, 69*69+3, ImageTokens("claude-opus-5-5", Image{Width: huge, Height: huge}))
	assert.Equal(t, 13*258, ImageTokens("gemini-2.5-pro", Image{Width: huge, Height: huge}))
}

func TestImageNeedsSize(t *testing.T) {
	assert.True(t, ImageNeedsSize("gpt-5.6-sol", "low"))
	assert.True(t, ImageNeedsSize("gpt-4o", "high"))
	assert.False(t, ImageNeedsSize("gpt-4o", "low"))
	assert.True(t, ImageNeedsSize("claude-haiku-4-5", ""))
	assert.True(t, ImageNeedsSize("gemini-2.5-flash", ""))
	assert.False(t, ImageNeedsSize("gemini-3.7-flash", ""))
	assert.False(t, ImageNeedsSize("deepseek-v4", ""))
}
