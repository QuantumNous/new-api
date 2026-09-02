package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsInvalidPaymentFees(t *testing.T) {
	for _, value := range []string{"", "-1", "NaN", "+Inf", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue(operation_setting.EpayFeePercentOptionKey, value))
		})
	}
	require.NoError(t, validateOptionValue(operation_setting.WaffoFeeFixedOptionKey, "0.25"))
}

func TestValidateOptionValueRejectsInvalidMaxTokenAutoGroups(t *testing.T) {
	for _, value := range []string{"", "0", "-1", "1.5", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue("MaxTokenAutoGroups", value))
		})
	}
	require.NoError(t, validateOptionValue("MaxTokenAutoGroups", "999999"))
}
