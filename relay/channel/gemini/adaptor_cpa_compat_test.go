package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLPreservesNativeGeminiActionsForCPA(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		model       string
		requestPath string
		wantURL     string
		disablePing bool
	}{
		{
			name:        "generate content",
			model:       "gemini-2.5-flash",
			requestPath: "/v1beta/models/gemini-2.5-flash:generateContent",
			wantURL:     "https://cpa.example/v1beta/models/gemini-2.5-flash:generateContent",
		},
		{
			name:        "stream generate content",
			model:       "gemini-2.5-flash",
			requestPath: "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=downstream-key",
			wantURL:     "https://cpa.example/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
			disablePing: true,
		},
		{
			name:        "count tokens",
			model:       "gemini-1.0-pro",
			requestPath: "/v1beta/models/gemini-1.0-pro:countTokens",
			wantURL:     "https://cpa.example/v1beta/models/gemini-1.0-pro:countTokens",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			info := &relaycommon.RelayInfo{
				RelayMode:       relayconstant.RelayModeGemini,
				RequestURLPath:  test.requestPath,
				OriginModelName: test.model,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    "https://cpa.example",
					UpstreamModelName: test.model,
				},
			}

			got, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, test.wantURL, got)
			assert.Equal(t, test.disablePing, info.DisablePing)
		})
	}
}

func TestGeminiCountTokensHandlerReturnsCPAResponseAndUsage(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-2.5-flash:countTokens", nil)
	responseBody := []byte(`{"totalTokens":37}`)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
	}

	usage, apiErr := GeminiCountTokensHandler(c, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 37, usage.PromptTokens)
	assert.Equal(t, 0, usage.CompletionTokens)
	assert.Equal(t, 37, usage.TotalTokens)
	require.NotNil(t, usage.BillingUsage)
	require.NotNil(t, usage.BillingUsage.GeminiUsageMetadata)
	assert.Equal(t, 37, usage.BillingUsage.GeminiUsageMetadata.TotalTokenCount)
	assert.JSONEq(t, string(responseBody), recorder.Body.String())
}

func TestGeminiCountTokensWrapperProvidesTokenMetadata(t *testing.T) {
	t.Parallel()

	request := &dto.GeminiChatRequest{
		GenerateContentRequest: &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{{
				Parts: []dto.GeminiPart{{Text: "count this text"}},
			}},
		},
	}

	meta := request.GetTokenCountMeta()
	require.NotNil(t, meta)
	assert.Equal(t, "count this text", meta.CombineText)
}
