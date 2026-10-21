package volcengine

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
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

func TestVolcengineAgentPlanAudioSpeechURL(t *testing.T) {
	adaptor := &Adaptor{}

	// Agent Plan base URL + AudioSpeech → should fall back to WebSocket TTS
	// because Agent Plan does not support TTS.
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
		},
	}
	info.ChannelMeta.ApiKey = "ark-test-key"
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := ttsAgentPlanEndpoint
	if got != want {
		t.Fatalf("Agent Plan TTS URL = %q, want %q", got, want)
	}

	// Regular (default) VolcEngine + AudioSpeech → WebSocket TTS (existing behavior)
	info2 := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com",
		},
	}
	got2, err2 := adaptor.GetRequestURL(info2)
	if err2 != nil {
		t.Fatalf("GetRequestURL returned error: %v", err2)
	}
	if got2 != "wss://openspeech.bytedance.com/api/v1/tts/ws_binary" {
		t.Fatalf("Regular legacy TTS URL = %q", got2)
	}

	// Custom (non-Agent-Plan, non-default) base URL + AudioSpeech → HTTP
	info3 := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://custom-tts.example.com",
		},
	}
	got3, err3 := adaptor.GetRequestURL(info3)
	if err3 != nil {
		t.Fatalf("GetRequestURL returned error: %v", err3)
	}
	want3 := "https://custom-tts.example.com/v1/audio/speech"
	if got3 != want3 {
		t.Fatalf("Custom base TTS URL = %q, want %q", got3, want3)
	}
}

func TestVolcengineAgentPlanASRURL(t *testing.T) {
	adaptor := &Adaptor{}

	// Agent Plan base URL + AudioTranscription → should fall back to ASR WebSocket
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioTranscription,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
		},
	}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async"
	if got != want {
		t.Fatalf("Agent Plan ASR URL = %q, want %q", got, want)
	}

	// Regular (default) VolcEngine + AudioTranscription → WebSocket ASR
	info2 := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioTranscription,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com",
		},
	}
	got2, err2 := adaptor.GetRequestURL(info2)
	if err2 != nil {
		t.Fatalf("GetRequestURL returned error: %v", err2)
	}
	if got2 != want {
		t.Fatalf("Regular ASR URL = %q, want %q", got2, want)
	}

	// Custom (non-Agent-Plan, non-default) base URL + AudioTranscription → HTTP
	info3 := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioTranscription,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://custom-asr.example.com",
		},
	}
	got3, err3 := adaptor.GetRequestURL(info3)
	if err3 != nil {
		t.Fatalf("GetRequestURL returned error: %v", err3)
	}
	want3 := "https://custom-asr.example.com/v1/audio/transcriptions"
	if got3 != want3 {
		t.Fatalf("Custom base ASR URL = %q, want %q", got3, want3)
	}
}
