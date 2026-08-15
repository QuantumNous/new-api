package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestClaudeCountTokensEstimatesLocallyForCursorHarness(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)
	common.SetContextKey(context, constant.ContextKeyOriginalModel, "claude-sonnet-4-6")

	request := &dto.ClaudeRequest{
		Model:  "claude-sonnet-4-6",
		System: "You are Claude Code.",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "Count this request without contacting the SDK sidecar."},
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeClaudeCountTokens,
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "claude-sonnet-4-6",
		Request:         request,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         61,
			ChannelType:       constant.ChannelTypeCursorAgent,
			ApiType:           constant.APITypeCursorAgent,
			ChannelBaseUrl:    "http://127.0.0.1:3927",
			UpstreamModelName: "claude-sonnet-4-6",
		},
	}

	apiErr := ClaudeCountTokensHelper(context, info)

	require.Nil(t, apiErr)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Greater(t, gjson.Get(recorder.Body.String(), "input_tokens").Int(), int64(0))
	require.True(t, common.GetContextKeyBool(context, constant.ContextKeyLocalCountTokens))
}
