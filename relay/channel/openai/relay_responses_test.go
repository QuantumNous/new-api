package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesHandlerCountsOnlyActualToolCalls(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	tests := []struct {
		name      string
		body      string
		callCount int
	}{
		{
			name: "configured tool without call is not billed",
			body: `{
				"output":[{"type":"message"}],
				"tools":[{"type":"web_search"}],
				"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}
			}`,
			callCount: 0,
		},
		{
			name: "actual output call is counted",
			body: `{
				"output":[{"type":"web_search_call"}],
				"tools":[{"type":"web_search"}],
				"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}
			}`,
			callCount: 1,
		},
		{
			name: "provider reported current tool usage is counted",
			body: `{
				"output":[{"type":"message"}],
				"tools":[{"type":"web_search"}],
				"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2,"tool_usage":{"web_search":2}}
			}`,
			callCount: 2,
		},
		{
			name: "provider usage replaces output item count",
			body: `{
				"output":[{"type":"web_search_call"},{"type":"web_search_call"}],
				"tools":[{"type":"web_search"}],
				"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2,"tool_usage":{"web_search":1}}
			}`,
			callCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			info := &relaycommon.RelayInfo{
				ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{
					BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
						"web_search": {ToolName: "web_search"},
					},
				},
			}
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(tt.body)),
				Header:     http.Header{"Content-Type": []string{"application/json"}},
			}

			usage, apiErr := OaiResponsesHandler(ctx, info, resp)

			require.Nil(t, apiErr)
			require.Equal(t, 2, usage.TotalTokens)
			require.Equal(t, tt.callCount, info.ResponsesUsageInfo.BuiltInTools["web_search"].CallCount)
		})
	}
}
