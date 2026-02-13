package helper

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetAndValidateClaudeRequest_AllowsNewFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name   string
		body   string
		assert func(t *testing.T, req *dto.ClaudeRequest)
	}{
		{
			name: "output_config with effort",
			body: `{"model":"claude-3-sonnet","messages":[{"role":"user","content":"hi"}],"output_config":{"effort":"low","extra":"field"}}`,
			assert: func(t *testing.T, req *dto.ClaudeRequest) {
				require.NotEmpty(t, req.OutputConfig)
				var cfg map[string]any
				require.NoError(t, json.Unmarshal(req.OutputConfig, &cfg))
				require.Equal(t, "low", cfg["effort"])
				require.Equal(t, "field", cfg["extra"])
			},
		},
		{
			name: "empty output_config allowed",
			body: `{"model":"claude-3-sonnet","messages":[{"role":"user","content":"hi"}],"output_config":{}}`,
			assert: func(t *testing.T, req *dto.ClaudeRequest) {
				require.NotNil(t, req.OutputConfig)
				require.NotEmpty(t, req.OutputConfig)
			},
		},
		{
			name: "thinking and unknown fields tolerated",
			body: `{"model":"claude-3-sonnet","messages":[{"role":"user","content":"hi"}],"thinking":{"type":"enabled","budget_tokens":5000},"foo":"bar"}`,
			assert: func(t *testing.T, req *dto.ClaudeRequest) {
				require.NotNil(t, req.Thinking)
				require.Equal(t, "enabled", req.Thinking.Type)
				require.Equal(t, 5000, req.Thinking.GetBudgetTokens())
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("POST", "/v1/messages", strings.NewReader(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")

			req, err := GetAndValidateClaudeRequest(c)
			require.NoError(t, err)
			require.Equal(t, "claude-3-sonnet", req.Model)
			require.NotEmpty(t, req.Messages)

			tt.assert(t, req)
		})
	}
}
