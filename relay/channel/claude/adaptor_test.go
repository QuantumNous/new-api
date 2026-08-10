package claude

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAdaptorForwardsAnthropicWorkspaceID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                  string
		configuredWorkspaceID string
		headerOverride        map[string]any
		expected              string
	}{
		{
			name:     "incoming workspace",
			expected: "wrkspc_client",
		},
		{
			name:                  "configured workspace wins",
			configuredWorkspaceID: "  proj_configured  ",
			expected:              "proj_configured",
		},
		{
			name:                  "channel override wins",
			configuredWorkspaceID: "proj_configured",
			headerOverride: map[string]any{
				AnthropicWorkspaceIDHeader: "wrkspc_admin",
			},
			expected: "wrkspc_admin",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			workspaceIDs := make(chan string, 1)
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				workspaceIDs <- request.Header.Get(AnthropicWorkspaceIDHeader)
				writer.Header().Set("Content-Type", "application/json")
				writer.WriteHeader(http.StatusOK)
				_, _ = writer.Write([]byte(`{}`))
			}))
			t.Cleanup(server.Close)

			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
			ctx.Request.Header.Set("Content-Type", "application/json")
			ctx.Request.Header.Set(AnthropicWorkspaceIDHeader, "wrkspc_client")

			info := &relaycommon.RelayInfo{
				OriginModelName: "claude-sonnet-4-6",
				ChannelMeta: &relaycommon.ChannelMeta{
					ApiKey:            "upstream-key",
					ChannelBaseUrl:    server.URL,
					HeadersOverride:   test.headerOverride,
					UpstreamModelName: "claude-sonnet-4-6",
					ChannelOtherSettings: dto.ChannelOtherSettings{
						AnthropicWorkspaceID: test.configuredWorkspaceID,
					},
				},
			}

			result, err := (&Adaptor{}).DoRequest(ctx, info, bytes.NewBufferString(`{"messages":[]}`))
			require.NoError(t, err)
			response, ok := result.(*http.Response)
			require.True(t, ok)
			t.Cleanup(func() {
				_, _ = io.Copy(io.Discard, response.Body)
				_ = response.Body.Close()
			})
			require.Equal(t, test.expected, <-workspaceIDs)
		})
	}
}
