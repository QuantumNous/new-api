package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyQuotaSettingEnvDefaultsSetsReservationDefaults(t *testing.T) {
	t.Setenv(EnvPreConsumeOutputReserve, "false")
	t.Setenv(EnvPreConsumeMaxOutputTokens, "1024")

	setting := QuotaSetting{
		EnableFreeModelPreConsume: true,
		PreConsumeOutputReserve:   true,
		PreConsumeMaxOutputTokens: DefaultPreConsumeMaxOutputTokens,
	}
	applyQuotaSettingEnvDefaults(&setting)

	assert.False(t, setting.PreConsumeOutputReserve)
	assert.Equal(t, 1024, setting.PreConsumeMaxOutputTokens)
}

func TestApplyQuotaSettingEnvDefaultsKeepsSafeDefaultsOnInvalidValues(t *testing.T) {
	t.Setenv(EnvPreConsumeOutputReserve, "maybe")
	t.Setenv(EnvPreConsumeMaxOutputTokens, "not-a-number")

	setting := QuotaSetting{
		PreConsumeOutputReserve:   true,
		PreConsumeMaxOutputTokens: DefaultPreConsumeMaxOutputTokens,
	}
	applyQuotaSettingEnvDefaults(&setting)

	assert.True(t, setting.PreConsumeOutputReserve)
	assert.Equal(t, DefaultPreConsumeMaxOutputTokens, setting.PreConsumeMaxOutputTokens)
}

func TestOutputReserveTokenLimitFallsBackToSafeDefault(t *testing.T) {
	orig := quotaSetting
	t.Cleanup(func() { quotaSetting = orig })

	quotaSetting.PreConsumeMaxOutputTokens = maxPreConsumeOutputTokens + 1
	assert.Equal(t, DefaultPreConsumeMaxOutputTokens, OutputReserveTokenLimit())

	quotaSetting.PreConsumeMaxOutputTokens = 4096
	assert.Equal(t, 4096, OutputReserveTokenLimit())

	quotaSetting.PreConsumeMaxOutputTokens = 0
	assert.Equal(t, 0, OutputReserveTokenLimit())
}

func TestValidateQuotaOptionReservationKeys(t *testing.T) {
	require.NoError(t, ValidateQuotaOption("quota_setting.pre_consume_output_reserve", "true"))
	require.NoError(t, ValidateQuotaOption("quota_setting.pre_consume_output_reserve", "false"))
	require.NoError(t, ValidateQuotaOption("quota_setting.pre_consume_max_output_tokens", "0"))
	require.NoError(t, ValidateQuotaOption("quota_setting.pre_consume_max_output_tokens", "8192"))

	assert.Error(t, ValidateQuotaOption("quota_setting.pre_consume_output_reserve", "yes"))
	assert.Error(t, ValidateQuotaOption("quota_setting.pre_consume_max_output_tokens", "-1"))
	assert.Error(t, ValidateQuotaOption("quota_setting.pre_consume_max_output_tokens", "1.5"))
}

func TestQuotaSettingDeclaredDefaults(t *testing.T) {
	// The declared defaults, isolated from the environment and the saved
	// options that override them at runtime.
	assert.True(t, defaultQuotaSetting.PreConsumeOutputReserve)
	assert.Equal(t, DefaultPreConsumeMaxOutputTokens, defaultQuotaSetting.PreConsumeMaxOutputTokens)
	assert.Equal(t, 8192, DefaultPreConsumeMaxOutputTokens)
}
