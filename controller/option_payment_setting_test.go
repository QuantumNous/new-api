package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestNormalizePaymentSettingOptionValueUsesDefaultsForBlankStructuredValues(t *testing.T) {
	value, err := normalizePaymentSettingOptionValue("payment_setting.business_features", " ")
	require.NoError(t, err)

	var features map[string]bool
	require.NoError(t, common.UnmarshalJsonStr(value, &features))
	require.Equal(t, operation_setting.DefaultBusinessFeatures(), features)

	value, err = normalizePaymentSettingOptionValue("payment_setting.provider_scene_scopes", "")
	require.NoError(t, err)

	var scopes map[string]map[string]bool
	require.NoError(t, common.UnmarshalJsonStr(value, &scopes))
	require.Equal(t, operation_setting.DefaultProviderSceneScopes(), scopes)
}

func TestNormalizePaymentSettingOptionValueRejectsUnknownStructuredKeys(t *testing.T) {
	_, err := normalizePaymentSettingOptionValue(
		"payment_setting.business_features",
		`{"walletTopup":true}`,
	)
	require.Error(t, err)

	_, err = normalizePaymentSettingOptionValue(
		"payment_setting.provider_scene_scopes",
		`{"paypal":{"wallet_topup":true}}`,
	)
	require.Error(t, err)
}

func TestNormalizePaymentSettingOptionValueDropsLegacyBusinessFeatureKeys(t *testing.T) {
	value, err := normalizePaymentSettingOptionValue(
		"payment_setting.business_features",
		`{"wallet_topup":false,"invitation_reward":false,"redemption_manage":false}`,
	)
	require.NoError(t, err)

	var features map[string]bool
	require.NoError(t, common.UnmarshalJsonStr(value, &features))
	require.False(t, features[operation_setting.BillingFeatureWalletTopUp])
	require.NotContains(t, features, operation_setting.BillingFeatureInvitationReward)
	require.NotContains(t, features, operation_setting.BillingFeatureRedemptionManage)
}
