package volcengine

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
)

func TestVolcengineRegularArkURLs(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com",
		},
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
	if got != want {
		t.Fatalf("regular chat URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanURLs(t *testing.T) {
	adaptor := &Adaptor{}
	cases := []struct {
		name      string
		relayMode int
		want      string
	}{
		{
			name:      "chat",
			relayMode: relayconstant.RelayModeChatCompletions,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
		},
		{
			name:      "images",
			relayMode: relayconstant.RelayModeImagesGenerations,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
		},
		{
			name:      "responses",
			relayMode: relayconstant.RelayModeResponses,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/responses",
		},
		{
			name:      "embeddings",
			relayMode: relayconstant.RelayModeEmbeddings,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/embeddings",
		},
		{
			name:      "rerank",
			relayMode: relayconstant.RelayModeRerank,
			want:      "https://ark.cn-beijing.volces.com/api/plan/v3/rerank",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayMode:   tc.relayMode,
				RelayFormat: types.RelayFormatOpenAI,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3/",
				},
			}
			got, err := adaptor.GetRequestURL(info)
			if err != nil {
				t.Fatalf("GetRequestURL returned error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("Agent Plan URL = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestVolcengineAgentPlanBotURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://ark.cn-beijing.volces.com/api/plan/v3",
			UpstreamModelName: "bot-123",
		},
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/plan/v3/bots/chat/completions"
	if got != want {
		t.Fatalf("Agent Plan bot URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanClaudeFormatURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
		},
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions"
	if got != want {
		t.Fatalf("Agent Plan Claude-format URL = %q, want %q", got, want)
	}
}

func TestVolcengineAgentPlanDoesNotAffectSpecialBases(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "doubao-coding-plan",
			ChannelType:    constant.ChannelTypeVolcEngine,
		},
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions"
	if got != want {
		t.Fatalf("special base URL = %q, want %q", got, want)
	}
}
