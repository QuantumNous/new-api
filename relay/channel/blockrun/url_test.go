package blockrun

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

// TestGetRequestURL_ClaudeAndGeminiFormatsRewriteToChatCompletions covers the
// fix for Claude Code (and Gemini SDK) hitting newapi through a BlockRun
// channel. The inbound RequestURLPath is /v1/messages or /v1beta/.../generateContent,
// but BlockRun only exposes /v1/chat/completions — without the rewrite the
// upstream would 404.
func TestGetRequestURL_ClaudeAndGeminiFormatsRewriteToChatCompletions(t *testing.T) {
	a := &Adaptor{}
	cases := []struct {
		name   string
		info   *relaycommon.RelayInfo
		want   string
	}{
		{
			name: "openai format keeps request path",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/chat/completions",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			name: "claude format (/v1/messages) is rewritten",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/messages",
				RelayFormat:    types.RelayFormatClaude,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			name: "gemini format is rewritten",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1beta/models/gemini-pro:generateContent",
				RelayFormat:    types.RelayFormatGemini,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			name: "claude format with custom base URL",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/messages",
				RelayFormat:    types.RelayFormatClaude,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://proxy.example.com/blockrun"},
			},
			want: "https://proxy.example.com/blockrun/v1/chat/completions",
		},
		{
			name: "claude format + RelayModeResponses falls through (defensive)",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/responses",
				RelayFormat:    types.RelayFormatClaude,
				RelayMode:      relayconstant.RelayModeResponses,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/responses",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := a.GetRequestURL(tc.info)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}
