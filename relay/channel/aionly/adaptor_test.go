package aionly

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRelayInfo(format types.RelayFormat, path string) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		RequestURLPath: path,
		RelayFormat:    format,
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{
		ChannelBaseUrl: "https://api.aiionly.com",
		ChannelType:    58, // ChannelTypeAionly
	}
	return info
}

// GetRequestURL — Claude Messages format should use /v1/messages
func TestGetRequestURL_ClaudeMessages(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatClaude, "/v1/messages")

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.aiionly.com/v1/messages", got)
}

// GetRequestURL — Claude beta flag appends ?beta=true
func TestGetRequestURL_ClaudeMessagesWithBeta(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatClaude, "/v1/messages")
	info.IsClaudeBetaQuery = true

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Contains(t, got, "beta=true")
}

// GetRequestURL — non-Claude format should pass through the standard path
func TestGetRequestURL_OpenAIFormat(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatOpenAI, "/v1/chat/completions")

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.aiionly.com/v1/chat/completions", got)
}

// GetChannelName returns the expected name
func TestGetChannelName(t *testing.T) {
	a := &Adaptor{}
	assert.Equal(t, "aionly", a.GetChannelName())
}

func TestConvertGeminiRequest_KeepGeminiFormat(t *testing.T) {
	a := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := newRelayInfo(types.RelayFormatGemini, "/v1beta/models/gemini-3-pro-image-preview:generateContent")
	req := &dto.GeminiChatRequest{}

	converted, err := a.ConvertGeminiRequest(c, info, req)

	require.NoError(t, err)
	_, ok := converted.(*dto.GeminiChatRequest)
	assert.True(t, ok)
}

func TestDoResponse_GeminiRelayRoute(t *testing.T) {
	a := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := newRelayInfo(types.RelayFormatOpenAI, "/v1beta/models/gemini-3-pro-image-preview:generateContent")
	info.RelayMode = relayconstant.RelayModeGemini
	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       ioNopCloser(`{"candidates":[{"content":{"role":"model","parts":[{"text":"ok"}]}}],"usageMetadata":{"promptTokenCount":1,"totalTokenCount":2}}`),
	}

	_, newErr := a.DoResponse(c, resp, info)

	assert.Nil(t, newErr)
}

func ioNopCloser(s string) *readCloser {
	return &readCloser{Buffer: bytes.NewBufferString(s)}
}

type readCloser struct {
	*bytes.Buffer
}

func (r *readCloser) Close() error {
	return nil
}
