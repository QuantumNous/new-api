package common_test

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/origin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloneRequestHeadersPreservesOrdinaryAuthorizationBehavior(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/responses", nil)
	c.Request.Header.Set("Authorization", "Bearer ordinary-new-api-token")

	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIResponses, &dto.OpenAIResponsesRequest{Model: "ordinary-model"}, nil)

	require.NoError(t, err)
	assert.Equal(t, "Bearer ordinary-new-api-token", info.RequestHeaders["Authorization"])
}

func TestCloneRequestHeadersRedactsOriginCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/responses", nil)
	c.Request.Header.Set("Authorization", "Bearer sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd")
	c.Request.Header.Set("X-Api-Key", "secondary-secret")
	require.True(t, origin.SetCredential(c, "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"))

	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIResponses, &dto.OpenAIResponsesRequest{Model: "origin-codex"}, nil)

	require.NoError(t, err)
	assert.NotContains(t, info.RequestHeaders, "Authorization")
	assert.NotContains(t, info.RequestHeaders, "X-Api-Key")
}
