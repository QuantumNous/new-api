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
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesHandlerRecordsResourceRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(context, constant.ContextKeyUserId, 201)
	common.SetContextKey(context, constant.ContextKeyChannelId, 11)
	common.SetContextKey(context, constant.ContextKeyOriginalModel, "doubao-seed-test")

	upstreamRequest := httptest.NewRequest(http.MethodPost, "https://ark.example.com/api/v3/responses", nil)
	upstreamResponse := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: io.NopCloser(strings.NewReader(
			`{"id":"resp_recorded","object":"response","status":"completed","model":"doubao-seed-test","output":[],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`,
		)),
		Request: upstreamRequest,
	}

	usage, newAPIError := OaiResponsesHandler(context, &relaycommon.RelayInfo{}, upstreamResponse)
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.TotalTokens)

	route, found, err := service.GetResponsesResourceRoute(context, "resp_recorded")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 11, route.ChannelID)
	assert.Equal(t, "https://ark.example.com/api/v3/responses", route.UpstreamResponsesURL)
}
