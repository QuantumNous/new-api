package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func restoreOptionMapAndPaymentSetting(t *testing.T) func() {
	t.Helper()

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()

	paymentSetting := operation_setting.GetPaymentSetting()
	originalFeatures := operation_setting.CopyBusinessFeatures(paymentSetting.BusinessFeatures)
	originalScopes := operation_setting.CopyProviderSceneScopes(paymentSetting.ProviderSceneScopes)

	return func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()

		paymentSetting.BusinessFeatures = originalFeatures
		paymentSetting.ProviderSceneScopes = originalScopes
	}
}

func TestUpdateOptionMapNormalizesPaymentBusinessFeatures(t *testing.T) {
	defer restoreOptionMapAndPaymentSetting(t)()

	err := updateOptionMap(
		"payment_setting.business_features",
		`{"wallet_topup":false,"redemption_manage":true,"invitation_reward":false}`,
	)
	if err != nil {
		t.Fatalf("updateOptionMap should accept legacy business feature JSON: %v", err)
	}

	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["payment_setting.business_features"]
	common.OptionMapRWMutex.RUnlock()

	var features map[string]bool
	if err := common.UnmarshalJsonStr(raw, &features); err != nil {
		t.Fatalf("stored business features should be valid JSON: %v", err)
	}
	if features[operation_setting.BillingFeatureWalletTopUp] {
		t.Fatal("explicit wallet_topup=false should be preserved")
	}
	if _, ok := features[operation_setting.BillingFeatureRedemptionManage]; ok {
		t.Fatal("legacy redemption_manage should not be exported")
	}
	if !features[operation_setting.BillingFeatureSubscriptionPurchase] {
		t.Fatal("missing subscription_purchase should be filled from defaults")
	}
	if operation_setting.IsBillingFeatureEnabled(operation_setting.BillingFeatureWalletTopUp) {
		t.Fatal("runtime payment setting should preserve wallet_topup=false")
	}
}

func TestUpdateOptionMapNormalizesPaymentProviderSceneScopes(t *testing.T) {
	defer restoreOptionMapAndPaymentSetting(t)()

	err := updateOptionMap(
		"payment_setting.provider_scene_scopes",
		`{"epay":{"wallet_topup":false},"waffo":{"wallet_topup":false}}`,
	)
	if err != nil {
		t.Fatalf("updateOptionMap should normalize provider scene scopes: %v", err)
	}

	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap["payment_setting.provider_scene_scopes"]
	common.OptionMapRWMutex.RUnlock()

	var scopes map[string]map[string]bool
	if err := common.UnmarshalJsonStr(raw, &scopes); err != nil {
		t.Fatalf("stored provider scene scopes should be valid JSON: %v", err)
	}
	if scopes[operation_setting.PaymentProviderEpay][operation_setting.PaymentSceneWalletTopUp] {
		t.Fatal("explicit epay wallet_topup=false should be preserved")
	}
	if !scopes[operation_setting.PaymentProviderEpay][operation_setting.PaymentSceneSubscriptionPurchase] {
		t.Fatal("missing epay subscription_purchase should be filled from defaults")
	}
	if operation_setting.IsPaymentProviderAllowedForScene(
		operation_setting.PaymentProviderEpay,
		operation_setting.PaymentSceneWalletTopUp,
	) {
		t.Fatal("runtime payment setting should preserve epay wallet_topup=false")
	}
}

func TestUpdateOptionsBulkNormalizesPaymentSettingsBeforePersist(t *testing.T) {
	defer restoreOptionMapAndPaymentSetting(t)()

	if err := DB.AutoMigrate(&Option{}); err != nil {
		t.Fatalf("failed to migrate options table: %v", err)
	}
	t.Cleanup(func() {
		DB.Exec("DELETE FROM options")
	})

	err := UpdateOptionsBulk(map[string]string{
		"payment_setting.business_features": `{"wallet_topup":false,"redemption_manage":true}`,
	})
	if err != nil {
		t.Fatalf("UpdateOptionsBulk should accept legacy business feature JSON: %v", err)
	}

	var option Option
	if err := DB.First(&option, "key = ?", "payment_setting.business_features").Error; err != nil {
		t.Fatalf("stored option should exist: %v", err)
	}

	var features map[string]bool
	if err := common.UnmarshalJsonStr(option.Value, &features); err != nil {
		t.Fatalf("stored business features should be valid JSON: %v", err)
	}
	if features[operation_setting.BillingFeatureWalletTopUp] {
		t.Fatal("explicit wallet_topup=false should be preserved")
	}
	if _, ok := features[operation_setting.BillingFeatureRedemptionManage]; ok {
		t.Fatal("legacy redemption_manage should not be persisted")
	}
	if !features[operation_setting.BillingFeatureSubscriptionPurchase] {
		t.Fatal("missing subscription_purchase should be filled from defaults")
	}
}
