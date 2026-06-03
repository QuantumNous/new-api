package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestNormalizeChannelPreparationAutoPromotionRulePreservesLegacyJSON(t *testing.T) {
	rule := ChannelPreparationAutoPromotionRule{
		Id:           " legacy ",
		Group:        " default ",
		Type:         14,
		ThresholdUSD: 10,
		Strategy:     ChannelPreparationAutoPromotionStrategyLargeBalanceFirst,
	}

	NormalizeChannelPreparationAutoPromotionRule(&rule)

	require.Equal(t, "legacy", rule.Id)
	require.Equal(t, "default", rule.Group)
	require.Equal(t, 0, rule.MinimumUsableChannelCount)
	require.Equal(t, ChannelPreparationAutoPromotionGuaranteePriorityCapacityFirst, rule.GuaranteePriority)
	require.Equal(t, ChannelPreparationAutoPromotionStrategyLargeBalanceFirst, rule.CountShortageStrategy)
	require.Equal(t, ChannelPreparationAutoPromotionStrategyLargeBalanceFirst, rule.CapacityShortageStrategy)
	require.Equal(t, rule.CapacityShortageStrategy, rule.Strategy)
}

func TestValidateChannelPreparationAutoPromotionRulesAcceptsNewStrategies(t *testing.T) {
	rules := []ChannelPreparationAutoPromotionRule{
		{
			Id:                        "rule-1",
			Enabled:                   true,
			Group:                     "default",
			Type:                      14,
			ThresholdUSD:              10,
			MinimumUsableChannelCount: 2,
			GuaranteePriority:         ChannelPreparationAutoPromotionGuaranteePriorityCountFirst,
			CountShortageStrategy:     ChannelPreparationAutoPromotionStrategySmallBalanceFirst,
			CapacityShortageStrategy:  ChannelPreparationAutoPromotionStrategyLargeBalanceFirst,
		},
	}

	require.NoError(t, ValidateChannelPreparationAutoPromotionRules(rules))
}

func TestValidateChannelPreparationAutoPromotionRulesRejectsInvalidRules(t *testing.T) {
	baseRule := ChannelPreparationAutoPromotionRule{
		Id:           "rule-1",
		Enabled:      true,
		Group:        "default",
		Type:         14,
		ThresholdUSD: 10,
	}

	t.Run("duplicate id", func(t *testing.T) {
		err := ValidateChannelPreparationAutoPromotionRules([]ChannelPreparationAutoPromotionRule{baseRule, baseRule})
		require.Error(t, err)
	})

	t.Run("negative minimum usable count", func(t *testing.T) {
		rule := baseRule
		rule.MinimumUsableChannelCount = -1
		err := ValidateChannelPreparationAutoPromotionRules([]ChannelPreparationAutoPromotionRule{rule})
		require.Error(t, err)
	})

	t.Run("unknown guarantee priority", func(t *testing.T) {
		rule := baseRule
		rule.GuaranteePriority = "speed_first"
		err := ValidateChannelPreparationAutoPromotionRules([]ChannelPreparationAutoPromotionRule{rule})
		require.Error(t, err)
	})

	t.Run("unknown shortage strategy", func(t *testing.T) {
		rule := baseRule
		rule.CountShortageStrategy = "random"
		err := ValidateChannelPreparationAutoPromotionRules([]ChannelPreparationAutoPromotionRule{rule})
		require.Error(t, err)
	})
}

func TestValidateChannelPreparationAutoPromotionRulesJSONStringAcceptsOldRules(t *testing.T) {
	payload, err := common.Marshal([]ChannelPreparationAutoPromotionRule{
		{
			Id:           "old-rule",
			Enabled:      true,
			Group:        "default",
			Type:         14,
			ThresholdUSD: 5,
			Strategy:     ChannelPreparationAutoPromotionStrategyPriorityWeighted,
		},
	})
	require.NoError(t, err)

	require.NoError(t, ValidateChannelPreparationAutoPromotionRulesJSONString(string(payload)))
}
