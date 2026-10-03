package cohere

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCohereReasoningEffortAndThinkingResponse(t *testing.T) {
	for effort, mode := range map[string]string{"none": "disabled", "high": "enabled"} {
		converted, err := requestOpenAI2Cohere(dto.GeneralOpenAIRequest{Model: "command-a-reasoning-08-2025", ReasoningEffort: effort})
		require.NoError(t, err)
		require.Equal(t, mode, converted.Thinking.Type)
	}
	_, err := requestOpenAI2Cohere(dto.GeneralOpenAIRequest{ReasoningEffort: "medium"})
	require.ErrorContains(t, err, "none or high")

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "command-a-reasoning-08-2025"}}
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"chat_1","message":{"role":"assistant","content":[{"type":"thinking","thinking":"First, reason."},{"type":"text","text":"Answer."}]},"usage":{"tokens":{"input_tokens":4,"output_tokens":6}}}`))}
	_, apiErr := cohereHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.Contains(t, recorder.Body.String(), `"reasoning_content":"First, reason."`)
	require.Contains(t, recorder.Body.String(), `"content":"Answer."`)
}
