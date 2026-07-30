package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPath2RelayModePlayground(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/pg/chat/completions", want: RelayModeChatCompletions},
		{path: "/pg/images/generations", want: RelayModeImagesGenerations},
		{path: "/pg/images/edits", want: RelayModeImagesEdits},
		{path: "/pg/audio/speech", want: RelayModeAudioSpeech},
		{path: "/pg/video/generations", want: RelayModeVideoSubmit},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			assert.Equal(t, test.want, Path2RelayMode(test.path))
		})
	}
}

func TestPath2RelayModeAlphaSearch(t *testing.T) {
	assert.Equal(t, RelayModeAlphaSearch, Path2RelayMode("/v1/alpha/search"))
	assert.Equal(t, RelayModeAlphaSearch, Path2RelayMode("/v1/alpha/search?future=1"))
}
