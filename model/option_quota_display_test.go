package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The legacy DisplayInCurrencyEnabled toggle was converted into
// general_setting.quota_display_type, and loadOptionsFromDatabase replays
// stored options one by one in database order. A true legacy toggle stored
// after a currency display type must not turn it back into USD.
func TestLoadOptionsFromDatabaseKeepsStoredQuotaDisplayType(t *testing.T) {
	cases := []struct {
		name    string
		options []Option
		want    string
	}{
		{
			name: "legacy toggle after CNY keeps CNY",
			options: []Option{
				{Key: "general_setting.quota_display_type", Value: "CNY"},
				{Key: "DisplayInCurrencyEnabled", Value: "true"},
			},
			want: operation_setting.QuotaDisplayTypeCNY,
		},
		{
			name: "legacy toggle after CUSTOM keeps CUSTOM",
			options: []Option{
				{Key: "general_setting.quota_display_type", Value: "CUSTOM"},
				{Key: "DisplayInCurrencyEnabled", Value: "true"},
			},
			want: operation_setting.QuotaDisplayTypeCustom,
		},
		{
			name: "legacy toggle before CNY keeps CNY",
			options: []Option{
				{Key: "DisplayInCurrencyEnabled", Value: "true"},
				{Key: "general_setting.quota_display_type", Value: "CNY"},
			},
			want: operation_setting.QuotaDisplayTypeCNY,
		},
		{
			name: "legacy toggle turned on moves TOKENS to USD",
			options: []Option{
				{Key: "general_setting.quota_display_type", Value: "TOKENS"},
				{Key: "DisplayInCurrencyEnabled", Value: "true"},
			},
			want: operation_setting.QuotaDisplayTypeUSD,
		},
		{
			name: "legacy toggle turned off moves CNY to TOKENS",
			options: []Option{
				{Key: "general_setting.quota_display_type", Value: "CNY"},
				{Key: "DisplayInCurrencyEnabled", Value: "false"},
			},
			want: operation_setting.QuotaDisplayTypeTokens,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := useFrontendOptionMigrationDB(t)
			require.NoError(t, db.Create(&tc.options).Error)

			settings := operation_setting.GetGeneralSetting()
			originalDisplayType := settings.QuotaDisplayType
			originalOptionMap := common.OptionMap
			common.OptionMapRWMutex.Lock()
			common.OptionMap = make(map[string]string)
			common.OptionMapRWMutex.Unlock()
			t.Cleanup(func() {
				settings.QuotaDisplayType = originalDisplayType
				common.OptionMapRWMutex.Lock()
				common.OptionMap = originalOptionMap
				common.OptionMapRWMutex.Unlock()
			})

			settings.QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
			loadOptionsFromDatabase()

			assert.Equal(t, tc.want, operation_setting.GetQuotaDisplayType())
		})
	}
}
