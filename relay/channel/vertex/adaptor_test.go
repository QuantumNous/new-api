package vertex

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestGetRequestURLUsesCustomBaseURLForGeminiAPIKey(t *testing.T) {
	info := &relaycommon.RelayInfo{
		OriginModelName: "google/gemini-2.5-pro",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:               "test-key",
			ApiVersion:           "us-central1",
			UpstreamModelName:    "google/gemini-2.5-pro",
			ChannelBaseUrl:       "https://proxy.example.com/api/vertex-ai",
			ChannelOtherSettings: dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeAPIKey},
		},
	}

	adaptor := &Adaptor{}
	adaptor.Init(info)

	url, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://proxy.example.com/api/vertex-ai/v1beta/models/google/gemini-2.5-pro:generateContent"
	if url != want {
		t.Fatalf("unexpected url\nwant: %s\n got: %s", want, url)
	}
}
