package service

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateTextOtherInfoAddsAdminOnlyIntelligentRoutingAudit(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{OriginModelName: "client-model", ChannelMeta: &relaycommon.ChannelMeta{}, IntelligentRoutePlan: &hosttypes.IntelligentRoutePlan{
		PolicyVersion: 3, RequestedModel: "client-model",
		Nodes: []hosttypes.IntelligentRouteNode{{Model: "cheap", ChannelID: 7, PredictedSuccess: .92, ExpectedCost: decimal.RequireFromString("0.001"), ReasonCodes: []string{"lowest_expected_cost"}}},
	}}
	other := GenerateTextOtherInfo(ctx, info, 1, 1, 1, 0, 0, 0, 1)
	admin, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	audit, ok := admin["intelligent_routing"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, 3, audit["policy_version"])
	assert.Equal(t, "client-model", audit["requested_model"])
	assert.Equal(t, true, audit["shadow"])
	require.NotNil(t, audit["candidates"])
}
