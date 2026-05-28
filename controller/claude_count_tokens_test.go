package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestClaudeMessagesCountTokensReturnsInputTokens(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitTokenEncoders()

	body := map[string]any{
		"model": "gpt-5.5",
		"messages": []map[string]any{
			{
				"role":    "user",
				"content": "hello from claude cli",
			},
		},
	}
	payload, err := common.Marshal(body)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")

	ClaudeMessagesCountTokens(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response map[string]int
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Greater(t, response["input_tokens"], 0)
}
