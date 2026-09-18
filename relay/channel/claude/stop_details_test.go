package claude

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleClaudeResponseDataRefusalRecordsFullStopDetails(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	data := []byte(`{
		"id":"msg_1",
		"type":"message",
		"stop_reason":"ReFuSaL",
		"stop_details":{"type":"refusal","category":"cyber","explanation":"policy refusal"}
	}`)

	apiErr := HandleClaudeResponseData(c, info, claudeInfo, nil, data)

	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, string(data), w.Body.String())
	assert.Equal(t, "claude_stop_reason=refusal", common.GetContextKeyString(c, constant.ContextKeyAdminRejectReason))

	stopDetails, ok := common.GetContextKeyType[*dto.ClaudeStopDetails](c, constant.ContextKeyClaudeStopDetails)
	require.True(t, ok)
	require.NotNil(t, stopDetails)
	assert.Equal(t, "refusal", stopDetails.Type)
	require.NotNil(t, stopDetails.Category)
	assert.Equal(t, "cyber", *stopDetails.Category)
	require.NotNil(t, stopDetails.Explanation)
	assert.Equal(t, "policy refusal", *stopDetails.Explanation)
}

func TestHandleStreamResponseDataRecordsMessageDeltaStopDetails(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	data := `{
		"type":"message_delta",
		"delta":{"stop_reason":"refusal","stop_details":{"type":"refusal","category":null,"explanation":null}},
		"usage":{"output_tokens":1}
	}`

	apiErr := HandleStreamResponseData(c, info, claudeInfo, data)

	require.Nil(t, apiErr)
	assert.Equal(t, "claude_stop_reason=refusal", common.GetContextKeyString(c, constant.ContextKeyAdminRejectReason))
	stopDetails, ok := common.GetContextKeyType[*dto.ClaudeStopDetails](c, constant.ContextKeyClaudeStopDetails)
	require.True(t, ok)
	require.NotNil(t, stopDetails)
	assert.Equal(t, "refusal", stopDetails.Type)
	assert.Nil(t, stopDetails.Category)
	assert.Nil(t, stopDetails.Explanation)
	assert.Contains(t, w.Body.String(), `"finish_reason":"content_filter"`)
	assert.NotContains(t, w.Body.String(), "stop_details")
}

func TestHandleClaudeResponseDataDoesNotRecordNonRefusalStopDetails(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	claudeInfo := &ClaudeResponseInfo{Usage: &dto.Usage{}}
	data := []byte(`{
		"type":"message",
		"stop_reason":"end_turn",
		"stop_details":{"type":"refusal","category":"cyber","explanation":"not a refusal"}
	}`)

	apiErr := HandleClaudeResponseData(c, info, claudeInfo, nil, data)

	require.Nil(t, apiErr)
	assert.Empty(t, common.GetContextKeyString(c, constant.ContextKeyAdminRejectReason))
	_, recorded := common.GetContextKeyType[*dto.ClaudeStopDetails](c, constant.ContextKeyClaudeStopDetails)
	assert.False(t, recorded)
}
