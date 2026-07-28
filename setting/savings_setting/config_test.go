package savings_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateSettingSanitizesOfficialSourceURL(t *testing.T) {
	require.NoError(t, UpdateSettingByJSONString(""))
	t.Cleanup(func() { require.NoError(t, UpdateSettingByJSONString("")) })

	require.NoError(t, UpdateSettingByJSONString(`{
		"enabled": true,
		"reference_price_source": "legacy_value_is_ignored",
		"official_prices": {
			" gpt-4o-mini ": {
				"model_ratio": 1,
				"completion_ratio": 1,
				"source": " OpenAI ",
				"source_url": "https://example.com/pricing?token=secret&model=gpt&signature=hidden#private",
				"source_updated_at": 1700000000,
				"official_confirmed": true
			}
		}
	}`))

	setting := GetSetting()
	price, ok := setting.OfficialPrices["gpt-4o-mini"]
	require.True(t, ok)
	assert.Equal(t, "OpenAI", price.Source)
	assert.Equal(t, "https://example.com/pricing?model=gpt", price.SourceURL)
}

func TestUpdateSettingUsesLocalPricingAndLegacyRebuildDefaults(t *testing.T) {
	require.NoError(t, UpdateSettingByJSONString(`{"enabled":true}`))
	t.Cleanup(func() { require.NoError(t, UpdateSettingByJSONString("")) })

	setting := GetSetting()
	assert.True(t, setting.LocalPricingOfficialConfirmed)
	assert.True(t, setting.RebuildLegacyLogs)
}

func TestValidateSettingRejectsInvalidJSON(t *testing.T) {
	require.Error(t, ValidateSettingJSONString("{bad json"))
}

func TestValidateSettingRejectsSummaryLimitsAboveHardMaximum(t *testing.T) {
	tests := []struct {
		name  string
		value string
		field string
	}{
		{
			name:  "days",
			value: `{"max_summary_days":32}`,
			field: "max_summary_days",
		},
		{
			name:  "rows",
			value: `{"max_summary_log_rows":50001}`,
			field: "max_summary_log_rows",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSettingJSONString(tt.value)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.field)
		})
	}
}

func TestValidateSettingRejectsModelKeysThatCollideAfterTrimming(t *testing.T) {
	err := ValidateSettingJSONString(`{
		"official_prices": {
			"gpt-4o-mini": {"model_ratio": 1},
			" gpt-4o-mini ": {"model_ratio": 2}
		}
	}`)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "gpt-4o-mini")
}
