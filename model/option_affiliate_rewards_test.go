package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionMapUpdatesAffiliateRewardsEnabled(t *testing.T) {
	originalEnabled := common.AffiliateRewardsEnabled
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		common.AffiliateRewardsEnabled = originalEnabled
		common.OptionMap = originalOptionMap
	})

	common.OptionMap = map[string]string{}
	common.AffiliateRewardsEnabled = true

	require.NoError(t, updateOptionMap("AffiliateRewardsEnabled", "false"))

	assert.False(t, common.AffiliateRewardsEnabled)
	assert.Equal(t, "false", common.OptionMap["AffiliateRewardsEnabled"])
}
