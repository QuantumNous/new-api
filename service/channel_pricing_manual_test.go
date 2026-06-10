package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEffectiveModelPriceRatio(t *testing.T) {
	setting := `{"manual_group_ratio":2,"model_price_ratio":0}`
	require.Equal(t, 1.0, effectiveModelPriceRatio(&setting, 2))
	require.Equal(t, 0.0, effectiveModelPriceRatio(&setting, 0))

	settingWithRatio := `{"manual_group_ratio":2,"model_price_ratio":0.8}`
	require.Equal(t, 0.8, effectiveModelPriceRatio(&settingWithRatio, 2))
}

func TestExtractManualGroupRatioAndKeyGroup(t *testing.T) {
	setting := `{"key_group":"Claude Max（仅限CC）","manual_group_ratio":2}`
	require.Equal(t, "Claude Max（仅限CC）", ExtractKeyGroup(&setting))
	require.Equal(t, 2.0, ExtractManualGroupRatio(&setting))
}
