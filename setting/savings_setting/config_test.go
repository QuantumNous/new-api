package savings_setting

import (
	"testing"

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
	require.Equal(t, "OpenAI", price.Source)
	require.Equal(t, "https://example.com/pricing?model=gpt", price.SourceURL)
}

func TestUpdateSettingUsesLocalPricingAndLegacyRebuildDefaults(t *testing.T) {
	require.NoError(t, UpdateSettingByJSONString(`{"enabled":true}`))
	t.Cleanup(func() { require.NoError(t, UpdateSettingByJSONString("")) })

	setting := GetSetting()
	require.True(t, setting.LocalPricingOfficialConfirmed)
	require.True(t, setting.RebuildLegacyLogs)
}

func TestValidateSettingRejectsInvalidJSON(t *testing.T) {
	require.Error(t, ValidateSettingJSONString("{bad json"))
}
