package relay

import (
	"net/http"
	"testing"

	appconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestShouldFallbackResponsesCompactionToResponses(t *testing.T) {
	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		resp *http.Response
		want bool
	}{
		{
			name: "nil info",
			info: nil,
			resp: &http.Response{StatusCode: http.StatusNotFound},
			want: false,
		},
		{
			name: "nil response",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponsesCompact,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: appconstant.APITypeOpenAI,
				},
			},
			resp: nil,
			want: false,
		},
		{
			name: "non compact relay mode",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponses,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: appconstant.APITypeOpenAI,
				},
			},
			resp: &http.Response{StatusCode: http.StatusNotFound},
			want: false,
		},
		{
			name: "compact mode but non openai api type",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponsesCompact,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: appconstant.APITypeCodex,
				},
			},
			resp: &http.Response{StatusCode: http.StatusNotFound},
			want: false,
		},
		{
			name: "compact mode openai api type but non 404",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponsesCompact,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: appconstant.APITypeOpenAI,
				},
			},
			resp: &http.Response{StatusCode: http.StatusBadRequest},
			want: false,
		},
		{
			name: "compact mode openai api type 404",
			info: &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponsesCompact,
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiType: appconstant.APITypeOpenAI,
				},
			},
			resp: &http.Response{StatusCode: http.StatusNotFound},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldFallbackResponsesCompactionToResponses(tt.info, tt.resp)
			if got != tt.want {
				t.Fatalf("shouldFallbackResponsesCompactionToResponses() = %v, want %v", got, tt.want)
			}
		})
	}
}
