package gemini

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
)

func TestURLModelNameStripsPublisherPrefix(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.7-flash",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "google/gemini-3.7-flash",
		},
	}

	assert.Equal(t, "gemini-3.7-flash", URLModelName(info))
}

func TestURLModelNameStripsEffortSuffixWhenThinkingAdapterEnabled(t *testing.T) {
	settings := model_setting.GetGeminiSettings()
	previous := settings.ThinkingAdapterEnabled
	settings.ThinkingAdapterEnabled = true
	t.Cleanup(func() { settings.ThinkingAdapterEnabled = previous })

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.7-flash-high",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "google/gemini-3.7-flash-high",
		},
	}

	assert.Equal(t, "gemini-3.7-flash", URLModelName(info))
	assert.Equal(t, "google/gemini-3.7-flash", info.UpstreamModelName)
}

func TestStripThinkingAndEffortSuffixes(t *testing.T) {
	t.Parallel()
	tests := map[string]string{
		"gemini-3.7-flash-thinking":      "gemini-3.7-flash",
		"gemini-3.7-flash-thinking-high": "gemini-3.7-flash",
		"gemini-3.7-flash-nothinking":    "gemini-3.7-flash",
		"gemini-3.7-flash-xhigh":         "gemini-3.7-flash",
	}
	for input, want := range tests {
		assert.Equal(t, want, stripThinkingAndEffortSuffix(input), input)
	}
}
