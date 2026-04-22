package aionly

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
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

func TestGetRequestURL_AionlyImageGenerationLegacyPath(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/v1/images/generations")
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.aiionly.com/v1/images/generations", got)
}

func TestGetRequestURL_AionlyImageGenerationOpenAIV1Path(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/openai/v1/images/generations")
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.aiionly.com/openai/v1/images/generations", got)
}

func TestGetRequestURL_AionlyImageEditsUsesOpenAIV1Path(t *testing.T) {
	a := &Adaptor{}
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/openai/v1/images/edits")
	info.RelayMode = relayconstant.RelayModeImagesEdits

	got, err := a.GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.aiionly.com/openai/v1/images/edits", got)
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

func TestConvertImageRequest_AionlyNestedFormatCompat(t *testing.T) {
	a := &Adaptor{}
	gin.SetMode(gin.TestMode)
	rawBody := `{
		"model": "gpt-image-2-c",
		"input": {
			"prompt": "一条狗"
		},
		"parameters": {
			"size": "1024x1024",
			"quality": "medium",
			"output_compression": 100,
			"output_format": "png",
			"n": 1
		}
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/v1/images/generations")
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	request := dto.ImageRequest{}
	err := common.UnmarshalBodyReusable(c, &request)
	require.NoError(t, err)

	converted, err := a.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	buffer, ok := converted.(*bytes.Buffer)
	require.True(t, ok)
	payload := buffer.String()
	assert.Equal(t, "一条狗", gjson.Get(payload, "input.prompt").String())
	assert.Equal(t, "1024x1024", gjson.Get(payload, "parameters.size").String())
	assert.Equal(t, "medium", gjson.Get(payload, "parameters.quality").String())
	assert.Equal(t, float64(100), gjson.Get(payload, "parameters.output_compression").Float())
	assert.Equal(t, "png", gjson.Get(payload, "parameters.output_format").String())
	assert.Equal(t, float64(1), gjson.Get(payload, "parameters.n").Float())
}

func TestConvertImageRequest_AionlyNestedFormatCompatWithOpenAIV1Path(t *testing.T) {
	a := &Adaptor{}
	gin.SetMode(gin.TestMode)
	rawBody := `{
		"model": "gpt-image-1",
		"prompt": "一只猫"
	}`
	req := httptest.NewRequest(http.MethodPost, "/openai/v1/images/generations", strings.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/openai/v1/images/generations")
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	request := dto.ImageRequest{}
	err := common.UnmarshalBodyReusable(c, &request)
	require.NoError(t, err)

	converted, err := a.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	convertedReq, ok := converted.(dto.ImageRequest)
	require.True(t, ok)
	assert.Equal(t, "gpt-image-1", convertedReq.Model)
	assert.Equal(t, "一只猫", convertedReq.Prompt)
}

func TestConvertImageRequest_AionlyNestedFormatOnlyForGenerationsURL(t *testing.T) {
	a := &Adaptor{}
	gin.SetMode(gin.TestMode)
	req := httptest.NewRequest(http.MethodPost, "/v1/images/edits", nil)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	info := newRelayInfo(types.RelayFormatOpenAIImage, "/v1/images/edits")
	info.RelayMode = relayconstant.RelayModeImagesGenerations

	request := dto.ImageRequest{Model: "gpt-image-2-c"}

	converted, err := a.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	convertedReq, ok := converted.(dto.ImageRequest)
	require.True(t, ok)
	assert.Equal(t, "gpt-image-2-c", convertedReq.Model)
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
