package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestChannelOtherSettingsBlockRunPaymentChainDefaultsToBase(t *testing.T) {
	settings := ChannelOtherSettings{}
	if got := settings.GetBlockRunPaymentChain(); got != BlockRunPaymentChainBase {
		t.Fatalf("GetBlockRunPaymentChain() = %q, want %q", got, BlockRunPaymentChainBase)
	}

	settings.BlockRunPaymentChain = BlockRunPaymentChainSolana
	if got := settings.GetBlockRunPaymentChain(); got != BlockRunPaymentChainSolana {
		t.Fatalf("GetBlockRunPaymentChain() = %q, want %q", got, BlockRunPaymentChainSolana)
	}
}

func TestChannelOtherSettingsAssetMaterializationRoundTripsThroughCommonJSON(t *testing.T) {
	settings := ChannelOtherSettings{
		AssetMaterialization: &ChannelAssetMaterializationSettings{
			Provider:       "seedance_proxy",
			GatewayBaseURL: "https://asset-gateway.example.invalid",
			GroupID:        "grp_shared_aigc",
		},
	}

	raw, err := common.Marshal(settings)
	require.NoError(t, err)
	require.JSONEq(t, `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"https://asset-gateway.example.invalid","group_id":"grp_shared_aigc"}}`, string(raw))

	var decoded ChannelOtherSettings
	require.NoError(t, common.Unmarshal(raw, &decoded))
	require.NotNil(t, decoded.AssetMaterialization)
	require.Equal(t, settings.AssetMaterialization, decoded.AssetMaterialization)
}
