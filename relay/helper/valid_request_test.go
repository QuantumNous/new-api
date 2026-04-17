package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetAndValidateTextRequestCompletionsRequiresPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/completions", strings.NewReader(`{"model":"code-model"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	_, err := GetAndValidateTextRequest(c, relayconstant.RelayModeCompletions)
	require.EqualError(t, err, "field prompt is required")
}

func TestGetAndValidateTextRequestCompletionsAcceptsLogprobsNumber(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/completions", strings.NewReader(`{
		"model":"code-model",
		"prompt":"func add(a int, b int) int {",
		"logprobs":0
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	req, err := GetAndValidateTextRequest(c, relayconstant.RelayModeCompletions)
	require.NoError(t, err)
	require.NotNil(t, req.LogProbs)
}
