package common_handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRerankUsagePolicyContext(t *testing.T, body string) (*gin.Context, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/rerank", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	info.SetEstimatePromptTokens(5)
	return c, resp, info
}

func TestRerankHandlerTrustUpstreamUsageTrueFallsBackWhenUsageZero(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	c, resp, info := newRerankUsagePolicyContext(t, `{"results":[],"usage":{"total_tokens":0}}`)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := RerankHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 5, usage.PromptTokens)
	assert.Equal(t, 5, usage.TotalTokens)
}

func TestRerankHandlerTrustUpstreamUsageTrueKeepsNonZeroUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	c, resp, info := newRerankUsagePolicyContext(t, `{"results":[],"usage":{"total_tokens":18}}`)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := RerankHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 18, usage.PromptTokens)
	assert.Equal(t, 18, usage.TotalTokens)
}
