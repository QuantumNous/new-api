package helper

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsRejectsImageGenerationModels(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name  string
		model string
	}{
		{name: "current GPT Image model", model: "gpt-image-2"},
		{name: "GPT Image snapshot", model: "gpt-image-2-2026-04-21"},
		{name: "future GPT Image model", model: "gpt-image-3"},
		{name: "legacy GPT Image model", model: "gpt-image-1.5"},
		{name: "ChatGPT image model", model: "chatgpt-image-latest"},
		{name: "DALL-E model", model: "dall-e-3"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := `{"model":"` + tt.model + `","messages":[{"role":"user","content":"Generate an image"}]}`
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(body))
			c.Request.Header.Set("Content-Type", "application/json")

			_, err := GetAndValidateTextRequest(c, relayconstant.RelayModeChatCompletions)

			require.Error(t, err)
			assert.Equal(
				t,
				`model "`+tt.model+`" is not supported on /v1/chat/completions; use /v1/images/generations instead`,
				err.Error(),
			)
		})
	}
}

func TestChatCompletionsAcceptsTextModel(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/chat/completions",
		bytes.NewBufferString(`{"model":"gpt-5","messages":[{"role":"user","content":"Hello"}]}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	request, err := GetAndValidateTextRequest(c, relayconstant.RelayModeChatCompletions)

	require.NoError(t, err)
	assert.Equal(t, "gpt-5", request.Model)
}
