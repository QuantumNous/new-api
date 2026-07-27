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
		OriginModelName: "GLM-5.2",
		RelayFormat:     types.RelayFormatClaude,
		StreamStatus:    streamStatus,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         9,
			UpstreamModelName: "provider-glm-5.2",
		},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeThinking,
		},
		SendResponseCount: 2,
	}

	lastChunk := `{"id":"chatcmpl-test","model":"GLM-5.2","choices":[{"index":0,"delta":{"reasoning_content":"checking tools"}}]}`
	HandleFinalResponse(c, info, lastChunk, "chatcmpl-test", 0, "GLM-5.2", "", &dto.Usage{CompletionTokens: 54}, false)

	require.True(t, info.ClaudeConvertInfo.Done)
	require.True(t, streamStatus.HasErrors())
	require.Contains(t, streamStatus.Errors[0].Message, incompleteClaudeStreamDiagnosticCode)
	require.Contains(t, streamStatus.Errors[0].Message, "channel_id=9")
	require.Contains(t, streamStatus.Errors[0].Message, `origin_model="GLM-5.2"`)
	require.Contains(t, streamStatus.Errors[0].Message, `upstream_model="provider-glm-5.2"`)
	require.Contains(t, streamStatus.Errors[0].Message, "without finish_reason")
	require.Contains(t, recorder.Body.String(), "event: error")
	require.Contains(t, recorder.Body.String(), `"type":"api_error"`)
	require.Contains(t, recorder.Body.String(), incompleteClaudeStreamClientMessage)
	require.NotContains(t, recorder.Body.String(), incompleteClaudeStreamDiagnosticCode)
	require.NotContains(t, recorder.Body.String(), "channel_id")
	require.NotContains(t, recorder.Body.String(), "upstream")
	require.NotContains(t, recorder.Body.String(), "provider-glm-5.2")
	require.False(t, strings.Contains(recorder.Body.String(), `"stop_reason":"end_turn"`))
}

// 部分 OpenAI 兼容上游只用 [DONE] 收尾、不下发 finish_reason。
// 只要流正常结束且已产出实际答复内容，就应补齐收尾事件，而不是判定为截断。
func TestHandleFinalResponseFinalizesNormalStreamWithoutFinishReason(t *testing.T) {
	tests := []struct {
		name             string
		lastMessagesType string
		lastChunk        string
		wantStopReason   string
	}{
		{
			name:             "text answer falls back to end_turn",
			lastMessagesType: relaycommon.LastMessageTypeText,
			lastChunk:        `{"id":"chatcmpl-test","model":"GLM-5.2","choices":[{"index":0,"delta":{"content":"done"}}]}`,
			wantStopReason:   "end_turn",
		},
		{
			name:             "tool call falls back to tool_use",
			lastMessagesType: relaycommon.LastMessageTypeTools,
			lastChunk:        `{"id":"chatcmpl-test","model":"GLM-5.2","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_bash","type":"function","function":{"name":"Bash","arguments":"{}"}}]}}]}`,
			wantStopReason:   "tool_use",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("POST", "/v1/messages?beta=true", nil)

			streamStatus := relaycommon.NewStreamStatus()
			streamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "GLM-5.2",
				RelayFormat:     types.RelayFormatClaude,
				StreamStatus:    streamStatus,
				ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
					LastMessagesType: test.lastMessagesType,
					HasEmittedAnswer: true,
				},
				SendResponseCount: 2,
			}

			HandleFinalResponse(c, info, test.lastChunk, "chatcmpl-test", 0, "GLM-5.2", "", &dto.Usage{CompletionTokens: 54}, false)

			require.True(t, info.ClaudeConvertInfo.Done)
			require.False(t, streamStatus.HasErrors())
			body := recorder.Body.String()
			require.NotContains(t, body, "event: error")
			require.Contains(t, body, "event: content_block_stop")
			require.Contains(t, body, `"stop_reason":"`+test.wantStopReason+`"`)
			require.Contains(t, body, "event: message_stop")
		})
	}
}

// 流被截断（非 [DONE] 收尾）时，即使已经产出过内容，也必须报错而不是补一个假的 end_turn。
// eof 表示连接在没有 [DONE] 哨兵的情况下关闭，handler_stop 是致命错误路径，
// 二者都被 StreamStatus.IsNormalEnd() 视为正常，因此必须单独覆盖。
func TestHandleFinalResponseRejectsTruncatedStreamWithContent(t *testing.T) {
	endReasons := []relaycommon.StreamEndReason{
		relaycommon.StreamEndReasonTimeout,
		relaycommon.StreamEndReasonEOF,
		relaycommon.StreamEndReasonHandlerStop,
	}

	for _, endReason := range endReasons {
		t.Run(string(endReason), func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("POST", "/v1/messages?beta=true", nil)

			streamStatus := relaycommon.NewStreamStatus()
			streamStatus.SetEndReason(endReason, nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "GLM-5.2",
				RelayFormat:     types.RelayFormatClaude,
				StreamStatus:    streamStatus,
				ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
					LastMessagesType: relaycommon.LastMessageTypeText,
					HasEmittedAnswer: true,
				},
				SendResponseCount: 2,
			}

			lastChunk := `{"id":"chatcmpl-test","model":"GLM-5.2","choices":[{"index":0,"delta":{"content":"partial"}}]}`
			HandleFinalResponse(c, info, lastChunk, "chatcmpl-test", 0, "GLM-5.2", "", &dto.Usage{CompletionTokens: 54}, false)

			require.True(t, info.ClaudeConvertInfo.Done)
			require.True(t, streamStatus.HasErrors())
			require.Contains(t, recorder.Body.String(), "event: error")
			require.NotContains(t, recorder.Body.String(), `"stop_reason":"end_turn"`)
		})
	}
}
