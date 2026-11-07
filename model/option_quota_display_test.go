package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLegacyDisplayInCurrencyKeepsConfiguredCurrency(t *testing.T) {
	generalSetting := operation_setting.GetGeneralSetting()
	originalType := generalSetting.QuotaDisplayType
	originalMap := common.OptionMap
	t.Cleanup(func() {
		generalSetting.QuotaDisplayType = originalType
		common.OptionMap = originalMap
	})

	tests := []struct {
		current string
		value   string
		want    string
	}{
		{current: operation_setting.QuotaDisplayTypeCNY, value: "true", want: operation_setting.QuotaDisplayTypeCNY},
		{current: operation_setting.QuotaDisplayTypeCustom, value: "true", want: operation_setting.QuotaDisplayTypeCustom},
		{current: operation_setting.QuotaDisplayTypeUSD, value: "true", want: operation_setting.QuotaDisplayTypeUSD},
		{current: operation_setting.QuotaDisplayTypeTokens, value: "true", want: operation_setting.QuotaDisplayTypeUSD},
		{current: operation_setting.QuotaDisplayTypeCNY, value: "false", want: operation_setting.QuotaDisplayTypeTokens},
	}
	for _, tt := range tests {
		t.Run(tt.current+"/"+tt.value, func(t *testing.T) {
			common.OptionMap = map[string]string{}
			generalSetting.QuotaDisplayType = tt.current

			require.NoError(t, updateOptionMap("DisplayInCurrencyEnabled", tt.value))

			assert.Equal(t, tt.want, operation_setting.GetQuotaDisplayType())
		})
	}
}
