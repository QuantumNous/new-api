package relay

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestPrepareImageUsageForSettlementDoesNotInventUsage(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []types.ImageRoutingRoute{
			{ID: "alt", ChannelID: 36, Priority: 1, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
		},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	state := relaycommon.NewImageRoutingState(plan)
	require.NoError(t, state.ActivateRoute(0))
	info := &relaycommon.RelayInfo{ImageRouting: state}
	usage := &dto.Usage{}

	require.NoError(t, prepareImageUsageForSettlement(info, usage))
	require.Zero(t, usage.TotalTokens)
	require.Zero(t, usage.PromptTokens)
	require.Equal(t, 100000, state.FinalQuotaOverride)
}
