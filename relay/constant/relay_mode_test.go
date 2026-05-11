package constant

import (
	"testing"
)

// TestPath2RelayMode_KnownPaths checks that well-known paths map to the
// expected relay mode constants.
func TestPath2RelayMode_KnownPaths(t *testing.T) {
	cases := []struct {
		path string
		want int
	}{
		{"/v1/chat/completions", RelayModeChatCompletions},
		{"/v1/completions", RelayModeCompletions},
		{"/v1/embeddings", RelayModeEmbeddings},
		{"/v1/moderations", RelayModeModerations},
		{"/v1/images/generations", RelayModeImagesGenerations},
		{"/v1/images/edits", RelayModeImagesEdits},
		{"/v1/edits", RelayModeEdits},
		{"/v1/audio/speech", RelayModeAudioSpeech},
		{"/v1/audio/transcriptions", RelayModeAudioTranscription},
		{"/v1/audio/translations", RelayModeAudioTranslation},
		{"/v1/rerank", RelayModeRerank},
		{"/v1/responses", RelayModeResponses},
		{"/v1/responses/compact", RelayModeResponsesCompact},
	}
	for _, c := range cases {
		got := Path2RelayMode(c.path)
		if got != c.want {
			t.Errorf("Path2RelayMode(%q) = %d, want %d", c.path, got, c.want)
		}
	}
}

// TestPath2RelayMode_VolcNativePath documents that the Volc-native image
// generation path /api/v3/images/generations is NOT recognised by
// Path2RelayMode (it returns RelayModeUnknown). Channel-test code that uses
// this path must therefore call c.Set("relay_mode", RelayModeImagesGenerations)
// explicitly so that genBaseRelayInfo falls back to the correct value.
func TestPath2RelayMode_VolcNativePath(t *testing.T) {
	const volcPath = "/api/v3/images/generations"
	got := Path2RelayMode(volcPath)
	if got != RelayModeUnknown {
		t.Errorf("Path2RelayMode(%q) = %d; expected RelayModeUnknown (%d) — this path requires an explicit relay_mode context key", volcPath, got, RelayModeUnknown)
	}
}
