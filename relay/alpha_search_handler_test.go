package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildAlphaSearchRequestBodyPreservesUnknownFields(t *testing.T) {
	raw := []byte(`{"id":"req_1","model":"gpt-5.1","commands":{"search_query":[{"q":"weather","recency":1}]},"settings":{"locale":"en"},"future_field":{"nested":true}}`)
	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1-mapped")
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(out, &body))
	assert.Equal(t, "gpt-5.1-mapped", body["model"])
	assert.Equal(t, "req_1", body["id"])
	assert.Contains(t, body, "commands")
	assert.Contains(t, body, "settings")
	assert.Contains(t, body, "future_field")
}

func TestBuildAlphaSearchRequestBodyWithoutMappingKeepsRawBytes(t *testing.T) {
	raw := []byte(`{"model":"gpt-5.1","future_field":1}`)
	out, err := buildAlphaSearchRequestBody(raw, "gpt-5.1", "gpt-5.1")
	require.NoError(t, err)
	assert.Equal(t, raw, out)
}

func TestAlphaSearchUnsupportedChannelIsRetryable(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(string(constant.ContextKeyChannelType), constant.ChannelTypeOpenAI)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-5.1",
		Request:         &dto.AlphaSearchRequest{Model: "gpt-5.1", RawBody: []byte(`{"model":"gpt-5.1"}`)},
	}

	apiErr := AlphaSearchHelper(c, info)
	require.NotNil(t, apiErr)
	assert.False(t, types.IsSkipRetryError(apiErr))
	assert.Contains(t, apiErr.Error(), "does not support")
}
