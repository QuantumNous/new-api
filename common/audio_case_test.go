package common

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestGetAudioDurationCaseInsensitiveExt(t *testing.T) {
	wav := MinimalWAV(8000, 8000) // 1 second

	for _, ext := range []string{".wav", ".WAV", ".Wav"} {
		d, err := GetAudioDuration(context.Background(), bytes.NewReader(wav), ext)
		if err != nil {
			t.Fatalf("ext %q: unexpected error: %v", ext, err)
		}
		if d < 0.99 || d > 1.01 {
			t.Fatalf("ext %q: expected ~1s duration, got %v", ext, d)
		}
	}
}

func TestGetAudioDurationUppercaseNotUnsupported(t *testing.T) {
	_, err := GetAudioDuration(context.Background(), bytes.NewReader([]byte("not audio")), ".MP3")
	if err != nil && strings.Contains(err.Error(), "unsupported audio format") {
		t.Fatalf("uppercase extension rejected as unsupported: %v", err)
	}
}
