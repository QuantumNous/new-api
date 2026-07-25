package blockrun

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

// TestGetRequestURL_NativePassthroughByFormat covers the VIP native passthrough
// dispatch: Anthropic inbound goes to /v1/messages, OpenAI (and default) inbound
// goes to /v1/chat/completions, and Gemini inbound is rejected.
func TestGetRequestURL_NativePassthroughByFormat(t *testing.T) {
	a := &Adaptor{}
	cases := []struct {
		name string
		info *relaycommon.RelayInfo
		want string
	}{
		{
			name: "openai format → /v1/chat/completions",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/chat/completions",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			name: "claude format → native /v1/messages",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/messages",
				RelayFormat:    types.RelayFormatClaude,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/messages",
		},
		{
			name: "claude format with custom base URL → native /v1/messages",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/messages",
				RelayFormat:    types.RelayFormatClaude,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://proxy.example.com/blockrun"},
			},
			want: "https://proxy.example.com/blockrun/v1/messages",
		},
		{
			name: "default (empty) format → /v1/chat/completions",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/chat/completions",
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			name: "responses relay mode → /v1/chat/completions compatibility bridge",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/responses",
				RelayMode:      relayconstant.RelayModeResponses,
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
		},
		{
			// Spec decision #2: an OpenAI-format request naming a Claude model
			// (anthropic/claude-*) still hits /v1/chat/completions — the gateway
			// routes by model name, response stays OpenAI-shaped. URL dispatch is
			// purely by RelayFormat and ignores the model namespace.
			name: "openai format with anthropic/claude-* model → /v1/chat/completions (cross-namespace passthrough)",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/chat/completions",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    "https://blockrun.ai/api",
					UpstreamModelName: "anthropic/claude-opus-4.8",
				},
			},
			want: "https://blockrun.ai/api/v1/chat/completions",
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

// TestGetRequestURL_ClaudeBetaQuery verifies ?beta=true is appended for the
// Claude leg when either the inbound request (IsClaudeBetaQuery) or the channel
// setting (ChannelOtherSettings.ClaudeBetaQuery) forces it.
func TestGetRequestURL_ClaudeBetaQuery(t *testing.T) {
	a := &Adaptor{}

	cases := []struct {
		name string
		info *relaycommon.RelayInfo
	}{
		{
			name: "forced by inbound request (IsClaudeBetaQuery)",
			info: &relaycommon.RelayInfo{
				RequestURLPath:    "/v1/messages",
				RelayFormat:       types.RelayFormatClaude,
				IsClaudeBetaQuery: true,
				ChannelMeta:       &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
		},
		{
			name: "forced by channel setting (ChannelOtherSettings.ClaudeBetaQuery)",
			info: &relaycommon.RelayInfo{
				RequestURLPath: "/v1/messages",
				RelayFormat:    types.RelayFormatClaude,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:       "https://blockrun.ai/api",
					ChannelOtherSettings: dto.ChannelOtherSettings{ClaudeBetaQuery: true},
				},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := a.GetRequestURL(tc.info)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != "https://blockrun.ai/api/v1/messages?beta=true" {
				t.Fatalf("got %q, want beta query appended", got)
			}
		})
	}
}

// TestGetRequestURL_ImageModes verifies image relay modes route to BlockRun's
// dedicated image endpoints, independent of RelayFormat:
//   - RelayModeImagesGenerations → /v1/images/generations (text-to-image)
//   - RelayModeImagesEdits        → /v1/images/image2image (img2img / fusion)
func TestGetRequestURL_ImageModes(t *testing.T) {
	a := &Adaptor{}
	cases := []struct {
		name string
		info *relaycommon.RelayInfo
		want string
	}{
		{
			name: "images generations → /v1/images/generations",
			info: &relaycommon.RelayInfo{
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				RequestURLPath: "/v1/images/generations",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/images/generations",
		},
		{
			name: "images edits → /v1/images/image2image",
			info: &relaycommon.RelayInfo{
				RelayMode:      relayconstant.RelayModeImagesEdits,
				RequestURLPath: "/v1/images/edits",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
			},
			want: "https://blockrun.ai/api/v1/images/image2image",
		},
		{
			name: "images generations with custom base URL",
			info: &relaycommon.RelayInfo{
				RelayMode:      relayconstant.RelayModeImagesGenerations,
				RequestURLPath: "/v1/images/generations",
				RelayFormat:    types.RelayFormatOpenAI,
				ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://proxy.example.com/blockrun"},
			},
			want: "https://proxy.example.com/blockrun/v1/images/generations",
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

// TestGetRequestURL_GeminiUnsupported verifies Gemini inbound is rejected.
func TestGetRequestURL_GeminiUnsupported(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RequestURLPath: "/v1beta/models/gemini-pro:generateContent",
		RelayFormat:    types.RelayFormatGemini,
		ChannelMeta:    &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	if _, err := a.GetRequestURL(info); err == nil {
		t.Fatalf("expected error for gemini format, got nil")
	}
}
