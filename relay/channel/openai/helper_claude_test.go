package openai

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestHandleFinalResponseRejectsIncompleteClaudeStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/v1/messages?beta=true", nil)

	streamStatus := relaycommon.NewStreamStatus()
	streamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
	info := &relaycommon.RelayInfo{
		RelayFormat:  types.RelayFormatClaude,
		StreamStatus: streamStatus,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeThinking,
		},
		SendResponseCount: 2,
	}

	lastChunk := `{"id":"chatcmpl-test","model":"GLM-5.2","choices":[{"index":0,"delta":{"reasoning_content":"checking tools"}}]}`
	HandleFinalResponse(c, info, lastChunk, "chatcmpl-test", 0, "GLM-5.2", "", &dto.Usage{CompletionTokens: 54}, false)

	require.True(t, info.ClaudeConvertInfo.Done)
	require.True(t, streamStatus.HasErrors())
	require.Contains(t, streamStatus.Errors[0].Message, "without finish_reason")
	require.Contains(t, recorder.Body.String(), "event: error")
	require.Contains(t, recorder.Body.String(), `"type":"api_error"`)
	require.False(t, strings.Contains(recorder.Body.String(), `"stop_reason":"end_turn"`))
}
