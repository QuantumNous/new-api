package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func setupOpenAICompatibleClaudeStreamTest(t *testing.T, body string) (*gin.Context, *http.Response, *relaycommon.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	common.SetContextKey(c, common.RequestIdKey, "test-req-id")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		RelayFormat:       types.RelayFormatClaude,
		RelayMode:         relayconstant.RelayModeChatCompletions,
		ChannelMeta:       &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5.5"},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{},
		IsStream:          true,
	}
	info.SetEstimatePromptTokens(100)

	return c, resp, info, recorder
}

func TestOaiStreamHandlerOpenAICompatibleReturnsErrorOnEmptyStream(t *testing.T) {
	c, resp, info, _ := setupOpenAICompatibleClaudeStreamTest(t, "")
	info.RelayFormat = types.RelayFormatOpenAI

	usage, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, err)
	require.Equal(t, types.ErrorCodeBadResponseBody, err.GetErrorCode())
}

func TestOaiStreamHandlerClaudeCompatibleReturnsErrorOnEmptyStream(t *testing.T) {
	c, resp, info, _ := setupOpenAICompatibleClaudeStreamTest(t, "")

	usage, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, err)
	require.Equal(t, types.ErrorCodeBadResponseBody, err.GetErrorCode())
}

func TestOaiStreamHandlerClaudeCompatibleReturnsErrorOnOpenBlockWithoutTerminal(t *testing.T) {
	body := "data: {\"id\":\"chatcmpl_test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-5.5\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"},\"finish_reason\":null}]}\n\n"
	c, resp, info, _ := setupOpenAICompatibleClaudeStreamTest(t, body)

	usage, err := OaiStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, err)
	require.Equal(t, types.ErrorCodeBadResponseBody, err.GetErrorCode())
}
