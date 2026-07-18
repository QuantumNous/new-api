package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizePaymentAutoSwitchGroupRulesList_SortsAndMarshalsRules(t *testing.T) {
	normalized, err := normalizePaymentAutoSwitchGroupRulesList([]operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 50, Group: "svip"},
		{ThresholdUSD: 10, Group: " vip "},
	})
	require.NoError(t, err)

	assert.Equal(t, []operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 10, Group: "vip"},
		{ThresholdUSD: 50, Group: "svip"},
	}, normalized.Rules)
	assert.Equal(t, `[{"threshold_usd":10,"group":"vip"},{"threshold_usd":50,"group":"svip"}]`, normalized.JSON)
}

func TestNormalizePaymentAutoSwitchGroupRulesList_RejectsInvalidRules(t *testing.T) {
	_, err := normalizePaymentAutoSwitchGroupRulesList([]operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 0, Group: "vip"},
	})
	require.Error(t, err)

	_, err = normalizePaymentAutoSwitchGroupRulesList([]operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 10, Group: "missing"},
	})
	require.Error(t, err)

	_, err = normalizePaymentAutoSwitchGroupRulesList([]operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 10, Group: "vip"},
		{ThresholdUSD: 10, Group: "svip"},
	})
	require.Error(t, err)
}

func TestFinalizeRequestedPaymentAutoSwitchGroupState_OnlyNewCutoffLifecycle(t *testing.T) {
	current := &operation_setting.PaymentSetting{
		AutoSwitchGroupEnabled:       false,
		AutoSwitchGroupOnlyNewTopups: false,
		AutoSwitchGroupEnabledFrom:   0,
	}

	enabled, onlyNewTopups, enabledFrom := finalizeRequestedPaymentAutoSwitchGroupState(current, true, true)
	assert.True(t, enabled)
	assert.True(t, onlyNewTopups)
	assert.Greater(t, enabledFrom, int64(0))

	current.AutoSwitchGroupEnabled = true
	current.AutoSwitchGroupOnlyNewTopups = true
	current.AutoSwitchGroupEnabledFrom = enabledFrom
	_, onlyNewTopups, retainedEnabledFrom := finalizeRequestedPaymentAutoSwitchGroupState(current, true, true)
	assert.True(t, onlyNewTopups)
	assert.Equal(t, enabledFrom, retainedEnabledFrom)

	enabled, onlyNewTopups, enabledFrom = finalizeRequestedPaymentAutoSwitchGroupState(current, false, true)
	assert.False(t, enabled)
	assert.False(t, onlyNewTopups)
	assert.Zero(t, enabledFrom)
}
