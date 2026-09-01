package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoNestsClaudeStopDetailsUnderAdminInfo(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	stopDetails := &dto.ClaudeStopDetails{Type: "refusal"}
	common.SetContextKey(ctx, constant.ContextKeyClaudeStopDetails, stopDetails)

	other := GenerateTextOtherInfo(ctx, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, 0, 0, 0, 0, 0, 0, 0)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	loggedStopDetails, ok := adminInfo["claude_stop_details"].(*dto.ClaudeStopDetails)
	require.True(t, ok)
	assert.Equal(t, stopDetails, loggedStopDetails)
	assert.NotContains(t, other, "claude_stop_details")
}
