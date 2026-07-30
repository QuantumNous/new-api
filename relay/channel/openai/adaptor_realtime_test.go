package openai

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupRequestHeaderRealtimeBetaDependsOnUpstreamModel(t *testing.T) {
	tests := []struct {
		name          string
		upstreamModel string
		websocket     bool
		wantBeta      bool
	}{
		{name: "http preview", upstreamModel: "gpt-4o-realtime-preview", wantBeta: true},
		{name: "http ga", upstreamModel: "gpt-realtime-2", wantBeta: false},
		{name: "websocket preview", upstreamModel: "gpt-4o-mini-realtime-preview-2024-12-17", websocket: true, wantBeta: true},
		{name: "websocket ga", upstreamModel: "gpt-realtime-2.1", websocket: true, wantBeta: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/v1/realtime?model=customer-alias", nil)
			if test.websocket {
				request.Header.Set("Sec-WebSocket-Protocol", "realtime")
			}
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = request
			header := http.Header{}
			info := &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeRealtime,
				OriginModelName: "customer-alias",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeOpenAI,
					UpstreamModelName: test.upstreamModel,
					ApiKey:            "test-key",
				},
			}

			err := (&Adaptor{}).SetupRequestHeader(context, &header, info)
			require.NoError(t, err)
			if test.websocket {
				protocol := header.Get("Sec-WebSocket-Protocol")
				assert.Contains(t, protocol, "realtime")
				assert.Contains(t, protocol, "openai-insecure-api-key.test-key")
				assert.Equal(t, test.wantBeta, strings.Contains(protocol, "openai-beta.realtime-v1"))
				assert.Empty(t, header.Get("OpenAI-Beta"))
				return
			}
			assert.Equal(t, test.wantBeta, header.Get("OpenAI-Beta") == "realtime=v1")
			assert.Equal(t, "Bearer test-key", header.Get("Authorization"))
		})
	}
}
