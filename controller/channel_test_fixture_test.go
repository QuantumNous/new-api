package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestApplyClaudeCodeTestFixturesInjectsHeadersAndMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	req := &dto.GeneralOpenAIRequest{
		Model: "claude-sonnet-4-6",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
		},
	}
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}

	applyClaudeCodeTestFixtures(ctx, info, req)

	require.JSONEq(t, `{"user_id":"channel-test"}`, string(req.Metadata))
	require.Equal(t, "claude-code/channel-test", ctx.Request.Header.Get("User-Agent"))
	require.Equal(t, "2023-06-01", ctx.Request.Header.Get("Anthropic-Version"))
	require.True(t, info.UseRuntimeHeadersOverride)
	require.Equal(t, "claude-code", info.RuntimeHeadersOverride["X-App"])
}

func TestApplyClaudeCodeTestFixturesPreservesExistingMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	req := &dto.GeneralOpenAIRequest{
		Model:    "claude-sonnet-4-6",
		Metadata: json.RawMessage(`{"user_id":"existing-user"}`),
	}
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
	}

	applyClaudeCodeTestFixtures(ctx, info, req)

	require.JSONEq(t, `{"user_id":"existing-user"}`, string(req.Metadata))
}
