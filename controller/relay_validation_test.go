package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRelayReturnsBadRequestForInvalidClientParameters(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		path        string
		format      types.RelayFormat
		body        string
		wantMessage string
		claude      bool
	}{
		{
			name:        "chat completions requires messages",
			path:        "/v1/chat/completions",
			format:      types.RelayFormatOpenAI,
			body:        `{"model":"gpt-4o"}`,
			wantMessage: "field messages is required",
		},
		{
			name:        "embeddings requires input",
			path:        "/v1/embeddings",
			format:      types.RelayFormatEmbedding,
			body:        `{"model":"text-embedding-3-small"}`,
			wantMessage: "input is empty",
		},
		{
			name:        "responses requires input",
			path:        "/v1/responses",
			format:      types.RelayFormatOpenAIResponses,
			body:        `{"model":"gpt-4o"}`,
			wantMessage: "input is required",
		},
		{
			name:        "claude messages requires messages",
			path:        "/v1/messages",
			format:      types.RelayFormatClaude,
			body:        `{"model":"claude-sonnet-4"}`,
			wantMessage: "field messages is required",
			claude:      true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, test.path, bytes.NewBufferString(test.body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			t.Cleanup(func() { common.CleanupBodyStorage(ctx) })

			Relay(ctx, test.format)

			require.Equal(t, http.StatusBadRequest, recorder.Code)
			if test.claude {
				var response struct {
					Type  string `json:"type"`
					Error struct {
						Type    string `json:"type"`
						Message string `json:"message"`
					} `json:"error"`
				}
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
				require.Equal(t, "error", response.Type)
				require.Equal(t, "new_api_error", response.Error.Type)
				require.Contains(t, response.Error.Message, test.wantMessage)
				return
			}

			var response struct {
				Error types.OpenAIError `json:"error"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, string(types.ErrorCodeInvalidRequest), response.Error.Code)
			require.Contains(t, response.Error.Message, test.wantMessage)
		})
	}
}
