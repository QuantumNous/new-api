package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestGetRequestURLUsesTextPlanNative(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		client  types.RelayFormat
		mode    int
		path    string
		want    string
		upgrade bool
	}{
		{
			name:   "claude client uses chat completions",
			client: types.RelayFormatClaude,
			mode:   relayconstant.RelayModeUnknown,
			path:   "/v1/messages",
			want:   "https://api.openai.com/v1/chat/completions",
		},
		{
			name:    "chat upgrade uses responses",
			client:  types.RelayFormatOpenAI,
			mode:    relayconstant.RelayModeChatCompletions,
			path:    "/v1/chat/completions",
			want:    "https://api.openai.com/v1/responses",
			upgrade: true,
		},
		{
			name:   "responses client stays responses",
			client: types.RelayFormatOpenAIResponses,
			mode:   relayconstant.RelayModeResponses,
			path:   "/v1/responses",
			want:   "https://api.openai.com/v1/responses",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			info := &relaycommon.RelayInfo{
				RelayFormat:    tt.client,
				RelayMode:      tt.mode,
				RequestURLPath: tt.path,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeOpenAI,
					ApiType:        constant.APITypeOpenAI,
					ChannelBaseUrl: "https://api.openai.com",
				},
			}
			info.BuildTextPlan(tt.upgrade)
			got, err := (&Adaptor{}).GetRequestURL(info)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Fatalf("got %s want %s (relayMode=%d)", got, tt.want, info.RelayMode)
			}
			if tt.upgrade && info.RelayMode != relayconstant.RelayModeChatCompletions {
				t.Fatalf("upgrade rewrote RelayMode to %d", info.RelayMode)
			}
		})
	}
}
