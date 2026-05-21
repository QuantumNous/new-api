package codex

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIResponsesRequestForcesStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses, ChannelMeta: &relaycommon.ChannelMeta{}}
	stream := false

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model:  "gpt-5.3-codex",
		Input:  json.RawMessage(`"hi"`),
		Stream: &stream,
	})

	require.NoError(t, err)
	req, ok := converted.(dto.OpenAIResponsesRequest)
	require.True(t, ok)
	require.NotNil(t, req.Stream)
	require.True(t, *req.Stream)
	require.True(t, info.IsStream)
	require.True(t, c.GetBool(string(constant.ContextKeyIsStream)))
	require.Equal(t, json.RawMessage("false"), req.Store)
}

func TestConvertOpenAIResponsesCompactDoesNotForceStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponsesCompact, ChannelMeta: &relaycommon.ChannelMeta{}}
	stream := false

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model:  "gpt-5.3-codex",
		Input:  json.RawMessage(`"hi"`),
		Stream: &stream,
	})

	require.NoError(t, err)
	req, ok := converted.(dto.OpenAIResponsesRequest)
	require.True(t, ok)
	require.NotNil(t, req.Stream)
	require.False(t, *req.Stream)
	require.False(t, info.IsStream)
	require.False(t, c.GetBool(string(constant.ContextKeyIsStream)))
}
