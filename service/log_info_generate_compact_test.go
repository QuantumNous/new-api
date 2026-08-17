package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoStoresCompactResponseObjectUnderAdminInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	info := &relaycommon.RelayInfo{
		CompactResponseObject: "compatible.compaction",
		ChannelMeta:           &relaycommon.ChannelMeta{},
	}

	other := GenerateTextOtherInfo(ctx, info, 1, 1, 1, 0, 1, 0, -1)
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "compatible.compaction", adminInfo["compact_response_object"])
	_, exposed := other["compact_response_object"]
	require.False(t, exposed)
}
